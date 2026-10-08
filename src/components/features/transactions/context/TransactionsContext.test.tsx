// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  TransactionsProvider,
  useTransactions,
} from "./TransactionsContext";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "@features/transactions/data/transactions";

const mockConvexQuery = vi.fn();
vi.mock("convex/react", () => ({
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
  const { transactions, error, isLoading, pipeIds, refresh } = useTransactions();
  return (
    <div>
      <span data-testid="is-loading">
        {isLoading ? "true" : "false"}
      </span>
      <span data-testid="transactions-count">
        {transactions === undefined ? "undefined" : String(transactions.length)}
      </span>
      <span data-testid="transactions-error">{error ?? "none"}</span>
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

describe("TransactionsProvider", () => {
  beforeEach(() => {
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

  it("fails loudly when used outside TransactionsProvider", () => {
    expect(() => render(<TestConsumer />)).toThrowError(
      "useTransactions must be used within TransactionsProvider",
    );
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

  it.each(["account", "scope"] as const)("never exposes retired rows after a %s change, including delayed refreshes", async (change) => {
    const pipes = [pipe("a"), pipe("b")];
    const selection = { allPipes: pipes, childrenByParent: buildChildrenMap(pipes), selectedPipePath: [pipes[0].id] };
    mockUsePipeSelection.mockReturnValue(selection);
    const cachedTransaction: TransactionModel = {
      id: "cached" as Id<"transactions">, createdAt: 1, date: 1,
      title: "old", value: -100, kind: "expense", from: pipes[0].id,
    };
    const replace = vi.fn();
    mockUseTransactionCache.mockReturnValue({
      accountKey: "account-1", isHydrating: false, replace,
      read: () => ({ transactions: [cachedTransaction], complete: true, hasMore: false, updatedAt: 1 }),
    });
    const observedRows = vi.fn();
    function ObservingConsumer() {
      observedRows(useTransactions().transactions);
      return <TestConsumer />;
    }
    let finish!: (rows: []) => void;
    mockConvexQuery.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { rerender } = render(<TransactionsProvider><ObservingConsumer /></TransactionsProvider>);
    expect(observedRows).toHaveBeenLastCalledWith([cachedTransaction]);
    fireEvent.click(screen.getByText("refresh"));
    observedRows.mockClear();

    mockUseTransactionCache.mockReturnValue({
      accountKey: change === "account" ? "account-2" : "account-1",
      isHydrating: change === "account", replace,
      read: () => ({ transactions: [], complete: true, hasMore: false, updatedAt: 1 }),
    });
    if (change === "scope") mockUsePipeSelection.mockReturnValue({ ...selection, selectedPipePath: [pipes[1].id] });
    rerender(<TransactionsProvider><ObservingConsumer /></TransactionsProvider>);
    expect(observedRows.mock.calls.every(([rows]) => rows === undefined)).toBe(true);
    await act(async () => finish([]));
    expect(observedRows.mock.calls.every(([rows]) => rows === undefined)).toBe(true);
    expect(replace).not.toHaveBeenCalled();
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

  it("exposes transactions from an explicit query", async () => {
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

  it("exposes a stable error when the explicit query fails", async () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a")],
      childrenByParent: new Map(),
      selectedPipePath: [],
    });
    mockConvexQuery.mockRejectedValue(new Error("network failure"));

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("transactions-error").textContent).toBe(
        "Unable to load transactions.",
      ),
    );
  });
});
