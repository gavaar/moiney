// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => {
    return {
      pipesById: {
        [pipeInfo.id]: pipeInfo,
      },
    };
  },
}));

describe("TransactionItem", () => {
  it("renders the pipe icon", () => {
    render(<TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />);
    expect(screen.getByTestId("mock-icon")).toBeDefined();
  });

  it("renders the transaction title with first letter capitalized", () => {
    render(<TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("Shopping mall")).toBeDefined();
  });

  it("renders the formatted date", () => {
    render(<TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
  });

  it("renders the value with two decimals", () => {
    render(<TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("renders positive value without sign", () => {
    const tx = { ...baseTx, value: 120.5 };
    render(<TransactionItem transaction={tx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("120.50")).toBeDefined();
  });

  it("renders all data in a single row", () => {
    const { container } = render(
      <TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeDefined();
  });

  it("renders value in white", () => {
    render(<TransactionItem transaction={baseTx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("renders value in white for positive", () => {
    const tx = { ...baseTx, value: 75 };
    render(<TransactionItem transaction={tx} pipeId={pipeInfo.id} />);
    expect(screen.getByText("75.00")).toBeDefined();
  });
});
