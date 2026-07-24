// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TransactionsProvider,
  useTransactions,
  getLeafDescendantIds,
} from "./TransactionsContext";
import type { Doc, Id } from "@convex/_generated/dataModel";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { transactions: { listTransactions: {} } },
}));

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

function TestConsumer() {
  const { transactions, isLoading, pipeIds } = useTransactions();
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
    </div>
  );
}

function pipe(id: string, parentId?: string): Doc<"pipes"> {
  return {
    _id: id as Id<"pipes">,
    _creationTime: 0,
    userId: "" as Id<"users">,
    parentId: parentId as Id<"pipes"> | undefined,
    name: "",
    icon: "",
    priority: 0,
    capacity: undefined,
    fed: undefined,
    spent: undefined,
    description: undefined,
    resetOn: undefined,
    resetCron: undefined,
  };
}

function buildChildrenMap(
  pipes: Doc<"pipes">[],
): Map<Id<"pipes">, Doc<"pipes">[]> {
  const map = new Map<Id<"pipes">, Doc<"pipes">[]>();
  for (const p of pipes) {
    if (p.parentId) {
      const siblings = map.get(p.parentId) ?? [];
      siblings.push(p);
      map.set(p.parentId, siblings);
    }
  }
  return map;
}

describe("getLeafDescendantIds", () => {
  it("returns null when selectedPipeId is null", () => {
    const map = buildChildrenMap([]);
    expect(getLeafDescendantIds(map, null)).toBeNull();
  });

  it("returns [pipeId] for a leaf pipe (no children)", () => {
    const pipes = [pipe("a")];
    const map = buildChildrenMap(pipes);
    expect(getLeafDescendantIds(map, "a" as Id<"pipes">)).toEqual([
      "a" as Id<"pipes">,
    ]);
  });

  it("returns direct children for a parent with only leaf children", () => {
    const pipes = [pipe("b", "a"), pipe("c", "a")];
    const map = buildChildrenMap(pipes);
    const result = getLeafDescendantIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual(
      ["b" as Id<"pipes">, "c" as Id<"pipes">].sort(),
    );
  });

  it("returns nested leaf descendants (DFS)", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "b"),
      pipe("e", "a"),
    ];
    const map = buildChildrenMap(pipes);
    const result = getLeafDescendantIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual(
      ["c" as Id<"pipes">, "d" as Id<"pipes">, "e" as Id<"pipes">].sort(),
    );
  });

  it("skips parent children, only returns leaves", () => {
    const pipes = [
      pipe("b", "a"),
      pipe("c", "b"),
      pipe("d", "c"),
      pipe("e", "a"),
    ];
    const map = buildChildrenMap(pipes);
    const result = getLeafDescendantIds(map, "a" as Id<"pipes">);
    expect(result!.sort()).toEqual([
      "d" as Id<"pipes">,
      "e" as Id<"pipes">,
    ]);
  });

  it("returns [pipeId] when selected pipe has no known parent entry", () => {
    const map = buildChildrenMap([]);
    expect(getLeafDescendantIds(map, "x" as Id<"pipes">)).toEqual([
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
    expect(getLeafDescendantIds(map, "a" as Id<"pipes">)).toEqual([
      "e" as Id<"pipes">,
    ]);
  });
});

describe("TransactionsProvider", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUsePipeSelection.mockReset();
  });

  it("shows loading when allPipes is undefined", () => {
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
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      "skip",
    );
  });

  it("passes null pipeIds when no pipe is selected", () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a")],
      childrenByParent: new Map(),
      selectedPipePath: [],
    });

    mockUseQuery.mockReturnValue(undefined);

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toBe("null");
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      { pipeIds: undefined },
    );
  });

  it("passes leaf pipeIds when a parent pipe is selected", () => {
    const pipes = [pipe("b", "a"), pipe("c", "a")];
    const map = buildChildrenMap(pipes);

    mockUsePipeSelection.mockReturnValue({
      allPipes: pipes,
      childrenByParent: map,
      selectedPipePath: ["a" as Id<"pipes">],
    });

    mockUseQuery.mockReturnValue([]);

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toContain("b");
    expect(screen.getByTestId("pipe-ids").textContent).toContain("c");
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pipeIds: expect.arrayContaining(["b" as Id<"pipes">, "c" as Id<"pipes">]) }),
    );
  });

  it("passes [selectedPipeId] when a leaf pipe is selected", () => {
    const pipes = [pipe("a"), pipe("b", "a")];
    const map = buildChildrenMap(pipes);

    mockUsePipeSelection.mockReturnValue({
      allPipes: pipes,
      childrenByParent: map,
      selectedPipePath: ["b" as Id<"pipes">],
    });

    mockUseQuery.mockReturnValue([]);

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("pipe-ids").textContent).toBe("b");
  });

  it("exposes transactions from useQuery", () => {
    mockUsePipeSelection.mockReturnValue({
      allPipes: [pipe("a")],
      childrenByParent: new Map(),
      selectedPipePath: [],
    });

    const mockTxs = [
      { _id: "tx1", title: "test", value: -50, date: 1000, pipeId: "a" as Id<"pipes">, userId: "" as Id<"users">, _creationTime: 0 },
    ];
    mockUseQuery.mockReturnValue(mockTxs);

    render(
      <TransactionsProvider>
        <TestConsumer />
      </TransactionsProvider>,
    );

    expect(screen.getByTestId("transactions-count").textContent).toBe("1");
    expect(screen.getByTestId("is-loading").textContent).toBe("false");
  });
});
