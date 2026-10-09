// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertFinancialOperation } from "../lib/events/financial";
import { insertHistoryOperation } from "../lib/events/persistence";

const migrate = makeFunctionReference<"mutation">("migrations:m20261008_180000_backfillCorrectionOperationIds");
const audit = makeFunctionReference<"query">("migrations:auditCorrectionOperationLinks");
const batch = { oneBatchOnly: true, cursor: null, dryRun: false };

async function setup(count = 1) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Boiler", icon: "wallet", priority: 0, fed: 1000, spent: 100, capacity: 1000,
      sourceType: "boiler", contributedFed: 900 });
    await ctx.db.insert("monthlySpendingStats", { userId, periodStart: 0, grossSpendingCents: 100, refundCents: 0,
      spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 100 });
    return { userId, pipeId };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  const transactionId = await t.run(async ctx => {
    const operationId = await insertFinancialOperation(ctx, { userId: ids.userId, title: "lunch", value: -100, occurredAt: 1,
      structure: { type: "expense", from: ids.pipeId } });
    return ctx.db.insert("transactions", { operationId, userId: ids.userId, from: ids.pipeId, kind: "expense", title: "lunch", value: -100, date: 1 });
  });
  const correctionIds = await t.run(async ctx => {
    const result = [];
    for (let i = 0; i < count; i++) result.push(await ctx.db.insert("transactionCorrections", {
      transactionId, userId: ids.userId, editedAt: 100 + i,
      previous: { title: "old", value: -50, date: 1 }, current: { title: "lunch", value: -100, date: 1 },
    }));
    return result;
  });
  return { t, auth, transactionId, correctionIds, ...ids };
}

it("backfills only exact ownership, without changing correction snapshots or accounting", async () => {
  const { t, transactionId } = await setup(3);
  const before = await t.run(async ctx => ({
    pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(),
    transactions: await ctx.db.query("transactions").collect(), reports: await ctx.db.query("monthlySpendingStats").collect(),
    corrections: await ctx.db.query("transactionCorrections").collect(),
  }));
  const result = await t.mutation(migrate, batch);
  expect(result).toMatchObject({ processed: 3, isDone: true });
  const operationId = before.transactions.find(row => row._id === transactionId)!.operationId;
  const migrated = before.corrections.map(row => ({ ...row, operationId }));
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(migrated);
  await t.mutation(migrate, batch);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(migrated);
  expect(await t.query(audit, { paginationOpts: { numItems: 100, cursor: null } })).toMatchObject({
    page: migrated.map(row => ({ correctionId: row._id, status: "linked", operationId })),
  });
  expect(await t.run(async ctx => ({
    pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect(),
    transactions: await ctx.db.query("transactions").collect(), reports: await ctx.db.query("monthlySpendingStats").collect(),
  }))).toEqual({ pipes: before.pipes, events: before.events, transactions: before.transactions, reports: before.reports });
});

it.each([
  { type: "transfer" as const, value: -100 }, { type: "transfer" as const, value: 100 },
  { type: "payByTransfer" as const, value: -100 }, { type: "payByTransfer" as const, value: 100 },
])("links a valid paired $type operation with value $value without rewriting its entries", async ({ type, value }) => {
  const { t, userId, pipeId, transactionId, correctionIds } = await setup();
  const operationId = await t.run(async ctx => {
    const target = await ctx.db.insert("pipes", { userId, name: "Target", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
    const operationId = await insertFinancialOperation(ctx, { userId, title: "lunch", value, occurredAt: 1,
      structure: type === "transfer" ? { type, from: pipeId, to: target } : { type, from: pipeId, paidFrom: target } });
    await ctx.db.patch("transactions", transactionId, { operationId, value, kind: type === "transfer" ? "transfer" : "expense",
      ...(type === "transfer" ? { to: target } : { paidFrom: target }) });
    return operationId;
  });
  const before = await t.run(ctx => ctx.db.query("events").collect());
  await t.mutation(migrate, batch);
  expect(await t.run(ctx => ctx.db.get("transactionCorrections", correctionIds[0]))).toMatchObject({ operationId });
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(before);
});

it("audits bounded pages without changing data", async () => {
  const { t, correctionIds } = await setup(3);
  const first = await t.query(audit, { paginationOpts: { numItems: 2, cursor: null } });
  expect(first).toMatchObject({ isDone: false, page: correctionIds.slice(0, 2).map(correctionId => ({ correctionId, status: "ready" })) });
  const last = await t.query(audit, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
  expect(last).toMatchObject({ isDone: true, page: [{ correctionId: correctionIds[2], status: "ready" }] });
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  expect(corrections.every(correction => correction.operationId === undefined)).toBe(true);
  await expect(t.query(audit, { paginationOpts: { numItems: 101, cursor: null } })).rejects.toThrow("Invalid audit page size");
});

it("rejects end cursors that could override the requested audit page size", async () => {
  const { t } = await setup(3);
  const page = await t.query(audit, { paginationOpts: { numItems: 2, cursor: null } });
  await expect(t.query(audit, {
    paginationOpts: { numItems: 1, cursor: null, endCursor: page.continueCursor },
  })).rejects.toThrow("Audit end cursors are not supported");
});

it.each(["missing_transaction", "foreign_transaction", "missing_operation_link", "missing_or_foreign_operation", "invalid_operation"] as const)(
  "audits %s and rolls back the entire backfill page without guessing or deleting", async problem => {
    const { t, transactionId, correctionIds } = await setup(2);
    const affectedTransaction = await t.run(async ctx => {
      const transaction = (await ctx.db.get("transactions", transactionId))!;
      const affectedId = await ctx.db.insert("transactions", { userId: transaction.userId, from: transaction.from, title: transaction.title,
        value: transaction.value, date: transaction.date, kind: transaction.kind, operationId: transaction.operationId });
      await ctx.db.patch("transactionCorrections", correctionIds[1], { transactionId: affectedId });
      if (problem === "missing_transaction") await ctx.db.delete("transactions", affectedId);
      if (problem === "foreign_transaction") {
        const foreign = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
        await ctx.db.patch("transactions", affectedId, { userId: foreign });
      }
      if (problem === "missing_operation_link") await ctx.db.patch("transactions", affectedId, { operationId: undefined });
      if (problem === "missing_or_foreign_operation" || problem === "invalid_operation") {
        const event = (await ctx.db.get("events", transaction.operationId!))!;
        const invalidId = await ctx.db.insert("events", { userId: event.userId, pipeId: event.pipeId, title: "lunch", value: -100,
          occurredAt: 1, type: "transfer", targetPipeId: event.pipeId });
        await ctx.db.patch("events", invalidId, { operationId: invalidId });
        await ctx.db.patch("transactions", affectedId, { operationId: invalidId });
        if (problem === "missing_or_foreign_operation") await ctx.db.delete("events", invalidId);
      }
      return affectedId;
    });
    const before = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
    const page = await t.query(audit, { paginationOpts: { numItems: 100, cursor: null } });
    expect(page.page[1]).toMatchObject({ correctionId: correctionIds[1], transactionId: affectedTransaction, status: problem });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await expect(t.mutation(migrate, batch)).rejects.toThrow(problem); } finally { spy.mockRestore(); }
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(before);
  },
);

it("rolls back correction ownership in a dry run", async () => {
  const { t } = await setup();
  const before = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
  try { await expect(t.mutation(migrate, { ...batch, dryRun: true })).rejects.toThrow("DRY RUN"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(before);
});

it("continues bounded migration pages alongside operation-only corrections", async () => {
  const { t, auth, transactionId } = await setup(5);
  const first = await t.mutation(migrate, { ...batch, batchSize: 2 });
  expect(first).toMatchObject({ processed: 2, isDone: false });
  const operationId = (await t.run(ctx => ctx.db.get("transactions", transactionId)))!.operationId!;
  await auth.mutation(api.financialOperations.edit, { operationId, title: "dinner", value: -100, date: 1 });
  expect(await t.mutation(migrate, { ...batch, cursor: first.continueCursor })).toMatchObject({ processed: 4, isDone: true });
  const transaction = await t.run(ctx => ctx.db.get("transactions", transactionId));
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  expect(corrections).toHaveLength(6);
  expect(corrections.every(row => row.operationId === transaction!.operationId)).toBe(true);
});

it("does not overwrite a conflicting existing correction link even for equal financial snapshots", async () => {
  const { t, userId, pipeId, correctionIds } = await setup();
  await t.run(async ctx => {
    const otherOperation = await insertFinancialOperation(ctx, { userId, title: "lunch", value: -100, occurredAt: 1,
      structure: { type: "expense", from: pipeId } });
    await ctx.db.patch("transactionCorrections", correctionIds[0], { operationId: otherOperation });
  });
  const before = await t.run(ctx => ctx.db.get("transactionCorrections", correctionIds[0]));
  expect(await t.query(audit, { paginationOpts: { numItems: 100, cursor: null } })).toMatchObject({
    page: [{ correctionId: correctionIds[0], status: "conflicting_operation_link" }],
  });
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await expect(t.mutation(migrate, batch)).rejects.toThrow("conflicting_operation_link"); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.get("transactionCorrections", correctionIds[0]))).toEqual(before);
});

it.each(["mirror", "lifecycle", "foreign", "incomplete", "foreign_counterpart"] as const)("does not migrate a %s operation link", async problem => {
  const { t, userId, pipeId, transactionId, correctionIds } = await setup();
  await t.run(async ctx => {
    const otherPipe = await ctx.db.insert("pipes", { userId, name: "Target", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const operation = problem === "lifecycle"
      ? await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId, type: "pipe_creation", name: "Boiler", icon: "wallet",
          pipeType: "boiler", ancestorIds: [], occurredAt: 1 } })
      : await insertHistoryOperation(ctx, {
          canonicalEvent: { userId, pipeId, type: "transfer", title: "lunch", value: -100, occurredAt: 1, targetPipeId: otherPipe },
          counterpart: { userId, pipeId: otherPipe, type: "transfer", title: "lunch", value: 100, occurredAt: 1, targetPipeId: pipeId },
        });
    await ctx.db.patch("transactions", transactionId, { operationId: problem === "mirror" ? operation.counterpart!.id : operation.canonicalEvent.id });
    if (problem === "incomplete") await ctx.db.delete("events", operation.counterpart!.id);
    if (problem === "foreign" || problem === "foreign_counterpart") {
      const foreign = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
      await ctx.db.patch("events", problem === "foreign" ? operation.canonicalEvent.id : operation.counterpart!.id, { userId: foreign });
    }
  });
  const expected = problem === "foreign" || problem === "mirror" ? "missing_or_foreign_operation" : "invalid_operation";
  const before = await t.run(ctx => ctx.db.get("transactionCorrections", correctionIds[0]));
  expect(await t.query(audit, { paginationOpts: { numItems: 100, cursor: null } })).toMatchObject({ page: [{ status: expected }] });
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await expect(t.mutation(migrate, batch)).rejects.toThrow(expected); } finally { spy.mockRestore(); }
  expect(await t.run(ctx => ctx.db.get("transactionCorrections", correctionIds[0]))).toEqual(before);
});
