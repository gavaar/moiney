// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertHistoryOperation } from "../lib/events/persistence";
import { mergeMonthlySpending, mergePipeSpending, mergeTitleSpending, mostRepeatedTransaction, summarizeMonthlySpending } from "../../domain/statistics/monthlySpending";

const eventMonthPage = api.monthlySpendingStats.eventMonthPage;
const periodStart = Date.UTC(2026, 5, 1);
const periodEnd = Date.UTC(2026, 6, 1);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const otherId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const fields = { userId, name: "Pipe", icon: "wallet", priority: 0, capacity: 0, fed: 1000, spent: 0 };
    return { userId, otherId, source: await ctx.db.insert("pipes", fields), payer: await ctx.db.insert("pipes", fields) };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

describe("Convex boundaries: event monthly reporting", () => {
  it("reads owner-scoped event pages across split mirrors with inclusive month start and exclusive end", async () => {
    const { t, auth, userId, otherId, source, payer } = await setup();
    await t.run(async ctx => {
      const base = { userId, pipeId: source, title: "lunch", occurredAt: periodStart };
      await insertHistoryOperation(ctx, {
        canonicalEvent: { ...base, type: "third_party_transaction", targetPipeId: payer, value: -500 },
        counterpart: { ...base, pipeId: payer, targetPipeId: source, type: "transaction", value: 500 },
      });
      await insertHistoryOperation(ctx, { canonicalEvent: { ...base, type: "transaction", value: 100, occurredAt: periodEnd - 0.5 } });
      await insertHistoryOperation(ctx, { canonicalEvent: { ...base, type: "feed", value: 1000 } });
      await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: source, type: "pipe_creation", name: "Source", icon: "wallet", pipeType: "pipe", ancestorIds: [], occurredAt: periodStart } });
      await insertHistoryOperation(ctx, { canonicalEvent: { ...base, type: "transaction", value: -9000, occurredAt: periodEnd } });
      await insertHistoryOperation(ctx, { canonicalEvent: { ...base, type: "transaction", value: -9000, occurredAt: periodStart - 1 } });
      await insertHistoryOperation(ctx, { canonicalEvent: { ...base, userId: otherId, type: "transaction", value: -9000 } });
      await ctx.db.delete("pipes", source);
    });
    const pages: FunctionReturnType<typeof eventMonthPage>["page"] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const result: FunctionReturnType<typeof eventMonthPage> = await auth.query(eventMonthPage, { periodStart, paginationOpts: { numItems: 1, cursor } });
      pages.push(...result.page);
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(pages).toHaveLength(5);
    const summary = pages.reduce((total, page) => mergeMonthlySpending(total, page.summary), summarizeMonthlySpending([]));
    expect(summary).toMatchObject({ totalIncomeCents: 1000, grossSpendingCents: 500, refundCents: 100, spendingTransactionCount: 1, refundTransactionCount: 1, largestSpendingTransactionCents: 500 });
    expect(mergePipeSpending(...pages.map(page => page.pipeSpending))).toEqual([{ pipeId: source, netSpendingCents: 400 }]);
    expect(mostRepeatedTransaction(mergeTitleSpending(...pages.map(page => page.titleSpending)))).toEqual({ title: "lunch", count: 2, netSpendingCents: 400 });
    expect(await t.run(ctx => ctx.db.query("monthlySpendingStats").collect())).toEqual([]);
  });

  it("rejects unauthenticated, invalid month, oversized page, and incomplete identity reads", async () => {
    const { t, auth, userId, source } = await setup();
    const args = { periodStart, paginationOpts: { numItems: 100, cursor: null } };
    await expect(t.query(eventMonthPage, args)).rejects.toThrow("Not authenticated");
    await expect(auth.query(eventMonthPage, { ...args, periodStart: periodStart + 1 })).rejects.toThrow("Invalid period start");
    await expect(auth.query(eventMonthPage, { ...args, paginationOpts: { numItems: 101, cursor: null } })).rejects.toThrow("Invalid page size");
    await t.run(ctx => ctx.db.insert("events", { userId, pipeId: source, type: "transaction", value: -100, title: "incomplete", occurredAt: periodStart }));
    await expect(auth.query(eventMonthPage, args)).rejects.toThrow("missing its operation ID");
  });

  it("does not restate frozen legacy reports or change their unavailable optional metrics", async () => {
    const { t, auth, userId, source } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("monthlySpendingStats", { userId, periodStart, grossSpendingCents: 200, refundCents: 0, spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 200 });
      await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: source, type: "transaction", title: "new", value: -1000, occurredAt: periodStart } });
    });
    const before = await auth.query(api.monthlySpendingStats.getMine, { periodStart });
    expect((await auth.query(eventMonthPage, { periodStart, paginationOpts: { numItems: 100, cursor: null } })).page[0].summary.grossSpendingCents).toBe(1000);
    expect(await auth.query(api.monthlySpendingStats.getMine, { periodStart })).toEqual(before);
    expect(before).not.toHaveProperty("totalIncomeCents");
  });
});
