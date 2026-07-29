// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StackedTransactionItem } from "./StackedTransactionItem";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { Id } from "@convex/_generated/dataModel";

const baseGroup: TransactionGroup = {
  transactions: [
    {
      _id: "tx1" as any,
      _creationTime: 0,
      title: "coffee",
      value: -5,
      date: new Date("2024-03-15").getTime(),
      from: "pipe-1" as Id<"pipes">,
      to: undefined,
      userId: "" as Id<"users">,
    },
    {
      _id: "tx2" as any,
      _creationTime: 0,
      title: "coffee",
      value: -5,
      date: new Date("2024-03-20").getTime(),
      from: "pipe-1" as Id<"pipes">,
      to: undefined,
      userId: "" as Id<"users">,
    },
  ],
  count: 2,
  title: "coffee",
  value: -5,
  from: "pipe-1" as Id<"pipes">,
  to: undefined,
  oldestDate: new Date("2024-03-15").getTime(),
  latestDate: new Date("2024-03-20").getTime(),
};

const pipeInfo = {
  _id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, size, color }: any) => (
    <span data-testid="mock-icon" data-name={name} data-size={size} data-color={color} />
  ),
  safeIconName: (name: string | undefined | null): string => name ?? "pipe",
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: any) =>
    visible ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: ({ variant, pipeId }: any) => (
    <div data-testid="amount-form" data-variant={variant} data-pipe-id={pipeId} />
  ),
}));

describe("StackedTransactionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeSelection.mockReturnValue({
      pipesById: { "pipe-1": pipeInfo },
      childrenByParent: new Map(),
    });
  });

  it("renders the pipe icon", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mock-icon")).toBeDefined();
  });

  it("renders the title capitalized", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Coffee")).toBeDefined();
  });

  it("renders the count badge", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("x2")).toBeDefined();
  });

  it("renders the value with two decimals", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("-5.00")).toBeDefined();
  });

  it("renders date range for same month and year", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Mar 15 - 20, 2024")).toBeDefined();
  });

  it("renders date range for different months same year", () => {
    const group: TransactionGroup = {
      ...baseGroup,
      oldestDate: new Date("2024-02-28").getTime(),
      latestDate: new Date("2024-03-15").getTime(),
    };
    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Feb 28 - Mar 15, 2024")).toBeDefined();
  });

  it("renders date range for different years", () => {
    const group: TransactionGroup = {
      ...baseGroup,
      oldestDate: new Date("2023-12-28").getTime(),
      latestDate: new Date("2024-01-15").getTime(),
    };
    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Dec 28, 2023 - Jan 15, 2024")).toBeDefined();
  });

  it("opens the modal when tapped while collapsed", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("modal")).toBeNull();
    fireEvent.click(screen.getByText("Coffee"));
    expect(screen.getByTestId("modal")).toBeDefined();
  });

  it("calls onToggle when tapped while expanded", () => {
    const onToggle = vi.fn();
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders normally when expanded (no crash)", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Coffee")).toBeDefined();
    expect(screen.getByText("x2")).toBeDefined();
  });

  it("renders normally when collapsed (no crash)", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Coffee")).toBeDefined();
    expect(screen.getByText("x2")).toBeDefined();
  });
});
