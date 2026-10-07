// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCurrentMonthReport } from "./useCurrentMonthReport";

const mocks = vi.hoisted(() => ({
  status: "LoadingFirstPage",
  loadMore: vi.fn(),
  results: [] as any[],
  allPipes: [
    { id: "root", name: "Feed", capacity: 0, fed: 1_000, spent: 0 },
    { id: "leaf", parentId: "root", name: "Groceries", capacity: 500, fed: 500, spent: 0 },
  ],
  args: undefined as unknown,
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: mocks.allPipes }) }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    mocks.args = args;
    return { results: mocks.results, status: mocks.status, loadMore: mocks.loadMore };
  },
}));
vi.mock("@convex/_generated/api", () => ({ api: { monthlySpendingStats: { eventMonthPage: "eventMonthPage" } } }));

beforeEach(() => {
  mocks.status = "LoadingFirstPage";
  mocks.results = [];
  mocks.loadMore.mockClear();
});

it("withholds partial pages, then merges spending, refunds and current pipe capacities", () => {
  const periodStart = new Date().setUTCDate(1);
  mocks.results = [{
    summary: { totalIncomeCents: 1_000, grossSpendingCents: 600, refundCents: 0, spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 600, largestSpendingTransactions: [{ title: "coffee", amountCents: 600 }] },
    pipeSpending: [{ pipeId: "leaf", netSpendingCents: 600 }],
    titleSpending: [{ title: "coffee", count: 1, netSpendingCents: 600 }],
  }];
  mocks.status = "CanLoadMore";
  const { result, rerender } = renderHook(() => useCurrentMonthReport());
  expect(result.current.report).toBeUndefined();
  expect(mocks.loadMore).toHaveBeenCalledWith(100);

  mocks.results = [...mocks.results, {
    summary: { totalIncomeCents: 0, grossSpendingCents: 200, refundCents: 100, spendingTransactionCount: 1, refundTransactionCount: 1, largestSpendingTransactionCents: 200, largestSpendingTransactions: [{ title: "coffee", amountCents: 200 }] },
    pipeSpending: [{ pipeId: "leaf", netSpendingCents: 100 }],
    titleSpending: [{ title: "coffee", count: 2, netSpendingCents: 100 }],
  }];
  mocks.status = "Exhausted";
  rerender();
  expect(result.current.report).toMatchObject({
    periodStart: Date.UTC(new Date(periodStart).getUTCFullYear(), new Date(periodStart).getUTCMonth(), 1),
    totalIncomeCents: 1_000, grossSpendingCents: 800, refundCents: 100,
    volumeCents: 1_000,
    nextLargestSpendingCents: [200],
    largestSpendingTransactions: [
      { title: "coffee", amountCents: 600 },
      { title: "coffee", amountCents: 200 },
    ],
    mostRepeatedTransaction: { title: "coffee", count: 3, netSpendingCents: 700 },
    offenders: [{ pipeId: "leaf", name: "Groceries", netSpendingCents: 700, capacityCents: 500, overageCents: 200 }],
  });
});

it("retains the current report and query arguments across an unchanged rerender", () => {
  mocks.status = "Exhausted";
  mocks.results = [{
    summary: { totalIncomeCents: 0, grossSpendingCents: 700, refundCents: 0, spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 700 },
    pipeSpending: [], titleSpending: [],
  }];
  const { result, rerender } = renderHook(() => useCurrentMonthReport());
  const report = result.current.report;
  expect(report?.grossSpendingCents).toBe(700);
  const args = mocks.args;

  rerender();

  expect(mocks.args).toEqual(args);
  expect(result.current.report).toEqual(report);
});

it("switches the live query to the next UTC month even when the month exceeds the native timer limit", () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 0, 1));
  try {
    renderHook(() => useCurrentMonthReport());
    expect(mocks.args).toEqual({ periodStart: Date.UTC(2026, 0, 1) });
    act(() => vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000));
    expect(mocks.args).toEqual({ periodStart: Date.UTC(2026, 1, 1) });
  } finally {
    vi.useRealTimers();
  }
});
