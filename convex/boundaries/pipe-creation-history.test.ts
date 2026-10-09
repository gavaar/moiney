// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { ensureLivePipeCreationHistory } from "../lib/pipeHistory";
import { insertFinancialOperation } from "../lib/events/financial";
import { startPipeDeletionOperation, processPipeDeletionOperation } from "../lib/pipes/delete/operations";

describe("pipe creation history", () => {
  it("refreshes lifecycle snapshots from events, not a stale legacy mirror", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const pipe = (await ctx.db.get("pipes", pipeId))!;
      await ensureLivePipeCreationHistory(ctx, pipe);
      const event = (await ctx.db.query("events").collect())[0];
      await ctx.db.insert("pipeCreationEvents", { userId, pipeId, name: "Stale", icon: "wallet", pipeType: "feed", occurredAt: 1, ancestorIds: [] });
      await ctx.db.patch("pipes", pipeId, { name: "Renamed" });
      return { pipeId, eventId: event._id, occurredAt: event.occurredAt };
    });
    await t.run(async ctx => ensureLivePipeCreationHistory(ctx, (await ctx.db.get("pipes", ids.pipeId))!));
    expect(await t.run(ctx => ctx.db.get("events", ids.eventId))).toMatchObject({ name: "Renamed", occurredAt: ids.occurredAt });
  });

  it.each([false, true])("follows orphan-history deletion while retaining shared archives (shared=%s)", async (shared) => {
    const t = convexTest(schema, modules);
    const { userId, pipeId, eventId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const pipeId = await ctx.db.insert("pipes", { ...fields, name: "Madrid" });
      const payer = await ctx.db.insert("pipes", { ...fields, name: "Main" });
      const { id: eventId } = await ensureLivePipeCreationHistory(ctx, (await ctx.db.get("pipes", pipeId))!);
      const operationId = await insertFinancialOperation(ctx, { userId, title: "hotel", value: -6000, occurredAt: 2000,
        structure: shared ? { type: "payByTransfer", from: pipeId, paidFrom: payer } : { type: "expense", from: pipeId } });
      await ctx.db.insert("transactions", {
        userId, operationId, kind: "expense", title: "hotel", value: -6000, date: 2000,
        from: pipeId, ...(shared ? { paidFrom: payer } : {}),
      });
      return { userId, pipeId, eventId };
    });
    const job = await t.run((ctx) => startPipeDeletionOperation(ctx, userId, {
      pipeId, deleteTransactions: true,
    }, async () => {}));
    for (let i = 0; i < 5; i++) await t.run((ctx) => processPipeDeletionOperation(ctx, job.jobId, async () => {}));
    const event = await t.run((ctx) => ctx.db.get("events", eventId));
    if (shared) {
      expect(event).toMatchObject({ type: "pipe_creation", name: "Madrid" });
      expect(await t.run(ctx => ctx.db.query("events").withIndex("by_userId_pipeId_type", q =>
        q.eq("userId", userId).eq("pipeId", pipeId).eq("type", "pipe_deletion")).unique())).not.toBeNull();
    }
    else expect(event).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("transactions").collect())).toHaveLength(1);
    const financial = await t.run(async ctx => (await ctx.db.query("events").collect())
      .filter(event => event.type !== "pipe_creation" && event.type !== "pipe_deletion"));
    expect(financial).toHaveLength(shared ? 2 : 0);
  });

  it("creates snapshots idempotently and preserves ancestry and final presentation when a subtree is deleted", async () => {
    const t = convexTest(schema, modules);
    const { userId, root, child } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const root = await ctx.db.insert("pipes", { ...fields, name: "Travel" });
      const child = await ctx.db.insert("pipes", { ...fields, parentId: root, name: "Madrid" });
      const pipe = (await ctx.db.get("pipes", child))!;
      expect(await ensureLivePipeCreationHistory(ctx, pipe)).toEqual(await ensureLivePipeCreationHistory(ctx, pipe));
      await ctx.db.patch("pipes", child, { name: "Madrid trip", icon: "airplane" });
      return { userId, root, child };
    });
    const job = await t.run((ctx) => startPipeDeletionOperation(ctx, userId, {
      pipeId: root, deleteTransactions: false,
    }, async () => {}));
    for (let i = 0; i < 10; i++) {
      await t.run((ctx) => processPipeDeletionOperation(ctx, job.jobId, async () => {}));
    }
    const events = await t.run((ctx) => ctx.db.query("events").collect());
    expect(events).toHaveLength(4);
    expect(events.find((event) => event.pipeId === child && event.type === "pipe_deletion")).toMatchObject({
      ancestorIds: [root], name: "Madrid trip", icon: "airplane", parentName: "Travel",
      occurredAt: expect.any(Number),
    });
    expect(await t.run((ctx) => ctx.db.get("pipes", root))).toBeNull();
  });

  it("records creation time and root-to-parent ancestry atomically without accounting transactions", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {
      username: "alice", email: "alice@example.com", password: "hash",
    }));
    const client = t.withIdentity({ subject: userId });
    const root = await client.mutation(api.pipes.addFeed, { name: "Personal", icon: "wallet" });
    const parent = await client.mutation(api.pipes.addPipe, {
      name: "Travel", icon: "airplane", parentId: root, capacity: 0, priority: 0,
    });
    const child = await client.mutation(api.pipes.addPipe, {
      name: "Madrid", icon: "map", parentId: parent, capacity: 0, priority: 0,
    });
    const state = await t.run(async (ctx) => ({
      events: await ctx.db.query("events").collect(),
      pipe: await ctx.db.get("pipes", child),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.events).toHaveLength(3);
    expect(state.events.find((event) => event.pipeId === child)).toMatchObject({
      ancestorIds: [root, parent], occurredAt: state.pipe!._creationTime,
      name: "Madrid", icon: "map", pipeType: "pipe",
    });
    expect(state.events.find((event) => event.pipeId === root && event.type === "pipe_creation")).toMatchObject({ ancestorIds: [] });
    expect(state.transactions).toEqual([]);
  });
});
