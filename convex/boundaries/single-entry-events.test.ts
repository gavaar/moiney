// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { MAX_AMOUNT } from "../../domain/money";

async function setup(sourceType: "feed" | "boiler" = "feed") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const foreignUserId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", {
      userId, name: "Wallet", icon: "wallet-outline", priority: 0,
      capacity: 10000, fed: 1000, spent: 200, sourceType,
      ...(sourceType === "boiler" ? { contributedFed: 1000 } : {}),
    });
    return { userId, foreignUserId, pipeId };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

describe("Convex boundaries: single-entry event creation", () => {
  it.each([
    { structure: "feed", value: 100, eventType: "feed", fed: 1100, spent: 200 },
    { structure: "expense", value: -100, eventType: "transaction", fed: 1000, spent: 300 },
    { structure: "expense", value: 100, eventType: "transaction", fed: 1000, spent: 100 },
  ] as const)("creates one $eventType for $structure at $value cents without changing accounting semantics", async ({ structure, value, eventType, fed, spent }) => {
    const { t, auth, userId, pipeId } = await setup();
    const result = await auth.mutation(api.transactions.createTransaction, {
      title: "  LuNcH  ", value, date: 1000,
      ...(structure === "feed" ? { to: pipeId } : { from: pipeId }),
    });
    const state = await t.run(async (ctx) => ({
      transaction: await ctx.db.get("transactions", result.id),
      events: await ctx.db.query("events").collect(),
      pipe: await ctx.db.get("pipes", pipeId),
      usage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      type: eventType, userId, pipeId, occurredAt: 1000, title: "lunch", value,
      operationId: state.events[0]._id,
    });
    expect(state.events[0]).not.toHaveProperty("targetPipeId");
    expect(state.transaction).toMatchObject({ operationId: state.events[0]._id, title: "lunch", value });
    expect(result).not.toHaveProperty("operationId");
    expect(result).toMatchObject({ kind: structure, title: "lunch", value, date: 1000 });
    expect(state.pipe).toMatchObject({ fed, spent });
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0]).toMatchObject({ userId, pipeId, title: "lunch", count: 1 });
  });

  it("creates a boiler contribution event while preserving principal and explicit current-fed adjustment", async () => {
    const { t, auth, userId, pipeId } = await setup("boiler");
    const result = await auth.mutation(api.transactions.contributeToBoiler, {
      pipeId, title: "  Investment ", value: 100, date: 2000, currentFed: 5000,
    });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "feed", userId, pipeId, occurredAt: 2000, title: "investment", value: 100 });
    expect(await t.run(ctx => ctx.db.get("transactions", result!.id))).toMatchObject({ operationId: events[0]._id });
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ fed: 5000, spent: 200, contributedFed: 1100 });
  });

  it("does not turn a current-fed-only boiler correction into an event", async () => {
    const { t, auth, pipeId } = await setup("boiler");
    expect(await auth.mutation(api.transactions.contributeToBoiler, {
      pipeId, title: "correction", value: 0, date: 2000, currentFed: -1000,
    })).toBeNull();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ fed: -1000, contributedFed: 1000 });
  });

  it.each([false, true])("returns event identity in recent history (pipe filter: %s)", async filtered => {
    const { auth, pipeId } = await setup();
    await auth.mutation(api.transactions.createTransaction, {
      title: "lunch", value: -100, date: 1000, from: pipeId,
    });
    const rows = await auth.query(api.events.latest, filtered ? { pipeId } : {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "lunch", value: -100, type: "transaction", pipeId });
    expect(rows[0].operationId).toBe(rows[0].id);
  });

  it.each(["foreign", "frozen", "parent"] as const)("rejects a %s expense without persisting events or accounting changes", async (condition) => {
    const { t, auth, userId, foreignUserId, pipeId } = await setup();
    await t.run(async ctx => {
      if (condition === "foreign") await ctx.db.patch("pipes", pipeId, { userId: foreignUserId });
      if (condition === "frozen") {
        const jobId = await ctx.db.insert("pipeDeletionJobs", {
          userId, deleteTransactions: false, memberPipeIds: [pipeId], initialBalance: 800,
          phase: "processingTransactions", memberIndex: 0,
        });
        await ctx.db.patch("pipes", pipeId, { deletionJobId: jobId });
      }
      if (condition === "parent") {
        const pipe = await ctx.db.get("pipes", pipeId);
        await ctx.db.insert("pipes", { userId: pipe!.userId, parentId: pipeId, name: "Child", icon: "cart", priority: 0, capacity: 0, fed: 0, spent: 0 });
      }
    });
    await expect(auth.mutation(api.transactions.createTransaction, { title: "lunch", value: -100, date: 1000, from: pipeId })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ fed: 1000, spent: 200 });
  });

  it.each([0, 0.5, MAX_AMOUNT + 1])("rejects invalid cents %s without creating either history representation", async value => {
    const { t, auth, pipeId } = await setup();
    await expect(auth.mutation(api.transactions.createTransaction, { title: "lunch", value, date: 1000, from: pipeId })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ fed: 1000, spent: 200 });
  });
});
