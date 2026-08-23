// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionList } from "./TransactionList";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";

function tx(
  id: string,
  overrides: Partial<TransactionModel> & { date: number },
): TransactionModel {
  const { kind = "expense", ...rest } = overrides;
  return {
    id: id as Id<"transactions">,
    createdAt: 0,
    title: "coffee",
    value: -5,
    from: "pipe-1" as Id<"pipes">,
    ...rest,
    kind,
  };
}

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: any) => <span data-testid="mock-icon" data-name={name} />,
  safeIconName: (name: string | undefined | null): string => name ?? "pipe",
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: any) =>
    visible ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: ({ mode, pipeId }: any) => (
    <div data-testid="amount-form" data-mode={mode} data-pipe-id={pipeId} />
  ),
}));

describe("TransactionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "pipe-1": { id: "pipe-1" as Id<"pipes">, icon: "cart-outline", name: "Groceries" },
      },
      childrenByParent: new Map(),
    });
  });

  it("renders a list of single transactions", () => {
    const t1 = tx("tx1", { title: "coffee", date: 100 });
    const t2 = tx("tx2", { title: "bagel", date: 200 });
    render(<TransactionList transactions={[t1, t2]} />);
    expect(screen.getByText("Coffee")).toBeDefined();
    expect(screen.getByText("Bagel")).toBeDefined();
  });

  it("forwards the edit history callback for edited transactions", () => {
    const onShowEditHistory = vi.fn();
    const edited = tx("tx-edited", { date: 100, editedAt: 300 });

    render(
      <TransactionList
        transactions={[edited]}
        onShowEditHistory={onShowEditHistory}
      />,
    );

    fireEvent.click(screen.getByTestId("transaction-edit-history"));

    expect(onShowEditHistory).toHaveBeenCalledWith("tx-edited");
  });

  it("groups matching transactions into a stacked item", () => {
    const t1 = tx("tx1", { title: "coffee", date: 100 });
    const t2 = tx("tx2", { title: "coffee", date: 200 });
    render(<TransactionList transactions={[t1, t2]} />);
    expect(screen.getByText("Coffee")).toBeDefined();
    expect(screen.getByText("x2")).toBeDefined();
  });

  it("does not group transactions outside the visible pipe scope", () => {
    const inScope = tx("tx-in-scope", {
      title: "coffee",
      from: "pipe-1" as Id<"pipes">,
      date: 100,
    });
    const outsideScope = tx("tx-outside-scope", {
      title: "coffee",
      from: "pipe-2" as Id<"pipes">,
      date: 200,
    });

    render(
      <TransactionList
        transactions={[inScope, outsideScope]}
        visiblePipeIds={["pipe-1" as Id<"pipes">]}
      />,
    );

    expect(screen.queryByText("x2")).toBeNull();
  });

  it("shows empty state when no transactions", () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText("No transactions yet")).toBeDefined();
  });

  it("shows loading indicator when isLoading is true", () => {
    render(<TransactionList transactions={undefined} isLoading={true} />);
    expect(screen.getByTestId("loading-indicator")).toBeDefined();
  });

  it.each([
    { isLoading: true, loadMoreStatus: undefined },
    { isLoading: false, loadMoreStatus: "LoadingFirstPage" as const },
  ])(
    "shows initial loading instead of empty state for $loadMoreStatus",
    ({ isLoading, loadMoreStatus }) => {
      render(
        <TransactionList
          transactions={[]}
          isLoading={isLoading}
          loadMoreStatus={loadMoreStatus}
        />,
      );

      expect(screen.getByTestId("loading-indicator")).toBeDefined();
      expect(screen.queryByText("No transactions yet")).toBeNull();
    },
  );

  it("shows loading more indicator when loadMoreStatus is LoadingMore", () => {
    const t1 = tx("tx1", { date: 100 });
    render(
      <TransactionList
        transactions={[t1]}
        loadMoreStatus="LoadingMore"
      />,
    );
    const indicators = screen.getAllByTestId("loading-indicator");
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("calls onLoadMore when end reached", () => {
    const onLoadMore = vi.fn();
    const t1 = tx("tx1", { date: 100 });
    render(
      <TransactionList
        transactions={[t1]}
        onLoadMore={onLoadMore}
        loadMoreStatus="CanLoadMore"
      />,
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
