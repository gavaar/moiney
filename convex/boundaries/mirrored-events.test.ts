// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { MAX_AMOUNT } from "../../domain/money";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const foreignUserId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const sourceId = await ctx.db.insert("pipes", {
      userId, name: "Source", icon: "wallet-outline", priority: 0,
      capacity: 10000, fed: 1000, spent: 200, sourceType: "boiler", contributedFed: 1000,
    });
    const targetId = await ctx.db.insert("pipes", {
      userId, name: "Target", icon: "water-boiler", priority: 0,
      capacity: 10000, fed: 500, spent: 100, sourceType: "boiler", contributedFed: 500,
    });
    return { userId, foreignUserId, sourceId, targetId };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

describe("Convex boundaries: mirrored event creation", () => {
  it.each([
    { structure: "transfer", value: -100 },
    { structure: "transfer", value: 100 },
    { structure: "external", value: -100 },
    { structure: "external", value: 100 },
  ] as const)("creates a complete $structure operation at $value cents without applying mirror accounting twice", async ({ structure, value }) => {
    const { t, auth, userId, sourceId, targetId } = await setup();
    const result = await auth.mutation(api.transactions.createTransaction, {
      title: "  LuNcH  ", value, date: 1000, from: sourceId,
      ...(structure === "transfer" ? { to: targetId } : { paidFrom: targetId }),
    });
    const state = await t.run(async ctx => ({
      transaction: await ctx.db.get("transactions", result.id),
      events: await ctx.db.query("events").collect(),
      source: await ctx.db.get("pipes", sourceId),
      target: await ctx.db.get("pipes", targetId),
      usage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.events).toHaveLength(2);
    const canonical = state.events.find(event => event._id === state.transaction?.operationId);
    const mirror = state.events.find(event => event._id !== state.transaction?.operationId);
    expect(canonical).toMatchObject({
      type: structure === "transfer" ? "transfer" : "third_party_transaction",
      userId, pipeId: sourceId, targetPipeId: targetId,
      occurredAt: 1000, title: "lunch", value, operationId: canonical?._id,
    });
    expect(mirror).toMatchObject({
      type: structure === "transfer" ? "transfer" : "transaction",
      userId, pipeId: targetId, targetPipeId: sourceId,
      occurredAt: 1000, title: "lunch", value: -value, operationId: canonical?._id,
    });
    expect(canonical!._id).not.toBe(mirror!._id);
    expect(state.transaction).toMatchObject({
      from: sourceId, title: "lunch", value, date: 1000,
      ...(structure === "transfer" ? { to: targetId, kind: "transfer" } : { paidFrom: targetId, kind: "expense" }),
    });
    expect(result).not.toHaveProperty("operationId");
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0]).toMatchObject({ userId, pipeId: sourceId, title: "lunch", count: 1 });
    if (structure === "transfer") {
      expect(state.source).toMatchObject({ fed: 1000 + value, spent: 200, contributedFed: 1000 });
      expect(state.target).toMatchObject({ fed: 500 - value, spent: 100, contributedFed: 500 - value });
      expect(state.source!.fed + state.target!.fed).toBe(1500);
    } else {
      expect(state.source).toMatchObject({ fed: 1000, spent: 200 - value, pendingFedAdjustment: -value, contributedFed: 1000 });
      expect(state.target).toMatchObject({ fed: 500 + value, spent: 100, contributedFed: 500 });
    }
    const rows = await auth.query(api.transactions.listTransactions, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("operationId");
  });

  it.each([-MAX_AMOUNT, MAX_AMOUNT])("persists opposing transfer entries at the signed cents boundary %s", async value => {
    const { t, auth, sourceId, targetId } = await setup();
    await t.run(async ctx => {
      await ctx.db.patch("pipes", sourceId, { fed: 0, spent: 0, contributedFed: 0 });
      await ctx.db.patch("pipes", targetId, { fed: 0, spent: 0, contributedFed: 0 });
    });
    await auth.mutation(api.transactions.createTransaction, { title: "move", value, date: 1000, from: sourceId, to: targetId });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(2);
    expect(events.find(event => event.pipeId === sourceId)).toMatchObject({ value });
    expect(events.find(event => event.pipeId === targetId)).toMatchObject({ value: -value });
    const source = await t.run(ctx => ctx.db.get("pipes", sourceId));
    const target = await t.run(ctx => ctx.db.get("pipes", targetId));
    expect(source!.fed + target!.fed).toBe(0);
  });

  it.each(["transfer", "external"] as const)("rejects a foreign %s target without partial events or accounting changes", async structure => {
    const { t, auth, sourceId, targetId, foreignUserId } = await setup();
    await t.run(ctx => ctx.db.patch("pipes", targetId, { userId: foreignUserId }));
    await expect(auth.mutation(api.transactions.createTransaction, {
      title: "lunch", value: -100, date: 1000, from: sourceId,
      ...(structure === "transfer" ? { to: targetId } : { paidFrom: targetId }),
    })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 200, contributedFed: 1000 });
    expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toMatchObject({ fed: 500, spent: 100, contributedFed: 500 });
  });
});
