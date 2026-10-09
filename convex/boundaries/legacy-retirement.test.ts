// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertFinancialOperation } from "../lib/events/financial";

const detach = makeFunctionReference<"mutation">("migrations:m20261009_160000_detachCorrectionTransactionIds");
const purgeTransactions = makeFunctionReference<"mutation">("migrations:m20261009_160001_purgeLegacyTransactions");
const purgeLifecycle = makeFunctionReference<"mutation">("migrations:m20261009_160002_purgeLegacyPipeCreationEvents");
const status = makeFunctionReference<"query">("migrations:legacyRetirementStatus");
const audit = makeFunctionReference<"query">("migrations:auditCorrectionOperationLinks");
const batch = { oneBatchOnly: true, cursor: null, dryRun: false };

async function setup(count = 1) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Boiler", icon: "wallet", priority: 0, capacity: 1000,
      fed: 1000, spent: 100, pendingFedAdjustment: 50, sourceType: "boiler", contributedFed: 900 });
    const operationId = await insertFinancialOperation(ctx, { userId, title: "lunch", value: -100, occurredAt: 1,
      structure: { type: "expense", from: pipeId } });
    const transactionId = await ctx.db.insert("transactions", { userId, operationId, from: pipeId, kind: "expense", title: "stale", value: -200, date: 2 });
    await ctx.db.insert("pipeCreationEvents", { userId, pipeId, name: "Old", icon: "cash", pipeType: "boiler", ancestorIds: [], occurredAt: 1 });
    await ctx.db.insert("events", { userId, pipeId, type: "pipe_creation", name: "Boiler", icon: "wallet", pipeType: "boiler", ancestorIds: [], occurredAt: 1 }).then(id => ctx.db.patch("events", id, { operationId: id }));
    await ctx.db.insert("monthlySpendingStats", { userId, periodStart: 0, grossSpendingCents: 100, refundCents: 0,
      spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 100 });
    await ctx.db.insert("transactionTitleUsage", { userId, pipeId, title: "lunch", count: 2, lastUsedAt: 1 });
    const correctionIds = [];
    for (let i = 0; i < count; i++) correctionIds.push(await ctx.db.insert("transactionCorrections", {
      userId, operationId, transactionId, editedAt: i + 10,
      previous: { title: "old", value: -50, date: 0 }, current: { title: "lunch", value: -100, date: 1 },
    }));
    return { userId, pipeId, operationId, transactionId, correctionIds };
  });
  return { t, ...ids };
}

it("detaches exact correction links without changing snapshots, timestamps, accounting, or events", async () => {
  const { t } = await setup(3);
  const before = await t.run(async ctx => ({ corrections: await ctx.db.query("transactionCorrections").collect(),
    pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(), reports: await ctx.db.query("monthlySpendingStats").collect() }));
  expect(await t.mutation(detach, batch)).toMatchObject({ processed: 3, isDone: true });
  const expected = before.corrections.map(({ transactionId: _transactionId, ...correction }) => correction);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(expected);
  await t.mutation(detach, batch);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(expected);
  expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(), reports: await ctx.db.query("monthlySpendingStats").collect() })))
    .toEqual({ pipes: before.pipes, events: before.events, reports: before.reports });
  expect(await t.query(audit, { paginationOpts: { numItems: 100, cursor: null } })).toMatchObject({ page: expected.map(row => ({ correctionId: row._id, status: "linked", operationId: row.operationId })) });
});

it.each(["missing_link", "missing_transaction", "foreign_transaction", "conflicting_link", "broken_operation"] as const)
("rejects %s and rolls back the entire correction-detachment batch", async problem => {
  const { t, correctionIds, transactionId, operationId } = await setup(2);
  await t.run(async ctx => {
    if (problem === "missing_link") await ctx.db.patch("transactionCorrections", correctionIds[1], { operationId: undefined });
    if (problem === "missing_transaction") await ctx.db.delete("transactions", transactionId);
    if (problem === "foreign_transaction") {
      const userId = await ctx.db.insert("users", { username: "bob", email: "b", password: "hash" });
      await ctx.db.patch("transactions", transactionId, { userId });
    }
    if (problem === "conflicting_link") {
      const otherId = await ctx.db.insert("events", { userId: (await ctx.db.get("transactions", transactionId))!.userId,
        pipeId: (await ctx.db.get("events", operationId))!.pipeId, type: "transaction", title: "lunch", value: -100, occurredAt: 1 });
      await ctx.db.patch("events", otherId, { operationId: otherId });
      await ctx.db.patch("transactionCorrections", correctionIds[1], { operationId: otherId });
    }
    if (problem === "broken_operation") await ctx.db.delete("events", operationId);
  });
  const before = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await expect(t.mutation(detach, batch)).rejects.toThrow("requires review"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(before);
});

it("rolls back correction detachment in a dry run", async () => {
  const { t } = await setup();
  const before = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
  try { await expect(t.mutation(detach, { ...batch, dryRun: true })).rejects.toThrow("DRY RUN"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(before);
});

it("purges retired storage only after detachment while preserving current data", async () => {
  const { t } = await setup(3);
  await t.mutation(detach, batch);
  const before = await t.run(async ctx => ({ corrections: await ctx.db.query("transactionCorrections").collect(),
    pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(), reports: await ctx.db.query("monthlySpendingStats").collect(),
    titles: await ctx.db.query("transactionTitleUsage").collect(), users: await ctx.db.query("users").collect() }));
  expect(await t.query(status, {})).toEqual({ transactionsRemain: true, lifecycleRowsRemain: true, correctionTransactionLinksRemain: false });
  await t.mutation(purgeTransactions, batch);
  await t.mutation(purgeLifecycle, batch);
  expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("pipeCreationEvents").collect())).toEqual([]);
  expect(await t.query(status, {})).toEqual({ transactionsRemain: false, lifecycleRowsRemain: false, correctionTransactionLinksRemain: false });
  expect(await t.run(async ctx => ({ corrections: await ctx.db.query("transactionCorrections").collect(),
    pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(), reports: await ctx.db.query("monthlySpendingStats").collect(),
    titles: await ctx.db.query("transactionTitleUsage").collect(), users: await ctx.db.query("users").collect() }))).toEqual(before);
  await t.mutation(purgeTransactions, batch);
  await t.mutation(purgeLifecycle, batch);
});

it("blocks transaction purge while any correction still references its row", async () => {
  const { t, transactionId } = await setup();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await expect(t.mutation(purgeTransactions, batch)).rejects.toThrow("still has correction links"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.get("transactions", transactionId))).not.toBeNull();
});

it("rolls back earlier transaction deletes when a later row still has a correction link", async () => {
  const { t, userId, operationId, pipeId, correctionIds } = await setup();
  await t.run(async ctx => {
    const referencedId = await ctx.db.insert("transactions", { userId, operationId, from: pipeId, kind: "expense", title: "later", value: -100, date: 1 });
    await ctx.db.patch("transactionCorrections", correctionIds[0], { transactionId: referencedId });
  });
  const before = await t.run(ctx => ctx.db.query("transactions").collect());
  expect(before).toHaveLength(2);
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await expect(t.mutation(purgeTransactions, batch)).rejects.toThrow("still has correction links"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual(before);
});

it("reports a remaining legacy link even alongside newer operation-only corrections", async () => {
  const { t, userId, operationId } = await setup();
  await t.run(ctx => ctx.db.insert("transactionCorrections", { userId, operationId, editedAt: 100,
    previous: { title: "lunch", value: -100, date: 1 }, current: { title: "dinner", value: -100, date: 1 } }));
  expect(await t.query(status, {})).toMatchObject({ correctionTransactionLinksRemain: true });
  await t.mutation(detach, batch);
  expect(await t.query(status, {})).toMatchObject({ correctionTransactionLinksRemain: false });
});

it("continues bounded correction pages without losing unchanged operation-only records", async () => {
  const { t } = await setup(60);
  const first = await t.mutation(detach, batch);
  expect(first).toMatchObject({ processed: 25, isDone: false });
  expect((await t.run(ctx => ctx.db.query("transactionCorrections").collect())).filter(row => row.transactionId === undefined)).toHaveLength(25);
  const second = await t.mutation(detach, { ...batch, cursor: first.continueCursor });
  expect(second).toMatchObject({ processed: 25, isDone: false });
  expect(await t.mutation(detach, { ...batch, cursor: second.continueCursor })).toMatchObject({ processed: 10, isDone: true });
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  expect(corrections).toHaveLength(60);
  expect(corrections.every(row => row.transactionId === undefined && row.operationId !== undefined)).toBe(true);
});

it.each(["transactions", "pipeCreationEvents"] as const)("purges %s in resumable batches without touching current events", async table => {
  const { t, userId, pipeId, transactionId } = await setup();
  await t.mutation(detach, batch);
  await t.run(async ctx => {
    const transaction = (await ctx.db.get("transactions", transactionId))!;
    for (let i = 0; i < 59; i++) {
      if (table === "transactions") await ctx.db.insert("transactions", { userId, operationId: transaction.operationId,
        from: pipeId, kind: "expense", title: "retired", value: -100, date: i });
      else await ctx.db.insert("pipeCreationEvents", { userId, pipeId, name: "Retired", icon: "cash", pipeType: "pipe", ancestorIds: [], occurredAt: i, deletedAt: i + 1 });
    }
  });
  const before = await t.run(ctx => ctx.db.query("events").collect());
  const fn = table === "transactions" ? purgeTransactions : purgeLifecycle;
  const first = await t.mutation(fn, batch);
  expect(first).toMatchObject({ processed: 25, isDone: false });
  expect(await t.run(ctx => ctx.db.query(table).collect())).toHaveLength(35);
  const second = await t.mutation(fn, { ...batch, cursor: first.continueCursor });
  expect(second).toMatchObject({ processed: 25, isDone: false });
  expect(await t.mutation(fn, { ...batch, cursor: second.continueCursor })).toMatchObject({ processed: 10, isDone: true });
  expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
});

it.each(["transactions", "pipeCreationEvents"] as const)("does not delete %s during a dry run", async table => {
  const { t } = await setup();
  await t.mutation(detach, batch);
  const before = await t.run(ctx => ctx.db.query(table).collect());
  const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
  try {
    await expect(t.mutation(table === "transactions" ? purgeTransactions : purgeLifecycle, { ...batch, dryRun: true })).rejects.toThrow("DRY RUN");
  } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual(before);
});
