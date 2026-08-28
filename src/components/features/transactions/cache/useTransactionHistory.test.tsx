// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  useTransactionHistory,
  type TransactionHistoryFilters,
} from "./useTransactionHistory";

const mockQuery = vi.fn();
const mockConvex = { query: mockQuery };
vi.mock("convex/react", () => ({
  useConvex: () => mockConvex,
}));

const mockCache = vi.fn();
vi.mock("./TransactionCacheContext", () => ({
  useTransactionCache: () => mockCache(),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { transactions: { listTransactionsPaginated: {} } },
}));

const cachedTransaction: TransactionModel = {
  id: "cached" as Id<"transactions">,
  createdAt: 2,
  title: "cached",
  value: -100,
  date: 2,
  kind: "expense",
  from: "pipe-1" as Id<"pipes">,
};

function Consumer({ filters }: { filters?: TransactionHistoryFilters }) {
  const { transactions, error, isLoading, loadMore, loadMoreStatus, refresh } =
    useTransactionHistory(filters);
  return (
    <div>
      <span data-testid="count">{transactions?.length ?? "undefined"}</span>
      <span data-testid="first-id">{transactions?.[0]?.id ?? "none"}</span>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="status">{loadMoreStatus}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <button onClick={loadMore}>load more</button>
      <button onClick={refresh}>refresh</button>
    </div>
  );
}

describe("useTransactionHistory", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCache.mockReset();
    mockCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => ({
        transactions: [cachedTransaction],
        complete: true,
        hasMore: true,
        updatedAt: 1,
      }),
      replace: vi.fn(),
      append: vi.fn(),
      mergeHead: vi.fn(),
    });
  });

  it("renders a complete cached history without querying", () => {
    render(<Consumer />);

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("status").textContent).toBe("CanLoadMore");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("seeds a cache miss with 100 rows", async () => {
    mockCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => ({ transactions: [], complete: false, hasMore: false, updatedAt: 0 }),
      replace: vi.fn(),
      append: vi.fn(),
      mergeHead: vi.fn(),
    });
    mockQuery.mockResolvedValue({ page: [], continueCursor: "cursor-1", isDone: false });

    render(<Consumer />);

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { paginationOpts: { numItems: 100, cursor: null } },
    ));
  });

  it("normalizes rows returned by the previous paginated endpoint shape", async () => {
    mockCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => ({ transactions: [], complete: false, hasMore: false, updatedAt: 0 }),
      replace: vi.fn(),
      append: vi.fn(),
      mergeHead: vi.fn(),
    });
    mockQuery.mockResolvedValue({
      page: [
        {
          _id: "legacy-row",
          _creationTime: 2,
          title: "coffee",
          value: -100,
          date: 2,
          kind: "expense",
          from: "pipe-1",
          userId: "user-1",
        },
      ],
      continueCursor: "done",
      isDone: true,
    });

    render(<Consumer />);

    await waitFor(() =>
      expect(screen.getByTestId("first-id").textContent).toBe("legacy-row"),
    );
  });

  it("bypasses the snapshot and scans empty server pages for active filters", async () => {
    mockQuery
      .mockResolvedValueOnce({ page: [], continueCursor: "cursor-1", isDone: false })
      .mockResolvedValueOnce({
        page: [
          {
            id: "filtered",
            createdAt: 3,
            title: "coffee beans",
            value: -200,
            date: 20,
            kind: "expense",
            from: "pipe-1",
          },
        ],
        continueCursor: "done",
        isDone: true,
      });

    render(
      <Consumer
        filters={{
          fromDate: 10,
          toDate: 30,
          pipeIds: ["pipe-1" as Id<"pipes">],
          title: "coffee",
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.anything(), {
      paginationOpts: { numItems: 100, cursor: null },
      filters: {
        fromDate: 10,
        toDate: 30,
        pipeIds: ["pipe-1"],
        title: "coffee",
      },
    });
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.anything(), {
      paginationOpts: { numItems: 100, cursor: "cursor-1" },
      filters: {
        fromDate: 10,
        toDate: 30,
        pipeIds: ["pipe-1"],
        title: "coffee",
      },
    });
  });

  it("hides cached unfiltered rows while a newly applied filter loads", async () => {
    mockQuery.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<Consumer />);
    expect(screen.getByTestId("first-id").textContent).toBe("cached");

    rerender(<Consumer filters={{ title: "coffee" }} />);

    await waitFor(() => expect(screen.getByTestId("first-id").textContent).toBe("none"));
    expect(screen.getByTestId("loading").textContent).toBe("true");
  });

  it("exposes a stable error when the initial page fails", async () => {
    mockCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => ({ transactions: [], complete: false, hasMore: false, updatedAt: 0 }),
      replace: vi.fn(),
      append: vi.fn(),
      mergeHead: vi.fn(),
    });
    mockQuery.mockRejectedValue(new Error("network failure"));

    render(<Consumer />);

    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(
        "Unable to load transaction history.",
      ),
    );
  });

  it("loads 30 rows after cached data reaches the end", async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const cacheRead = {
      transactions: [cachedTransaction],
      complete: true,
      hasMore: true,
      updatedAt: 1,
    };
    mockCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => cacheRead,
      replace: vi.fn(),
      append,
      mergeHead: vi.fn(),
    });
    mockQuery.mockImplementation((_query, args) =>
      Promise.resolve(
        args.paginationOpts.numItems === 100
          ? { page: [], continueCursor: "cursor-2", isDone: false }
          : { page: [], continueCursor: "done", isDone: true },
      ),
    );

    render(<Consumer />);
    fireEvent.click(screen.getByText("load more"));

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { paginationOpts: { numItems: 100, cursor: null } },
    ));
    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { paginationOpts: { numItems: 30, cursor: "cursor-2" } },
    ));
    expect(append).toHaveBeenCalledTimes(2);
  });

  it("refreshes cached history only when explicitly requested", async () => {
    mockQuery.mockResolvedValue({ page: [], continueCursor: "cursor-3", isDone: false });

    render(<Consumer />);
    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { paginationOpts: { numItems: 100, cursor: null } },
    ));
  });

  it("does not let an earlier refresh overwrite newly filtered rows", async () => {
    let resolveRefresh!: (value: any) => void;
    const refreshResult = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    mockQuery
      .mockReturnValueOnce(refreshResult)
      .mockResolvedValueOnce({
        page: [
          {
            id: "filtered",
            createdAt: 3,
            title: "coffee",
            value: -100,
            date: 3,
            kind: "expense",
            from: "pipe-1",
          },
        ],
        continueCursor: "done",
        isDone: true,
      });

    const { rerender } = render(<Consumer />);
    fireEvent.click(screen.getByText("refresh"));
    rerender(<Consumer filters={{ title: "coffee" }} />);
    await waitFor(() => expect(screen.getByTestId("first-id").textContent).toBe("filtered"));

    resolveRefresh({
      page: [
        {
          id: "stale",
          createdAt: 4,
          title: "stale",
          value: -100,
          date: 4,
          kind: "expense",
        },
      ],
      continueCursor: "done",
      isDone: true,
    });

    await refreshResult;
    await waitFor(() => expect(screen.getByTestId("first-id").textContent).toBe("filtered"));
  });
});
