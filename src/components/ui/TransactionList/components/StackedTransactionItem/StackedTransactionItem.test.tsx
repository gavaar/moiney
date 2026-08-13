// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Animated } from "react-native";
import { StackedTransactionItem } from "./StackedTransactionItem";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { Id } from "@convex/_generated/dataModel";

const baseGroup: TransactionGroup = {
  id: '["expense","coffee",-500,"pipe-1",null]',
  kind: "expense",
  transactions: [
    {
      _id: "tx1" as any,
      _creationTime: 0,
      title: "coffee",
      kind: "expense",
       value: -500,
      date: new Date("2024-03-15").getTime(),
      from: "pipe-1" as Id<"pipes">,
      to: undefined,
      userId: "" as Id<"users">,
    },
    {
      _id: "tx2" as any,
      _creationTime: 0,
      title: "coffee",
      kind: "expense",
       value: -500,
      date: new Date("2024-03-20").getTime(),
      from: "pipe-1" as Id<"pipes">,
      to: undefined,
      userId: "" as Id<"users">,
    },
  ],
  count: 2,
  title: "coffee",
   value: -500,
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
  AmountForm: ({ variant, pipeId, initState }: any) => (
    <div
      data-testid="amount-form"
      data-variant={variant}
      data-pipe-id={pipeId}
      data-transaction-id={initState?.transactionId}
      data-date={initState?.date}
    />
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
    expect(screen.getAllByTestId("mock-icon")[0]).toBeDefined();
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

  it("opens a grouped transaction in repeat mode without historical identity", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Coffee"));

    const form = screen.getByTestId("amount-form");
    expect(form.getAttribute("data-transaction-id")).toBeNull();
    expect(form.getAttribute("data-date")).toBeNull();
  });

  it("renders a deleted-pipe group as view-only history", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });
    const group: TransactionGroup = {
      ...baseGroup,
      transactions: baseGroup.transactions.map((transaction) => ({
        ...transaction,
        fromIcon: "cart-outline",
      })),
    };

    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("mock-icon")[0].getAttribute("data-name")).toBe("cart-outline");
    fireEvent.click(screen.getByText("Coffee"));
    expect(screen.getByText(/Preserved history is view-only/)).toBeDefined();
  });

  it("does not open repeat for a group whose source pipe is being deleted", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: { "pipe-1": { ...pipeInfo, deletionJobId: "job-1" } },
      childrenByParent: new Map(),
    });

    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Coffee"));

    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
  });

  it("opens the modal without toggling when tapped while expanded", () => {
    const onToggle = vi.fn();
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText("Coffee"));
    expect(screen.getByTestId("modal")).toBeDefined();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("toggles only from the accessible disclosure button", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={onToggle}
      />,
    );
    const expand = screen.getByRole("button", {
      name: "Expand 2 transactions",
    });

    fireEvent.click(expand);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("modal")).toBeNull();

    rerender(
      <StackedTransactionItem
        group={baseGroup}
        expanded
        onToggle={onToggle}
      />,
    );
    const collapse = screen.getByRole("button", {
      name: "Collapse 2 transactions",
    });
    fireEvent.click(collapse);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("renders repeat and disclosure as separate sibling controls", () => {
    const onToggle = vi.fn();
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={onToggle}
      />,
    );
    const row = screen.getByTestId("transaction-group-row");
    const main = screen.getByTestId("transaction-group-main");
    const disclosure = screen.getByTestId("transaction-group-disclosure");

    expect(row.children).toHaveLength(2);
    expect(main.parentElement).toBe(row);
    expect(disclosure.parentElement).toBe(row);

    fireEvent.click(main);
    expect(screen.getByTestId("modal")).toBeDefined();
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(disclosure);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("animates one compact down chevron between disclosure states", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const timing = vi
      .spyOn(Animated, "timing")
      .mockReturnValue({ start, stop } as unknown as Animated.CompositeAnimation);
    const { rerender } = render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    rerender(
      <StackedTransactionItem
        group={baseGroup}
        expanded
        onToggle={vi.fn()}
      />,
    );

    const chevrons = screen
      .getAllByTestId("mock-icon")
      .filter((icon) => icon.getAttribute("data-name") === "chevron-down");
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].getAttribute("data-size")).toBe("12");
    expect(timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, useNativeDriver: true }),
    );
    expect(start).toHaveBeenCalled();

    timing.mockRestore();
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
