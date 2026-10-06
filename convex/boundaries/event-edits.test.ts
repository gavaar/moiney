// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const foreignUserId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const pipeIds = [];
    for (const [name, fed] of [["Source", 1000], ["Target", 500], ["Replacement", 250]] as const) {
      pipeIds.push(await ctx.db.insert("pipes", { userId, name, icon: "water-boiler", priority: 0, capacity: 10000, fed, spent: 200, sourceType: "boiler", contributedFed: fed }));
    }
    return { userId, foreignUserId, sourceId: pipeIds[0], targetId: pipeIds[1], replacementId: pipeIds[2] };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

describe("Convex boundaries: event operation edits", () => {
  it.each(["feed", "expense", "transfer", "external"] as const)("synchronizes every %s entry while retaining identity, corrections, and accounting", async structure => {
    const { t, auth, userId, sourceId, targetId } = await setup();
    const originalValue = structure === "feed" ? 100 : -100;
    const value = structure === "feed" ? 200 : 50;
    const transaction = await auth.mutation(api.transactions.createTransaction, {
      title: "original", value: originalValue, date: 1000,
      ...(structure === "feed" ? { to: sourceId } : { from: sourceId }),
      ...(structure === "transfer" ? { to: targetId } : structure === "external" ? { paidFrom: targetId } : {}),
    });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    const result = await auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: " Changed ", value, date: 2000 });
    const after = await t.run(ctx => ctx.db.query("events").collect());
    expect(after.map(event => event._id).sort()).toEqual(before.map(event => event._id).sort());
    for (const event of after) {
      expect(event).toMatchObject({ userId, occurredAt: 2000, title: "changed", operationId: before[0].operationId });
      expect(event).toMatchObject({ value: event.pipeId === sourceId ? value : -value });
    }
    expect(result).toMatchObject({ id: transaction.id, title: "changed", value, date: 2000, editedAt: expect.any(Number) });
    expect(result).not.toHaveProperty("operationId");
    const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({ transactionId: transaction.id, previous: { title: "original", value: originalValue, date: 1000 }, current: { title: "changed", value, date: 2000 } });
    const source = await t.run(ctx => ctx.db.get("pipes", sourceId));
    const target = await t.run(ctx => ctx.db.get("pipes", targetId));
    if (structure === "feed") expect(source).toMatchObject({ fed: 1200, spent: 200, contributedFed: 1200 });
    if (structure === "expense") expect(source).toMatchObject({ fed: 1000, spent: 150, contributedFed: 1000 });
    if (structure === "transfer") {
      expect(source).toMatchObject({ fed: 1050, spent: 200, contributedFed: 1000 });
      expect(target).toMatchObject({ fed: 450, spent: 200, contributedFed: 450 });
    }
    if (structure === "external") {
      expect(source).toMatchObject({ fed: 1000, spent: 150, pendingFedAdjustment: -50, contributedFed: 1000 });
      expect(target).toMatchObject({ fed: 550, spent: 200, contributedFed: 500 });
    }
  });

  it("adds and removes a mirror on structural conversion without replacing the canonical entry", async () => {
    const { t, auth, sourceId, targetId } = await setup();
    const transaction = await auth.mutation(api.transactions.createTransaction, { title: "move", value: -100, date: 1000, from: sourceId });
    const original = await t.run(ctx => ctx.db.query("events").collect());
    await auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: "move", value: -200, date: 1000, target: { type: "transfer", to: targetId } });
    const paired = await t.run(ctx => ctx.db.query("events").collect());
    expect(paired).toHaveLength(2);
    expect(paired.find(event => event._id === original[0]._id)).toMatchObject({ type: "transfer", targetPipeId: targetId, value: -200 });
    await auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: "move", value: -50, date: 1000, target: { type: "expense" } });
    const single = await t.run(ctx => ctx.db.query("events").collect());
    expect(single).toHaveLength(1);
    expect(single[0]).toMatchObject({ _id: original[0]._id, operationId: original[0]._id, type: "transaction", pipeId: sourceId, value: -50 });
    expect(single[0]).not.toHaveProperty("targetPipeId");
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 250 });
    expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toMatchObject({ fed: 500, contributedFed: 500 });
  });

  it("reuses mirror identity when a transfer becomes externally paid and its spender moves", async () => {
    const { t, auth, sourceId, targetId, replacementId } = await setup();
    const transaction = await auth.mutation(api.transactions.createTransaction, { title: "move", value: -100, date: 1000, from: sourceId, to: targetId });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: "food", value: -50, date: 2000, primaryPipeId: replacementId, target: { type: "payByTransfer", paidFrom: targetId } });
    const after = await t.run(ctx => ctx.db.query("events").collect());
    expect(after.map(event => event._id).sort()).toEqual(before.map(event => event._id).sort());
    expect(after.find(event => event._id === before[0].operationId)).toMatchObject({ type: "third_party_transaction", pipeId: replacementId, targetPipeId: targetId, title: "food", value: -50, occurredAt: 2000 });
    expect(after.find(event => event._id !== before[0].operationId)).toMatchObject({ type: "transaction", pipeId: targetId, targetPipeId: replacementId, value: 50 });
  });

  it("creates the current event snapshot when editing a persisted legacy transaction without a link", async () => {
    const { t, auth, userId, sourceId } = await setup();
    const transactionId = await t.run(ctx => ctx.db.insert("transactions", { userId, kind: "expense", from: sourceId, title: "legacy", value: -100, date: 1000 }));
    await auth.mutation(api.transactions.editTransaction, { transactionId, title: "changed", value: -50, date: 2000 });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "transaction", pipeId: sourceId, title: "changed", value: -50, occurredAt: 2000, operationId: events[0]._id });
    expect(await t.run(ctx => ctx.db.get("transactions", transactionId))).toMatchObject({ operationId: events[0]._id });
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 150 });
  });

  it("leaves events and corrections unchanged for a no-op edit", async () => {
    const { t, auth, sourceId } = await setup();
    const transaction = await auth.mutation(api.transactions.createTransaction, { title: "lunch", value: -100, date: 1000, from: sourceId });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: "lunch", value: -100, date: 1000 });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  });

  it.each(["feed", "external"] as const)("reassigns a %s entry from a deleted primary pipe without replaying replacement accounting", async structure => {
    const { t, auth, sourceId, targetId, replacementId } = await setup();
    const transaction = await auth.mutation(api.transactions.createTransaction, {
      title: "original", value: structure === "feed" ? 100 : -100, date: 1000,
      ...(structure === "feed" ? { to: sourceId } : { from: sourceId, paidFrom: targetId }),
    });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await t.run(ctx => ctx.db.delete("pipes", sourceId));
    await auth.mutation(api.transactions.editTransaction, {
      transactionId: transaction.id, title: "changed", value: structure === "feed" ? 200 : -50,
      date: 2000, primaryPipeId: replacementId, applyReplacementEffects: false,
    });
    const after = await t.run(ctx => ctx.db.query("events").collect());
    expect(after.map(event => event._id).sort()).toEqual(before.map(event => event._id).sort());
    expect(after.find(event => event._id === before[0].operationId)).toMatchObject({ pipeId: replacementId, title: "changed", occurredAt: 2000 });
    expect(await t.run(ctx => ctx.db.get("pipes", replacementId))).toMatchObject({ fed: 250, spent: 200, contributedFed: 250 });
    if (structure === "external") {
      expect(after.find(event => event._id !== before[0].operationId)).toMatchObject({ pipeId: targetId, targetPipeId: replacementId, value: 50 });
      expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toMatchObject({ fed: 450, contributedFed: 500 });
    }
  });

  it("rejects an edit linked to another account's operation", async () => {
    const { t, auth, sourceId, foreignUserId } = await setup();
    const own = await auth.mutation(api.transactions.createTransaction, { title: "own", value: -100, date: 1000, from: sourceId });
    const foreignPipeId = await t.run(ctx => ctx.db.insert("pipes", { userId: foreignUserId, name: "Foreign", icon: "cash", priority: 0, capacity: 1000, fed: 1000, spent: 0 }));
    const foreign = await t.withIdentity({ subject: foreignUserId }).mutation(api.transactions.createTransaction, { title: "foreign", value: -100, date: 1000, from: foreignPipeId });
    await t.run(async ctx => {
      const transaction = await ctx.db.get("transactions", foreign.id);
      await ctx.db.patch("transactions", own.id, { operationId: transaction!.operationId });
    });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await expect(auth.mutation(api.transactions.editTransaction, { transactionId: own.id, title: "changed", value: -200, date: 2000 })).rejects.toThrow("History operation not found");
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 300 });
    expect(await t.run(ctx => ctx.db.get("transactions", own.id))).toMatchObject({ title: "own", value: -100, date: 1000 });
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  });

  it("rolls back an edit if a linked operation is incomplete", async () => {
    const { t, auth, sourceId, targetId } = await setup();
    const transaction = await auth.mutation(api.transactions.createTransaction, { title: "move", value: -100, date: 1000, from: sourceId, to: targetId });
    await t.run(async ctx => {
      const events = await ctx.db.query("events").collect();
      const mirror = events.find(event => event._id !== event.operationId)!;
      await ctx.db.delete("events", mirror._id);
    });
    const before = await t.run(async ctx => ({
      transaction: await ctx.db.get("transactions", transaction.id),
      source: await ctx.db.get("pipes", sourceId), target: await ctx.db.get("pipes", targetId),
      events: await ctx.db.query("events").collect(),
    }));
    await expect(auth.mutation(api.transactions.editTransaction, { transactionId: transaction.id, title: "changed", value: -200, date: 2000 })).rejects.toThrow();
    expect(await t.run(async ctx => ({
      transaction: await ctx.db.get("transactions", transaction.id),
      source: await ctx.db.get("pipes", sourceId), target: await ctx.db.get("pipes", targetId),
      events: await ctx.db.query("events").collect(),
    }))).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  });
});
