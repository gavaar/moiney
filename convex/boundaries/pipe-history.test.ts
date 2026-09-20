// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { ensurePipeCreationEvent } from "../lib/pipeHistory";
import { startPipeDeletionOperation, processPipeDeletionOperation } from "../lib/pipes/delete/operations";
import { makeFunctionReference } from "convex/server";

const listHistory = makeFunctionReference<"query">("history:list");
const archivePage = makeFunctionReference<"query">("history:archivePage");

describe("mixed history", () => {
  it("counts each involved expense once, including payer expenses and refunds, but not feeds or transfers in Spent", async () => {
    const t = convexTest(schema, modules);
    const { userId, eventId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Madrid", icon: "map", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const eventId = await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", pipeId))!);
      await ctx.db.patch("pipeCreationEvents", eventId, { deletedAt: 9000 });
      await ctx.db.delete("pipes", pipeId);
      for (const [i, fields] of [
        { kind: "expense" as const, from: pipeId, value: -4000 },
        { kind: "expense" as const, paidFrom: pipeId, value: -6000 },
        { kind: "expense" as const, from: pipeId, paidFrom: pipeId, value: -2000 },
        { kind: "expense" as const, from: pipeId, value: 1000 },
        { kind: "transfer" as const, from: pipeId, value: -10000 },
        { kind: "feed" as const, to: pipeId, value: 20000 },
      ].entries()) await ctx.db.insert("transactions", { userId, title: "trip", date: 1000 + i, ...fields });
      return { userId, eventId };
    });
    const client = t.withIdentity({ subject: userId });
    let count = 0;
    let spent = 0;
    const ids = new Set<string>();
    for (const role of ["from", "to", "paidFrom"]) {
      let cursor: string | undefined;
      for (let i = 0; i < 10; i++) {
      const page = await client.query(archivePage, { eventId, role, cursor, limit: 2 });
      count += page.count;
      spent += page.spent;
      for (const tx of page.transactions) ids.add(tx.id);
      if (page.isDone) break;
      cursor = page.cursor;
      }
    }
    expect(count).toBe(6);
    expect(ids.size).toBe(6);
    expect(spent).toBe(11000);
    const filtered = await client.query(archivePage, { eventId, filters: { fromDate: 1001, toDate: 1002 } });
    expect(filtered).toMatchObject({ count: 1, spent: 2000, oldestDate: 1002, latestDate: 1002, isDone: true });
    expect(await client.query(archivePage, { eventId, role: "paidFrom", filters: { fromDate: 1001, toDate: 1002 } }))
      .toMatchObject({ count: 1, spent: 6000, oldestDate: 1001, latestDate: 1001 });
    const other = await t.run((ctx) => ctx.db.insert("users", { username: "bob", email: "b", password: "hash" }));
    await expect(t.withIdentity({ subject: other }).query(archivePage, { eventId })).rejects.toThrow();
  });
  it("finds deleted archives through former ancestors, keeps shared live history, and filters by transaction dates", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const root = await ctx.db.insert("pipes", { ...fields, name: "Travel" });
      const child = await ctx.db.insert("pipes", { ...fields, parentId: root, name: "Madrid" });
      const payer = await ctx.db.insert("pipes", { ...fields, name: "Main" });
      const eventId = await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", child))!);
      await ctx.db.patch("pipeCreationEvents", eventId, { deletedAt: 3000, occurredAt: 100 });
      await ctx.db.delete("pipes", child);
      const transactionId = await ctx.db.insert("transactions", {
        userId, kind: "expense", title: "hotel", value: -6000, date: 2000,
        from: child, paidFrom: payer, fromIcon: "wallet",
      });
      return { userId, root, child, payer, transactionId };
    });
    const client = t.withIdentity({ subject: state.userId });
    const filtered = await client.query(listHistory, {
      filters: { pipeIds: [state.root], fromDate: 1000, toDate: 2500, title: "HOT" },
    });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]).toMatchObject({ kind: "pipe", date: 2000, event: {
      pipeId: state.child, ancestorIds: [state.root], deletedAt: 3000,
    } });
    const all = await client.query(listHistory, {});
    expect(all.transactionPage?.transactions).toEqual([
      expect.objectContaining({ id: state.transactionId, kind: "expense" }),
    ]);
    expect(filtered.transactionPage).toBeUndefined();
    expect(all.items.some((item: any) => item.kind === "transaction" && item.transaction.id === state.transactionId)).toBe(true);
    expect((await client.query(listHistory, { filters: { fromDate: 2501 } })).items).toEqual([]);
    const other = await t.run((ctx) => ctx.db.insert("users", { username: "bob", email: "b", password: "hash" }));
    expect((await t.withIdentity({ subject: other }).query(listHistory, {})).items).toEqual([]);
  });
  it("paginates equal-date creation and transaction entries without skipping or repeating them", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const eventId = await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", pipeId))!);
      await ctx.db.patch("pipeCreationEvents", eventId, { occurredAt: 1000 });
      for (let i = 0; i < 5; i++) await ctx.db.insert("transactions", {
        userId, kind: "expense", from: pipeId, title: `expense ${i}`, value: -100, date: 1000,
      });
      return userId;
    });
    const client = t.withIdentity({ subject: userId });
    const items: any[] = [];
    for (const source of ["transactions", "events"]) {
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await client.query(listHistory, { source, limit: 2, cursor });
      items.push(...page.items);
      if (page.isDone) break;
      cursor = page.cursor;
    }
    }
    expect(items).toHaveLength(6);
    expect(new Set(items.map((item) => item.kind === "pipe" ? item.event.id : item.transaction.id)).size).toBe(6);
  });
});

describe("pipe creation history", () => {
  it.each([false, true])("follows orphan-history deletion while retaining shared archives (shared=%s)", async (shared) => {
    const t = convexTest(schema, modules);
    const { userId, pipeId, eventId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const pipeId = await ctx.db.insert("pipes", { ...fields, name: "Madrid" });
      const payer = await ctx.db.insert("pipes", { ...fields, name: "Main" });
      const eventId = await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", pipeId))!);
      await ctx.db.insert("transactions", {
        userId, kind: "expense", title: "hotel", value: -6000, date: 2000,
        from: pipeId, ...(shared ? { paidFrom: payer } : {}),
      });
      return { userId, pipeId, eventId };
    });
    const job = await t.run((ctx) => startPipeDeletionOperation(ctx, userId, {
      pipeId, deleteTransactions: true,
    }, async () => {}));
    for (let i = 0; i < 5; i++) await t.run((ctx) => processPipeDeletionOperation(ctx, job.jobId, async () => {}));
    const event = await t.run((ctx) => ctx.db.get("pipeCreationEvents", eventId));
    if (shared) expect(event?.deletedAt).toEqual(expect.any(Number));
    else expect(event).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("transactions").collect())).toHaveLength(shared ? 1 : 0);
  });

  it("shows current pipe and parent presentation and validates public filter bounds", async () => {
    const t = convexTest(schema, modules);
    const { userId, child } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const parent = await ctx.db.insert("pipes", { ...fields, name: "Travel" });
      const child = await ctx.db.insert("pipes", { ...fields, parentId: parent, name: "Old" });
      await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", child))!);
      await ctx.db.patch("pipes", parent, { name: "Trips", icon: "airplane" });
      await ctx.db.patch("pipes", child, { name: "Madrid", icon: "map" });
      return { userId, child };
    });
    const client = t.withIdentity({ subject: userId });
    const page = await client.query(listHistory, { source: "events", filters: { title: "MAD" } });
    expect(page.items).toEqual([expect.objectContaining({ event: expect.objectContaining({
      pipeId: child, name: "Madrid", icon: "map", parentName: "Trips", parentIcon: "airplane",
    }) })]);
    await expect(client.query(listHistory, { limit: 101 })).rejects.toThrow("INVALID_HISTORY_LIMIT");
    await expect(client.query(listHistory, { filters: { fromDate: 2, toDate: 1 } })).rejects.toThrow("INVALID_TRANSACTION_DATE_RANGE");
  });

  it("backfills idempotently and preserves ancestry and final presentation when a subtree is deleted", async () => {
    const t = convexTest(schema, modules);
    const { userId, root, child } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
      const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
      const root = await ctx.db.insert("pipes", { ...fields, name: "Travel" });
      const child = await ctx.db.insert("pipes", { ...fields, parentId: root, name: "Madrid" });
      const pipe = (await ctx.db.get("pipes", child))!;
      expect(await ensurePipeCreationEvent(ctx, pipe)).toEqual(await ensurePipeCreationEvent(ctx, pipe));
      await ctx.db.patch("pipes", child, { name: "Madrid trip", icon: "airplane" });
      return { userId, root, child };
    });
    const job = await t.run((ctx) => startPipeDeletionOperation(ctx, userId, {
      pipeId: root, deleteTransactions: false,
    }, async () => {}));
    for (let i = 0; i < 10; i++) {
      await t.run((ctx) => processPipeDeletionOperation(ctx, job.jobId, async () => {}));
    }
    const events = await t.run((ctx) => ctx.db.query("pipeCreationEvents").collect());
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.pipeId === child)).toMatchObject({
      ancestorIds: [root], name: "Madrid trip", icon: "airplane", parentName: "Travel",
      deletedAt: expect.any(Number),
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
      events: await ctx.db.query("pipeCreationEvents").collect(),
      pipe: await ctx.db.get("pipes", child),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.events).toHaveLength(3);
    expect(state.events.find((event) => event.pipeId === child)).toMatchObject({
      ancestorIds: [root, parent], occurredAt: state.pipe!._creationTime,
      name: "Madrid", icon: "map", pipeType: "pipe",
    });
    expect(state.events.find((event) => event.pipeId === root)?.ancestorIds).toEqual([]);
    expect(state.transactions).toEqual([]);
  });
});
