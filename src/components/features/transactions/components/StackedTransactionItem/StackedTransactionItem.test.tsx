// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StackedTransactionItem } from "./StackedTransactionItem";
import type { StackedTransactionGroup } from "./stackedTransactionItem.model";
import type { Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";

const baseGroup: StackedTransactionGroup = {
  title: "coffee",
  count: 2,
  totalValue: -800,
  oldestDate: new Date(2024, 2, 15).getTime(),
  latestDate: new Date(2024, 2, 20).getTime(),
  visiblePipeIds: ["pipe-1" as Id<"pipes">],
};

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

vi.mock("@ui/Icon", async importOriginal => ({
  ...await importOriginal<typeof import("@ui/Icon")>(),
  Icon: ({ name, color }: { name: string; color: string }) => (
    <span data-testid="mock-icon" data-name={name} data-color={color} />
  ),
}));

describe("StackedTransactionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeCatalog.mockReturnValue({ pipesById: { [pipeInfo.id]: pipeInfo } });
  });

  it("focuses the group details before the trailing counter", async () => {
    render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={vi.fn()} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId("transaction-group-main"));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand 2 transactions" }));
  });

  it("renders the visible pipe icon", () => {
    render(<StackedTransactionItem group={baseGroup} expanded={false} onToggle={vi.fn()} />);

    const icon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(icon.getAttribute("data-name")).toBe("cart-outline");
    expect(icon.getAttribute("data-color")).toBe(colors.muted);
  });

  it("renders a deleted-pipe summary icon without transaction presentations", () => {
    mockUsePipeCatalog.mockReturnValue({ pipesById: {} });
    const group = { ...baseGroup, snapshotIcon: "cash-outline" };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    expect(within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon")
      .getAttribute("data-name")).toBe("cash-outline");
  });

  it("uses the multi-pipe icon when multiple visible pipes participate", () => {
    const group = { ...baseGroup, visiblePipeIds: [pipeInfo.id, "pipe-2" as Id<"pipes">] };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    const icon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(icon.getAttribute("data-name")).toBe("card-multiple");
    expect(icon.getAttribute("data-color")).toBe(colors.text);
  });

  it.each(["cart-outline", "wallet-outline", "cash-outline"])("uses the deleted visible pipe's summary icon %s", icon => {
    mockUsePipeCatalog.mockReturnValue({ pipesById: {} });
    const visibleId = "deleted" as Id<"pipes">;
    const group: StackedTransactionGroup = {
      ...baseGroup,
      visiblePipeIds: [visibleId],
      snapshotIcon: icon,
    };
    render(<StackedTransactionItem group={group} expanded={false} onToggle={vi.fn()} />);

    const renderedIcon = within(screen.getByTestId("transaction-group-main")).getByTestId("mock-icon");
    expect(renderedIcon.getAttribute("data-name")).toBe(icon);
    expect(renderedIcon.getAttribute("data-color")).toBe(colors.muted);
  });

  it("prefers the current pipe icon over a preserved summary icon", () => {
    const group = {
      ...baseGroup,
      snapshotIcon: "cash-outline",
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
    expect(screen.getByRole("button", {
      name: `${expanded ? "Collapse" : "Expand"} coffee transactions, 2 transactions, -8.00, Mar 15 - 20, 2024`,
      expanded,
    })).toBeDefined();
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

  it("allows expansion when a participating pipe has been deleted", () => {
    const group: StackedTransactionGroup = {
      ...baseGroup,
      visiblePipeIds: [...baseGroup.visiblePipeIds, "deleted-payer" as Id<"pipes">],
    };
    const onToggle = vi.fn();
    render(<StackedTransactionItem group={group} expanded={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("expands a multi-pipe summary with its supplied total", () => {
    const group: StackedTransactionGroup = {
      ...baseGroup,
      oldestDate: 1,
      latestDate: 2,
      visiblePipeIds: [...baseGroup.visiblePipeIds, "destination" as Id<"pipes">],
    };
    const onToggle = vi.fn();
    render(<StackedTransactionItem group={group} expanded={false} onToggle={onToggle} />);

    expect(screen.getByText("-8.00")).toBeDefined();
    fireEvent.click(screen.getByText("Coffee"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
