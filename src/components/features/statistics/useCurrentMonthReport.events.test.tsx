// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { convexTest } from "convex-test";
import { getFunctionName, type FunctionReturnType, type FunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import schema from "@convex/schema";
import { modules } from "@convex/test.setup";
import { insertHistoryOperation } from "@convex/lib/events/persistence";
import type { PipeModel } from "@features/pipes/data/pipes";
import { useCurrentMonthReport } from "./useCurrentMonthReport";

type ReportPages = FunctionReturnType<typeof api.monthlySpendingStats.eventMonthPage>["page"];
const mocks = vi.hoisted(() => ({
  pages: new Map<string, ReportPages>(),
  status: "CanLoadMore",
  loadMore: vi.fn(),
  allPipes: [] as PipeModel[],
  periodStart: Date.UTC(2026, 5, 1),
}));

vi.mock("@/lib/useUtcMonthStart", () => ({ useUtcMonthStart: () => mocks.periodStart }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: mocks.allPipes }) }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: (query: FunctionReference<"query">) => ({
    results: mocks.pages.get(getFunctionName(query)) ?? [],
    status: mocks.status,
    loadMore: mocks.loadMore,
  }),
}));

it("publishes event-derived live metrics only after all pages, independently of legacy transactions", async () => {
  const t = convexTest(schema, modules);
  const { userId, root, leaf } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "live", email: "live@example.com", password: "hash" });
    const fields = { userId, name: "Root", icon: "wallet", priority: 0, capacity: 0, fed: 2000, spent: 0 };
    const root = await ctx.db.insert("pipes", fields);
    const leaf = await ctx.db.insert("pipes", { ...fields, name: "Groceries", parentId: root, capacity: 500, fed: 500 });
    const base = { userId, pipeId: leaf, title: "lunch", occurredAt: mocks.periodStart };
    await insertHistoryOperation(ctx, {
      canonicalEvent: { ...base, type: "third_party_transaction", targetPipeId: root, value: -800 },
      counterpart: { ...base, pipeId: root, type: "transaction", targetPipeId: leaf, value: 800 },
    });
    await insertHistoryOperation(ctx, { canonicalEvent: { ...base, type: "transaction", value: 100 } });
    await insertHistoryOperation(ctx, { canonicalEvent: { ...base, pipeId: root, type: "feed", value: 1500 } });
    // Divergent legacy data must not contribute to the live event report.
    return { userId, root, leaf };
  });
  const auth = t.withIdentity({ subject: userId });
  const pages: ReportPages = [];
  let cursor: string | null = null;
  for (let i = 0; i < 10; i++) {
    const result: FunctionReturnType<typeof api.monthlySpendingStats.eventMonthPage> = await auth.query(api.monthlySpendingStats.eventMonthPage, {
      periodStart: mocks.periodStart, paginationOpts: { numItems: 1, cursor },
    });
    pages.push(...result.page);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  expect(pages).toHaveLength(4);
  mocks.pages = new Map([
    [getFunctionName(api.monthlySpendingStats.eventMonthPage), pages.slice(0, 1)],
  ]);
  mocks.allPipes = [
    { id: root, name: "Root", icon: "wallet", priority: 0, capacity: 0, fed: 2000, spent: 0 },
    { id: leaf, parentId: root, name: "Groceries", icon: "wallet", priority: 0, capacity: 500, fed: 500, spent: 0 },
  ];
  mocks.status = "CanLoadMore";
  const { result, rerender } = renderHook(() => useCurrentMonthReport());
  expect(result.current.report).toBeUndefined();

  mocks.pages.set(getFunctionName(api.monthlySpendingStats.eventMonthPage), pages);
  mocks.status = "Exhausted";
  rerender();
  expect(result.current.report).toMatchObject({
    totalIncomeCents: 1500, grossSpendingCents: 800, refundCents: 100,
    spendingTransactionCount: 1, refundTransactionCount: 1,
    volumeCents: 2000, producedCents: 2000,
    largestSpendingTransactions: [{ title: "lunch", amountCents: 800 }],
    mostRepeatedTransaction: { title: "lunch", count: 2, netSpendingCents: 700 },
    offenders: [{ pipeId: leaf, name: "Groceries", netSpendingCents: 700, capacityCents: 500, overageCents: 200 }],
  });
});
