// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StackedTransactionItem } from "./StackedTransactionItem";
import { groupTransactions, type TransactionGroup } from "@features/transactions/groupTransactions";
import type { Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      hitSlop,
      children,
      onPress,
      testID,
      ...props
    }: any) => (
      <button
        {...props}
        aria-label={accessibilityLabel}
        aria-expanded={accessibilityState?.expanded}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
      >
        {children}
      </button>
    ),
  };
});

const [grouped] = groupTransactions([
  {
    id: "tx1" as Id<"transactions">,
    createdAt: 0,
    title: "coffee",
    kind: "expense",
    value: -500,
    date: new Date(2024, 2, 15).getTime(),
    from: "pipe-1" as Id<"pipes">,
  },
  {
    id: "tx2" as Id<"transactions">,
    createdAt: 0,
    title: "coffee",
    kind: "expense",
    value: -300,
    date: new Date(2024, 2, 20).getTime(),
    from: "pipe-1" as Id<"pipes">,
  },
]);
if (!("count" in grouped)) throw new Error("Expected a group");
const baseGroup = grouped;

const pipeInfo = {
  id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
  spent: 12345,
  capacity: 50000,
};

const mockUsePipeCatalog = vi.fn();
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeCatalog(),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, color }: any) => (
    <span data-testid="mock-icon" data-name={name} data-color={color} />
  ),
}));

describe("StackedTransactionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeCatalog.mockReturnValue({ pipesById: { [pipeInfo.id]: pipeInfo } });
  });

  it("renders the visible pipe icon", () => {
    render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={vi.fn()} />);

    const icon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(icon.getAttribute("data-name")).toBe("cart-outline");
    expect(icon.getAttribute("data-color")).toBe(colors.muted);
  });

  it("uses the multi-pipe icon when multiple visible pipes participate", () => {
    const group = { ...baseGroup, visiblePipeIds: [pipeInfo.id, "pipe-2" as Id<"pipes">] };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    const icon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(icon.getAttribute("data-name")).toBe("card-multiple");
    expect(icon.getAttribute("data-color")).toBe(colors.text);
  });

  it.each([
    { role: "from", snapshot: "fromIcon", icon: "cart-outline" },
    { role: "to", snapshot: "toIcon", icon: "wallet-outline" },
    { role: "paidFrom", snapshot: "paidFromIcon", icon: "cash-outline" },
  ] as const)("uses the deleted $role icon belonging to the visible pipe", ({ role, snapshot, icon }) => {
    mockUsePipeCatalog.mockReturnValue({ pipesById: {} });
    const visibleId = "deleted" as Id<"pipes">;
    const group: TransactionGroup = {
      ...baseGroup,
      visiblePipeIds: [visibleId],
      transactions: baseGroup.transactions.map((transaction) => ({
        ...transaction,
        fromIcon: "home-outline",
        [role]: visibleId,
        [snapshot]: icon,
      })),
    };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    const renderedIcon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(renderedIcon.getAttribute("data-name")).toBe(icon);
    expect(renderedIcon.getAttribute("data-color")).toBe(colors.muted);
  });

  it("finds a deleted icon on an older member when the newest has no snapshot", () => {
    mockUsePipeCatalog.mockReturnValue({ pipesById: {} });
    const group = {
      ...baseGroup,
      transactions: [baseGroup.transactions[0], { ...baseGroup.transactions[1], fromIcon: "cart-outline" }],
    };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    expect(within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon")
      .getAttribute("data-name")).toBe("cart-outline");
  });

  it.each([undefined, {}])("uses a disconnected icon when the visible pipe and its snapshot are missing (catalog=%s)", (pipesById) => {
    mockUsePipeCatalog.mockReturnValue({ pipesById });
    render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={vi.fn()} />);

    expect(within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon")
      .getAttribute("data-name")).toBe("pipe-disconnected");
  });

  it.each([false, true])("renders the title, count and summed cents when expanded=%s", (expanded) => {
    render(<StackedTransactionItem group={baseGroup} expanded={expanded} onToggle={vi.fn()} />);

    expect(screen.getByText("Coffee")).toBeDefined();
    expect(screen.getByText("x2")).toBeDefined();
    expect(screen.getByText("-8.00")).toBeDefined();
  });

  it.each([
    { oldestDate: new Date(2024, 2, 15).getTime(), latestDate: new Date(2024, 2, 20).getTime(), expected: "Mar 15 - 20, 2024" },
    { oldestDate: new Date(2024, 1, 28).getTime(), latestDate: new Date(2024, 2, 15).getTime(), expected: "Feb 28 - Mar 15, 2024" },
    { oldestDate: new Date(2023, 11, 28).getTime(), latestDate: new Date(2024, 0, 15).getTime(), expected: "Dec 28, 2023 - Jan 15, 2024" },
  ])("renders date range $expected", ({ oldestDate, latestDate, expected }) => {
    render(<StackedTransactionItem group={{ ...baseGroup, oldestDate, latestDate }} expanded={false} onToggle={vi.fn()} />);

    expect(screen.getByText(expected)).toBeDefined();
  });

  it.each(["transaction-group-main", "transaction-group-disclosure"])("toggles once from %s in both expansion states", (testId) => {
    const onToggle = vi.fn();
    const { rerender } = render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Expand 2 transactions", expanded: false })).toBeDefined();

    fireEvent.click(screen.getByTestId(testId));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<StackedTransactionItem group={baseGroup} expanded onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Collapse 2 transactions", expanded: true })).toBeDefined();
    fireEvent.click(screen.getByTestId(testId));
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("allows expansion while the source pipe is being deleted", () => {
    mockUsePipeCatalog.mockReturnValue({ pipesById: { [pipeInfo.id]: { ...pipeInfo, deletionJobId: "job-1" } } });
    const onToggle = vi.fn();
    render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("allows expansion when only an older member has a deleted role", () => {
    const [group] = groupTransactions([
      baseGroup.transactions[0],
      { ...baseGroup.transactions[1], paidFrom: "deleted-payer" as Id<"pipes">, paidFromIcon: "cash-outline" },
    ]);
    if (!("count" in group)) throw new Error("Expected a group");
    const onToggle = vi.fn();
    render(<StackedTransactionItem group={group} expanded={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it.each(["expense", "transfer"] as const)("expands mixed groups with newest kind %s", (newestKind) => {
    const [group] = groupTransactions([
      { ...baseGroup.transactions[0], kind: "expense", value: -800, date: newestKind === "expense" ? 2 : 1 },
      { ...baseGroup.transactions[1], kind: "transfer", to: "destination" as Id<"pipes">, value: 300, date: newestKind === "transfer" ? 2 : 1 },
    ]);
    if (!("count" in group)) throw new Error("Expected a group");
    expect(group.isMixed).toBe(true);
    const onToggle = vi.fn();
    render(<StackedTransactionItem group={group} expanded={false} onToggle={onToggle} />);

    expect(screen.getByText("-8.00")).toBeDefined();
    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
