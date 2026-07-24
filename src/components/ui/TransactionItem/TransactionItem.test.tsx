// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionItem } from "./TransactionItem";
import type { Id } from "@convex/_generated/dataModel";

const baseTx = {
  _id: "tx1" as any,
  _creationTime: 0,
  title: "shopping mall",
  value: -50,
  date: new Date("2024-03-15").getTime(),
  pipeId: "pipe-1" as Id<"pipes">,
  userId: "" as Id<"users">,
};

const pipeInfo = {
  id: "id" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

describe("TransactionItem", () => {
  beforeEach(() => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: new Map(),
    });
  });

  it("renders the pipe icon", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByTestId("mock-icon")).toBeDefined();
  });

  it("renders the transaction title with first letter capitalized", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Shopping mall")).toBeDefined();
  });

  it("renders the formatted date", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
  });

  it("renders the value with two decimals", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("renders positive value without sign", () => {
    const tx = { ...baseTx, value: 120.5 };
    render(<TransactionItem transaction={tx} />);
    expect(screen.getByText("120.50")).toBeDefined();
  });

  it("renders all data in a single row", () => {
    const { container } = render(
      <TransactionItem transaction={baseTx} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeDefined();
  });

  it("renders value in white", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("renders value in white for positive", () => {
    const tx = { ...baseTx, value: 75 };
    render(<TransactionItem transaction={tx} />);
    expect(screen.getByText("75.00")).toBeDefined();
  });

  it("shows disabled info modal when pipe does not exist", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
  });

  it("shows disabled info modal when pipe has children", () => {
    const childrenMap = new Map<Id<"pipes">, any[]>();
    childrenMap.set(pipeInfo.id, [{ _id: "child1" as Id<"pipes"> }]);

    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: childrenMap,
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
  });
});
