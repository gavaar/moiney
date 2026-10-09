// @vitest-environment edge-runtime
import { createAndReadOperation } from "./financialFixtures.helpers";
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
    const sourceId = await ctx.db.insert("pipes", {
      userId, name: "Source", icon: "water-boiler", priority: 0,
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

describe("Convex boundaries: event operation deletion", () => {
  it.each([
    { structure: "feed", value: 100 },
    { structure: "expense", value: -100 },
    { structure: "expense", value: 100 },
    { structure: "transfer", value: -100 },
    { structure: "transfer", value: 100 },
    { structure: "external", value: -100 },
    { structure: "external", value: 100 },
  ] as const)("deletes the complete $structure operation at $value cents and reverses accounting once", async ({ structure, value }) => {
    const { t, auth, sourceId, targetId } = await setup();
    const transaction = await createAndReadOperation(t, auth, {
      title: "lunch", value, date: 1000,
      ...(structure === "feed" ? { to: sourceId } : { from: sourceId }),
      ...(structure === "transfer" ? { to: targetId } : structure === "external" ? { paidFrom: targetId } : {}),
    });
    expect(await auth.mutation(api.financialOperations.remove, { operationId: transaction.id })).toBeNull();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("events", transaction.id))).toBeNull();
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 200, contributedFed: 1000 });
    expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toMatchObject({ fed: 500, spent: 100, contributedFed: 500 });
    if (structure === "external") expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ pendingFedAdjustment: 0 });
  });

  it("does not confuse otherwise identical submissions or remove their title usage", async () => {
    const { t, auth, sourceId, targetId } = await setup();
    const args = { title: "lunch", value: -100, date: 1000, from: sourceId, paidFrom: targetId };
    const first = await createAndReadOperation(t, auth, args);
    const second = await createAndReadOperation(t, auth, args);
    const secondRow = await t.run(ctx => ctx.db.get("events", second.id));
    const retained = await t.run(ctx => ctx.db.query("events").withIndex("by_operationId", q => q.eq("operationId", second.id)).collect());
    await auth.mutation(api.financialOperations.remove, { operationId: first.id });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(retained);
    expect(await t.run(ctx => ctx.db.get("events", second.id))).toEqual(secondRow);
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 300, pendingFedAdjustment: 100 });
    expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toMatchObject({ fed: 400, contributedFed: 500 });
    const usage = await t.run(ctx => ctx.db.query("transactionTitleUsage").collect());
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ pipeId: sourceId, title: "lunch", count: 2 });
  });

  it.each(["transfer", "external"] as const)("removes all %s events without partially reversing a surviving pipe when a role is missing", async structure => {
    const { t, auth, sourceId, targetId } = await setup();
    const transaction = await createAndReadOperation(t, auth, {
      title: "lunch", value: -100, date: 1000, from: sourceId,
      ...(structure === "transfer" ? { to: targetId } : { paidFrom: targetId }),
    });
    const survivingPipe = await t.run(ctx => ctx.db.get("pipes", targetId));
    await t.run(ctx => ctx.db.delete("pipes", sourceId));
    await auth.mutation(api.financialOperations.remove, { operationId: transaction.id });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("events", transaction.id))).toBeNull();
    expect(await t.run(ctx => ctx.db.get("pipes", targetId))).toEqual(survivingPipe);
  });

  it("rejects foreign transaction deletion without changing its events", async () => {
    const { t, auth, sourceId, foreignUserId } = await setup();
    const transaction = await createAndReadOperation(t, auth, { title: "lunch", value: -100, date: 1000, from: sourceId });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await expect(t.withIdentity({ subject: foreignUserId }).mutation(api.financialOperations.remove, { operationId: transaction.id })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.get("events", transaction.id))).not.toBeNull();
  });

  it("keeps the complete operation while a role is frozen", async () => {
    const { t, auth, userId, sourceId, targetId } = await setup();
    const transaction = await createAndReadOperation(t, auth, { title: "move", value: -100, date: 1000, from: sourceId, to: targetId });
    await t.run(async ctx => {
      const jobId = await ctx.db.insert("pipeDeletionJobs", { userId, deleteTransactions: false, memberPipeIds: [targetId], initialBalance: 500, phase: "processingTransactions", memberIndex: 0 });
      await ctx.db.patch("pipes", targetId, { deletionJobId: jobId });
    });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await expect(auth.mutation(api.financialOperations.remove, { operationId: transaction.id })).rejects.toThrow("Pipe is being deleted");
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.get("events", transaction.id))).not.toBeNull();
  });

  it("rejects a foreign operation without deleting either account's events", async () => {
    const { t, auth, sourceId, foreignUserId } = await setup();
    const own = await createAndReadOperation(t, auth, { title: "own", value: -100, date: 1000, from: sourceId });
    const foreignPipeId = await t.run(ctx => ctx.db.insert("pipes", { userId: foreignUserId, name: "Foreign", icon: "cash", priority: 0, capacity: 1000, fed: 1000, spent: 0 }));
    const foreign = await createAndReadOperation(t, t.withIdentity({ subject: foreignUserId }), { title: "foreign", value: -100, date: 1000, from: foreignPipeId });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await expect(auth.mutation(api.financialOperations.remove, { operationId: foreign.id })).rejects.toThrow("OPERATION_NOT_FOUND");
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.get("events", own.id))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.get("events", foreign.id))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.get("pipes", sourceId))).toMatchObject({ fed: 1000, spent: 300 });
  });

  it("rolls back accounting and keeps the transaction if its linked operation is incomplete", async () => {
    const { t, auth, sourceId, targetId } = await setup();
    const transaction = await createAndReadOperation(t, auth, { title: "move", value: -100, date: 1000, from: sourceId, to: targetId });
    await t.run(async ctx => {
      const events = await ctx.db.query("events").collect();
      await ctx.db.delete("events", events.find(event => event._id !== event.operationId)!._id);
    });
    const before = await t.run(async ctx => ({
      transaction: await ctx.db.get("events", transaction.id),
      source: await ctx.db.get("pipes", sourceId), target: await ctx.db.get("pipes", targetId),
      events: await ctx.db.query("events").collect(),
    }));
    await expect(auth.mutation(api.financialOperations.remove, { operationId: transaction.id })).rejects.toThrow();
    expect(await t.run(async ctx => ({
      transaction: await ctx.db.get("events", transaction.id),
      source: await ctx.db.get("pipes", sourceId), target: await ctx.db.get("pipes", targetId),
      events: await ctx.db.query("events").collect(),
    }))).toEqual(before);
  });
});
