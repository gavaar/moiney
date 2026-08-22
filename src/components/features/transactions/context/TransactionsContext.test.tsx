// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  TransactionsProvider,
  useTransactions,
  getSubtreePipeIds,
} from "./TransactionsContext";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";

const mockUseQuery = vi.fn();
const mockConvexQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useConvex: () => ({ query: mockConvexQuery }),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { transactions: { listTransactions: {} } },
}));

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
}));

const mockUseTransactionCache = vi.fn();
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({
  useTransactionCache: () => mockUseTransactionCache(),
}));

function TestConsumer() {
  const { transactions, isLoading, pipeIds, refresh } = useTransactions();
  return (
    <div>
      <span data-testid="is-loading">
        {isLoading ? "true" : "false"}
      </span>
      <span data-testid="transactions-count">
        {transactions === undefined ? "undefined" : String(transactions.length)}
      </span>
      <span data-testid="pipe-ids">
        {pipeIds === undefined
          ? "undefined"
          : pipeIds === null
            ? "null"
        : pipeIds.join(",")}
      </span>
      <button onClick={refresh}>refresh</button>
    </div>
  );
}

function pipe(id: string, parentId?: string): PipeModel {
  return {
    id: id as Id<"pipes">,
    parentId: parentId as Id<"pipes"> | undefined,
    name: "",
    icon: "",
    priority: 0,
    capacity: 0,
    fed: 0,
    spent: 0,
    description: undefined,
  };
}

function buildChildrenMap(
  pipes: PipeModel[],
): Map<Id<"pipes">, PipeModel[]> {
  const map = new Map<Id<"pipes">, PipeModel[]>();
  for (const p of pipes) {
    if (p.parentId) {
      const siblings = map.get(p.parentId) ?? [];
      siblings.push(p);
      map.set(p.parentId, siblings);
    }
  }
  return map;
}

describe("getSubtreePipeIds", () => {
  it("includes the selected pipe and every descendant", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "a"),
    ];
    const map = buildChildrenMap(pipes);

    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)?.sort()).toEqual(
      ["a", "b", "c", "d"].sort(),
    );
  });

  it("returns null when selectedPipeId is null", () => {
    const map = buildChildrenMap([]);
    expect(getSubtreePipeIds(map, null)).toBeNull();
  });

  it("returns [pipeId] for a leaf pipe (no children)", () => {
    const pipes = [pipe("a")];
    const map = buildChildrenMap(pipes);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual([
      "a" as Id<"pipes">,
    ]);
  });

  it("returns the selected parent and direct children", () => {
    const pipes = [pipe("b", "a"), pipe("c", "a")];
    const map = buildChildrenMap(pipes);
    const result = getSubtreePipeIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual(
      ["a" as Id<"pipes">, "b" as Id<"pipes">, "c" as Id<"pipes">].sort(),
    );
  });

  it("returns nested descendants in DFS order", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "b"),
      pipe("e", "a"),
    ];
    const map = buildChildrenMap(pipes);
    const result = getSubtreePipeIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual(
      ["a", "b", "c", "d", "e"].sort(),
    );
  });

  it("returns parents and leaves", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "c"),
      pipe("e", "a"),
    ];
    const map = buildChildrenMap(pipes);
    const result = getSubtreePipeIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual(["a", "b", "c", "d", "e"].sort());
  });

  it("returns [pipeId] when selected pipe has no known parent entry", () => {
    const map = buildChildrenMap([]);
    expect(getSubtreePipeIds(map, "x" as Id<"pipes">)).toEqual([
      "x" as Id<"pipes">,
    ]);
  });

  it("handles a deep chain", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "c"),
      pipe("e", "d"),
    ];
    const map = buildChildrenMap(pipes);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });
});

describe("TransactionsProvider", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockConvexQuery.mockReset();
    mockUsePipeSelection.mockReset();
    mockUseTransactionCache.mockReset();
    mockUseTransactionCache.mockReturnValue({
      cache: null,
      isHydrating: false,
      read: () => ({
        transactions: [],
        complete: false,
        hasMore: false,
        updatedAt: 0,
      }),
      replace: vi.fn(),
    });
    mockConvexQuery.mockResolvedValue([]);
  });

  it("uses a complete selected-scope snapshot without opening a Convex query", async () => {
    const cachedTransaction = {
      id: "cached-1" as Id<"transactions">,
      createdAt: 1,
      title: "cached",
      value: -100,
      date: 1,
      kind: "expense" as const,
      from: "b" as Id<"pipes">,
    };
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a"), pipe("b", "a")],
      childrenByParent: buildChildrenMap([pipe("a"), pipe("b", "a")]),
      selectedPipePath: ["a" as Id<"pipes">],
    });
    mockUseTransactionCache.mockReturnValue({
      isHydrating: false,
      cache: {},
      read: () => ({
        transactions: [cachedTransaction],
        complete: true,
        hasMore: false,
        updatedAt: 1,
      }),
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("transactions-count").textContent).toBe("1");
    expect(mockUseQuery).not.toHaveBeenCalled();
    expect(mockConvexQuery).not.toHaveBeenCalled();
  });

  it("shows loading when allPipes is undefined", async () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: undefined,
      childrenByParent: new Map(),
      selectedPipePath: [],
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("is-loading").textContent).toBe("true");
    expect(screen.getByTestId("transactions-count").textContent).toBe("undefined");
    expect(screen.getByTestId("pipe-ids").textContent).toBe("undefined");
    expect(mockConvexQuery).not.toHaveBeenCalled();
  });

  it("refreshes the current scope with one explicit query", async () => {
    const pipes = [pipe("a"), pipe("b", "a")];
    mockUsePipeSelection.mockReturnValue({
      allPipes: pipes,
      childrenByParent: buildChildrenMap(pipes),
      selectedPipePath: ["a" as Id<"pipes">],
    });
    mockUseTransactionCache.mockReturnValue({
      cache: {},
      isHydrating: false,
      read: () => ({ transactions: [], complete: true, hasMore: false, updatedAt: 1 }),
      replace: vi.fn(),
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );
    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(mockConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      { pipeIds: ["a", "b"] },
    ));
  });

  it("passes null pipeIds when no pipe is selected", async () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a")],
      childrenByParent: new Map(),
      selectedPipePath: [],
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toBe("null");
    await waitFor(() => expect(mockConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      {},
    ));
  });

  it("passes the selected parent and descendants", async () => {
    const pipes = [pipe("a"), pipe("b", "a"), pipe("c", "a")];
    const map = buildChildrenMap(pipes);

    mockUsePipeSelection.mockReturnValue({
      allPipes: pipes,
      childrenByParent: map,
      selectedPipePath: ["a" as Id<"pipes">],
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toBe("a,b,c");
    await waitFor(() => expect(mockConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      { pipeIds: ["a", "b", "c"] },
    ));
  });

  it("passes [selectedPipeId] when a leaf pipe is selected", async () => {
    const pipes = [pipe("a"), pipe("b", "a")];
    const map = buildChildrenMap(pipes);

    mockUsePipeSelection.mockReturnValue({
      allPipes: pipes,
      childrenByParent: map,
      selectedPipePath: ["b" as Id<"pipes">],
    });

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toBe("b");
    await waitFor(() => expect(mockConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      { pipeIds: ["b"] },
    ));
  });

  it("exposes transactions from useQuery", async () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a")],
      childrenByParent: new Map(),
      selectedPipePath: [],
    });

    const mockTxs = [
      { _id: "tx1", title: "test", value: -50, date: 1000, kind: "expense", from: "a" as Id<"pipes">, userId: "" as Id<"users">, _creationTime: 0 },
    ];
    mockConvexQuery.mockResolvedValue(mockTxs);

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("transactions-count").textContent).toBe("1");
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });
  });
});
