// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as Reanimated from "react-native-reanimated";
import { StackedTransactionItem } from "./StackedTransactionItem";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
      testID,
      ...props
    }: any) => (
      <button
        {...props}
        aria-label={accessibilityLabel}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
      >
        {children}
      </button>
    ),
  };
});

vi.mock("@/lib/styles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/styles")>();
  return {
    ...actual,
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
  };
});

const baseGroup: TransactionGroup = {
  id: '["expense","coffee","pipe-1",null]',
  kind: "expense",
  isMixed: false,
  transactions: [
    {
      id: "tx1" as Id<"transactions">,
      createdAt: 0,
      title: "coffee",
      kind: "expense",
      value: -500,
      date: new Date("2024-03-15").getTime(),
      from: "pipe-1" as Id<"pipes">,
    },
    {
      id: "tx2" as Id<"transactions">,
      createdAt: 0,
      title: "coffee",
      kind: "expense",
      value: -300,
      date: new Date("2024-03-20").getTime(),
      from: "pipe-1" as Id<"pipes">,
    },
  ],
  count: 2,
  title: "coffee",
  totalValue: -800,
  latestValue: -300,
  from: "pipe-1" as Id<"pipes">,
  to: undefined,
  visiblePipeIds: ["pipe-1" as Id<"pipes">],
  oldestDate: new Date("2024-03-15").getTime(),
  latestDate: new Date("2024-03-20").getTime(),
};

const pipeInfo = {
  id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
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
      data-value={initState?.value}
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
    expect(screen.getAllByTestId("mock-icon")[0]).toMatchObject({
      dataset: { name: "cart-outline", color: colors.muted },
    });
  });

  it("uses the multi-pipe icon when multiple visible pipes participate", () => {
    const group = {
      ...baseGroup,
      visiblePipeIds: ["pipe-1", "pipe-2"] as Id<"pipes">[],
    };

    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    const multiPipeIcon = screen
      .getAllByTestId("mock-icon")
      .find((icon) => icon.getAttribute("data-name") === "card-multiple");
    expect(multiPipeIcon).toBeDefined();
    expect(multiPipeIcon?.getAttribute("data-color")).toBe(colors.surface);
  });

  it.each([
    ["negative", -100, "bg-error/30"],
    ["positive", 100, "bg-success/30"],
  ])("uses the aggregate value for %s group color", (_label, totalValue, expectedClass) => {
    const group = {
      ...baseGroup,
      kind: "transfer" as const,
      totalValue,
    };

    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    const main = screen.getByTestId("transaction-group-main");
    expect(main.className).toContain(expectedClass);
    expect(main.className).not.toContain("bg-accent/30");
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

  it("renders the summed value with two decimals", () => {
    render(
      <StackedTransactionItem
        group={baseGroup}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("-8.00")).toBeDefined();
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
    expect(form.getAttribute("data-value")).toBe("-3.00");
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

  it("uses a deleted paidFrom icon when the payer is the visible pipe", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });
    const group: TransactionGroup = {
      ...baseGroup,
      from: "outside" as Id<"pipes">,
      visiblePipeIds: ["payer" as Id<"pipes">],
      transactions: baseGroup.transactions.map((transaction) => ({
        ...transaction,
        from: "outside" as Id<"pipes">,
        paidFrom: "payer" as Id<"pipes">,
        paidFromIcon: "cash-outline",
      })),
    };

    render(
      <StackedTransactionItem
        group={group}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("mock-icon")[0].getAttribute("data-name"))
      .toBe("cash-outline");
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
    const withTiming = vi.spyOn(Reanimated, "withTiming");
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
    expect(withTiming).toHaveBeenLastCalledWith(1, { duration: 180 });

    withTiming.mockRestore();
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
