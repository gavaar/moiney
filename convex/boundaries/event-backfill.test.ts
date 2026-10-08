// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const transactions = makeFunctionReference<"mutation">("migrations:m20261006_160002_backfillTransactionEvents");
const livePipes = makeFunctionReference<"mutation">("migrations:m20261006_160000_backfillLivePipeEvents");
const lifecycle = makeFunctionReference<"mutation">("migrations:m20261006_160001_backfillLifecycleEvents");
const batch = { oneBatchOnly: true, cursor: null, dryRun: false };

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 1000, fed: 500, spent: 100, pendingFedAdjustment: 60 };
    const root = await ctx.db.insert("pipes", { ...fields, name: "Root", sourceType: "boiler", contributedFed: 700 });
    const child = await ctx.db.insert("pipes", { ...fields, name: "Child", parentId: root });
    return { userId, root, child };
  });
  return { t, ...ids };
}

describe("Convex boundaries: event backfill", () => {
  it("migrates every legacy financial shape without replaying accounting or altering corrections", async () => {
    const { t, userId, root, child } = await setup();
    const ids = await t.run(async ctx => {
      const rows = [
        { kind: "feed", to: root, value: 100 },
        { kind: "expense", from: root, value: -100 },
        { kind: "expense", from: root, value: 100 },
        { kind: "transfer", from: root, to: child, value: -100 },
        { kind: "transfer", from: root, to: child, value: 100 },
        { kind: "expense", from: child, paidFrom: root, value: -100 },
        { kind: "expense", from: child, paidFrom: root, value: 100 },
      ] as const;
      const ids = [];
      for (const row of rows) ids.push(await ctx.db.insert("transactions", { ...row, userId, title: "same", date: 1000 }));
      await ctx.db.insert("transactionCorrections", { transactionId: ids[0], userId, editedAt: 2000, previous: { title: "old", value: 50, date: 1000 }, current: { title: "same", value: 100, date: 1000 } });
      await ctx.db.delete("pipes", child);
      return ids;
    });
    const before = await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), corrections: await ctx.db.query("transactionCorrections").collect() }));
    const result = await t.mutation(transactions, batch);
    expect(result).toMatchObject({ processed: 7, isDone: true });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(11);
    const linked = await t.run(ctx => ctx.db.query("transactions").collect());
    expect(new Set(linked.map(row => row.operationId)).size).toBe(7);
    for (const id of ids) {
      const row = linked.find(row => row._id === id)!;
      const canonical = events.find(event => event._id === row.operationId)!;
      expect(canonical).toMatchObject({ userId, pipeId: row.from ?? row.to, title: "same", value: row.value, occurredAt: 1000, operationId: canonical._id });
      const entries = events.filter(event => event.operationId === row.operationId);
      expect(entries).toHaveLength(row.kind === "transfer" || row.paidFrom ? 2 : 1);
      if (entries.length === 2) expect(entries.find(event => event._id !== row.operationId)).toMatchObject({ pipeId: row.to ?? row.paidFrom, targetPipeId: row.from, value: -row.value });
    }
    await t.mutation(transactions, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
    expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), corrections: await ctx.db.query("transactionCorrections").collect() }))).toEqual(before);
  });

  it("backfills live ancestry and retained legacy lifecycle snapshots idempotently", async () => {
    const { t, userId, root, child } = await setup();
    const archive = await t.run(async ctx => {
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Deleted", icon: "map", priority: 0, capacity: 0, fed: 0, spent: 0 });
      await ctx.db.delete("pipes", pipeId);
      await ctx.db.insert("pipeCreationEvents", { userId, pipeId, name: "Last name", icon: "cafe", pipeType: "pipe", ancestorIds: [root, child], parentName: "Last parent", parentIcon: "cart", occurredAt: 100, deletedAt: 3000 });
      return pipeId;
    });
    const before = await t.run(ctx => ctx.db.query("pipes").collect());
    await t.mutation(livePipes, batch);
    await t.mutation(lifecycle, batch);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(4);
    expect(events.find(event => event.pipeId === child)).toMatchObject({ type: "pipe_creation", ancestorIds: [root], parentName: "Root", parentIcon: "wallet", occurredAt: before.find(pipe => pipe._id === child)!._creationTime });
    expect(events.filter(event => event.pipeId === archive)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "pipe_creation", occurredAt: 100, name: "Last name", icon: "cafe", ancestorIds: [root, child], parentName: "Last parent" }),
      expect.objectContaining({ type: "pipe_deletion", occurredAt: 3000, name: "Last name", icon: "cafe", ancestorIds: [root, child], parentName: "Last parent" }),
    ]));
    await t.mutation(livePipes, batch);
    await t.mutation(lifecycle, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
    expect(await t.run(ctx => ctx.db.query("pipes").collect())).toEqual(before);
  });

  it.each(["from", "to", "paidFrom", "none"] as const)("infers missing deletion dates from newest retained %s history or creation", async role => {
    const { t, userId, root, child } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("pipeCreationEvents", { userId, pipeId: child, name: "Child", icon: "cart", pipeType: "pipe", ancestorIds: [root], occurredAt: 100 });
      await ctx.db.delete("pipes", child);
      if (role !== "none") {
        const roles = role === "from" ? { kind: "expense", from: child } : role === "to" ? { kind: "feed", to: child } : { kind: "expense", from: root, paidFrom: child };
        for (const date of [900, 5000, 1000]) await ctx.db.insert("transactions", { ...roles, kind: role === "to" ? "feed" : "expense", userId, title: "legacy", value: role === "to" ? 100 : -100, date });
      }
    });
    await t.mutation(lifecycle, batch);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events.find(event => event.type === "pipe_deletion")).toMatchObject({ pipeId: child, occurredAt: role === "none" ? 100 : 5000 });
    expect(await t.run(ctx => ctx.db.query("pipeCreationEvents").withIndex("by_pipeId", q => q.eq("pipeId", child)).unique())).toMatchObject({ deletedAt: role === "none" ? 100 : 5000 });
    await t.run(ctx => ctx.db.insert("transactions", { userId, kind: "expense", from: child, title: "later edit", value: -100, date: 9000 }));
    await t.mutation(lifecycle, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
  });

  it("does not infer a deletion date before creation from backdated transactions", async () => {
    const { t, userId, root, child } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("pipeCreationEvents", { userId, pipeId: child, name: "Child", icon: "cart", pipeType: "pipe", ancestorIds: [root], occurredAt: 5000 });
      await ctx.db.insert("transactions", { userId, kind: "expense", from: child, title: "backdated", value: -100, date: 1000 });
      await ctx.db.delete("pipes", child);
    });
    await t.mutation(lifecycle, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ type: "pipe_deletion", occurredAt: 5000 })]));
    expect(await t.run(ctx => ctx.db.query("pipeCreationEvents").withIndex("by_pipeId", q => q.eq("pipeId", child)).unique())).toMatchObject({ deletedAt: 5000 });
  });

  it("leaves shipped linked operations unchanged", async () => {
    const { t, userId, child } = await setup();
    await t.withIdentity({ subject: userId }).mutation(api.transactions.createTransaction, { from: child, title: "new", value: -100, date: 1000 });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    await t.mutation(transactions, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
  });

  it("rolls back a dry run, including inserted events and transaction links", async () => {
    const { t, userId, root } = await setup();
    const id = await t.run(ctx => ctx.db.insert("transactions", { userId, kind: "expense", from: root, title: "legacy", value: -100, date: 1000 }));
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      await expect(t.mutation(transactions, { ...batch, dryRun: true })).rejects.toThrow("DRY RUN");
      expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
      expect(await t.run(ctx => ctx.db.get("transactions", id))).not.toHaveProperty("operationId");
    } finally { spy.mockRestore(); }
  });

  it("continues bounded pages while edits, deletes, and new dual-writes preserve exact identity", async () => {
    const { t, userId, child } = await setup();
    const ids = await t.run(async ctx => {
      const ids = [];
      for (let i = 0; i < 5; i++) ids.push(await ctx.db.insert("transactions", { userId, kind: "expense", from: child, title: "same", value: -10, date: 1000 }));
      return ids;
    });
    const first = await t.mutation(transactions, { ...batch, batchSize: 2 });
    expect(first).toMatchObject({ processed: 2, isDone: false });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toHaveLength(2);
    const auth = t.withIdentity({ subject: userId });
    await auth.mutation(api.transactions.editTransaction, { transactionId: ids[2], title: "edited", value: -10, date: 1000 });
    await auth.mutation(api.transactions.deleteTransaction, { transactionId: ids[3] });
    await auth.mutation(api.transactions.createTransaction, { from: child, title: "new", value: -10, date: 1000 });
    const before = await t.run(ctx => ctx.db.query("events").collect());
    expect(await t.run(ctx => ctx.db.get("transactions", ids[4]))).not.toHaveProperty("operationId");
    expect(await t.mutation(transactions, { ...batch, cursor: first.continueCursor })).toMatchObject({ processed: 3, isDone: true });
    const after = await t.run(ctx => ctx.db.query("events").collect());
    expect(after).toHaveLength(5);
    expect(after).toEqual(expect.arrayContaining(before));
    const remaining = await t.run(ctx => ctx.db.get("transactions", ids[4]));
    expect(after.find(event => event._id === remaining!.operationId)).toMatchObject({ pipeId: child, title: "same", value: -10, occurredAt: 1000 });
    await t.mutation(transactions, batch);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(after);
    expect(new Set(after.map(event => event.operationId)).size).toBe(5);
  });

  it.each(["missing", "foreign", "incomplete"] as const)("rejects %s existing links and rolls back the whole migration page", async problem => {
    const { t, userId, child } = await setup();
    const auth = t.withIdentity({ subject: userId });
    const payer = await t.run(async ctx => {
      // Earlier work in the same page must roll back when a later link fails.
      await ctx.db.insert("transactions", { userId, kind: "expense", from: child, title: "legacy", value: -10, date: 1000 });
      return await ctx.db.insert("pipes", { userId, name: "Payer", icon: "wallet", priority: 0, capacity: 0, fed: 1000, spent: 0 });
    });
    const linked = await auth.mutation(api.transactions.createTransaction, { from: child, paidFrom: payer, title: "linked", value: -10, date: 1000 });
    await t.run(async ctx => {
      const row = await ctx.db.get("transactions", linked.id);
      const events = await ctx.db.query("events").collect();
      if (problem === "missing") for (const event of events) await ctx.db.delete("events", event._id);
      if (problem === "incomplete") await ctx.db.delete("events", events.find(event => event._id !== row!.operationId)!._id);
      if (problem === "foreign") {
        const foreign = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
        for (const event of events) await ctx.db.patch("events", event._id, { userId: foreign });
      }
    });
    const before = await t.run(async ctx => ({ events: await ctx.db.query("events").collect(), transactions: await ctx.db.query("transactions").collect() }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(t.mutation(transactions, batch)).rejects.toThrow();
      expect(await t.run(async ctx => ({ events: await ctx.db.query("events").collect(), transactions: await ctx.db.query("transactions").collect() }))).toEqual(before);
    } finally { spy.mockRestore(); }
  });
});
