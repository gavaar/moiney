// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { useMonthlyPipeSpending } from "./useMonthlyPipeSpending";

const mocks = vi.hoisted(() => ({
  spending: undefined as { pipeId: string; netSpendingCents: number }[] | undefined,
  periodStart: Date.UTC(2026, 6, 1),
  head: undefined as { events: { pipeId: string; ancestorIds: string[] }[]; cursor: string | null; isDone: boolean } | undefined,
  query: vi.fn(),
}));
const root = "root" as Id<"pipes">;
vi.mock("./CurrentMonthReportContext", () => ({
  useCurrentMonthReportContext: () => ({
    report: mocks.spending ? { periodStart: mocks.periodStart } : undefined,
    pipeSpending: mocks.spending,
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    isLoading: false,
    childrenByParent: new Map([["root", [{ id: "child" }]], ["child", [{ id: "grandchild" }]]]),
  }),
}));
vi.mock("convex/react", () => {
  const client = { query: mocks.query };
  return { useQuery: () => mocks.head, useConvex: () => client };
});
vi.mock("@convex/_generated/api", () => ({ api: { events: { deletedPipes: "deletedPipes" } } }));

beforeEach(() => {
  mocks.spending = undefined;
  mocks.periodStart = Date.UTC(2026, 6, 1);
  mocks.head = undefined;
  mocks.query.mockReset();
});

it("waits for complete monthly totals and ancestry, then includes live and deleted descendants exactly once", () => {
  const { result, rerender } = renderHook(() => useMonthlyPipeSpending(root, Date.UTC(2026, 6, 15)));
  expect(result.current).toBeUndefined();
  mocks.spending = [
    { pipeId: "root", netSpendingCents: 100 },
    { pipeId: "child", netSpendingCents: 200 },
    { pipeId: "grandchild", netSpendingCents: -50 },
    { pipeId: "deleted", netSpendingCents: 300 },
    { pipeId: "unrelated", netSpendingCents: 900 },
  ];
  rerender();
  expect(result.current).toBeUndefined();
  mocks.head = {
    events: [
      { pipeId: "deleted", ancestorIds: ["root", "old-parent"] },
      { pipeId: "child", ancestorIds: ["root"] },
    ],
    cursor: null,
    isDone: true,
  };
  rerender();
  expect(result.current).toBe(550);
  mocks.spending = [];
  rerender();
  expect(result.current).toBe(0);
});

it("finishes deletion-catalog pagination and refreshes scope when the catalog changes", async () => {
  mocks.spending = [{ pipeId: "deleted", netSpendingCents: -400 }];
  mocks.head = { events: [], cursor: "next", isDone: false };
  mocks.query.mockResolvedValue({ events: [{ pipeId: "deleted", ancestorIds: ["root"] }], cursor: null, isDone: true });
  const { result, rerender } = renderHook(() => useMonthlyPipeSpending(root, Date.UTC(2026, 6, 15)));
  expect(result.current).toBeUndefined();
  await waitFor(() => expect(result.current).toBe(-400));
  expect(mocks.query).toHaveBeenCalledWith("deletedPipes", { cursor: "next", limit: 100 });
  mocks.head = { events: [], cursor: null, isDone: true };
  rerender();
  expect(result.current).toBe(0);
});

it("never combines a previous month's totals with a new month's clock", () => {
  mocks.spending = [{ pipeId: "root", netSpendingCents: 100 }];
  mocks.head = { events: [], cursor: null, isDone: true };
  const { result, rerender } = renderHook(() => useMonthlyPipeSpending(root, Date.UTC(2026, 7, 1)));
  expect(result.current).toBeUndefined();
  mocks.periodStart = Date.UTC(2026, 7, 1);
  rerender();
  expect(result.current).toBe(100);
});

it.each(["resolve", "reject"])("ignores a retired catalog read that later %ss", async (outcome) => {
  mocks.spending = [{ pipeId: "deleted", netSpendingCents: 400 }];
  const oldPage = Promise.withResolvers<NonNullable<typeof mocks.head>>();
  const newPage = Promise.withResolvers<NonNullable<typeof mocks.head>>();
  mocks.query.mockReturnValueOnce(oldPage.promise).mockReturnValueOnce(newPage.promise);
  mocks.head = { events: [], cursor: "old", isDone: false };
  const { result, rerender } = renderHook(() => useMonthlyPipeSpending(root, Date.UTC(2026, 6, 15)));
  expect(result.current).toBeUndefined();

  mocks.head = { events: [], cursor: "new", isDone: false };
  rerender();
  await act(async () => {
    newPage.resolve({ events: [{ pipeId: "deleted", ancestorIds: ["root"] }], cursor: null, isDone: true });
  });
  expect(result.current).toBe(400);

  await act(async () => {
    if (outcome === "resolve") oldPage.resolve({ events: [], cursor: null, isDone: true });
    else oldPage.reject(new Error("Retired read failed"));
  });
  expect(result.current).toBe(400);
});
