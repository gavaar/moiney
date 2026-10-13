// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { colors } from "@/lib/styles";
import userEvent from "@testing-library/user-event";
import { StatisticsRow } from "./StatisticsRow";

vi.mock("@/lib/dates", () => ({
  getDaysInMonth: () => 30,
}));

let mockPipesById: any;

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    selectedPipePath: ["test_pipe_id"],
    isLoading: false,
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ pipesById: mockPipesById }),
}));

vi.mock("@ui/Popover", () => ({
  Popover: ({ visible, children, onClose, testID }: any) =>
    visible ? (
      <div data-testid={testID ?? "popover"}>
        <div data-testid="popover-backdrop" onClick={onClose} />
        {children}
      </div>
    ) : null,
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID, color }: any) => (
    <span data-testid={testID ?? "icon"} data-name={name} data-color={color} />
  ),
}));

const baseProps = {
  fed: 100000,
  spent: 40000,
  expected: 90000,
};

function renderStatistics(
  overrides: Partial<React.ComponentProps<typeof StatisticsRow>> = {},
) {
  return render(<StatisticsRow {...baseProps} now={Date.now()} {...overrides} />);
}

describe("StatisticsRow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockPipesById = {
      test_pipe_id: {
        id: "test_pipe_id",
        name: "Test Pipe",
        icon: "home-outline",
      },
    };
    vi.useRealTimers();
  });

  it("shows remaining expected spending instead of carried-forward capacity", async () => {
    const user = userEvent.setup();
    renderStatistics({ fed: 200000, expected: 90000, spent: 40000 });

    await user.click(
      screen.getByRole("button", { name: "Remaining expected, 500.00" }),
    );
    expect(
      screen.getByText(
        "The monthly expected amount is 900.00. After 400.00 in currently tracked spending, 500.00 remains. Spending before the last settlement is not included; this is not your available balance or carried-forward capacity.",
      ),
    ).toBeDefined();
  });

  it.each([
    { capacity: 4000, spent: 7000, donorFed: 6000, donorSpent: 4000, amount: "20.00" },
    { capacity: -3000, spent: 0, donorFed: 6000, donorSpent: 1000, amount: "30.00" },
    { capacity: 4000, spent: 1000, donorFed: 6000, donorSpent: 0, amount: "0.00" },
  ])("shows current coverage of $amount and explains settlement-time use", async ({ capacity, spent, donorFed, donorSpent, amount }) => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", capacity, spent, fed: 0, contingencyPipeId: "donor" };
    mockPipesById.root = { id: "root" };
    mockPipesById.donor = { id: "donor", parentId: "root", name: "Reserve", icon: "wallet", fed: donorFed, spent: donorSpent, capacity: 6000 };
    renderStatistics({ spent });
    const pill = screen.getByRole("button", { name: `Possible coverage, ${amount}` });
    expect(within(pill).getByTestId("icon").getAttribute("data-color")).toBe(colors.warning);
    await userEvent.setup().click(pill);
    expect(screen.getByText(new RegExp(`Reserve could cover ${amount.replace(".", "\\.")} if this pipe settled now`))).toBeTruthy();
    expect(screen.getByText(/not reserved/)).toBeTruthy();
  });

  it("updates the estimate with donor balances and hides it when the donor becomes ineligible", () => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", capacity: 4000, spent: 7000, fed: 0, contingencyPipeId: "donor" };
    mockPipesById.root = { id: "root" };
    mockPipesById.donor = { id: "donor", parentId: "root", name: "Reserve", icon: "wallet", fed: 6000, spent: 4000, capacity: 6000 };
    const { rerender } = renderStatistics();
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00" })).toBeTruthy();
    mockPipesById.donor.spent = 6000;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage, 0.00" })).toBeTruthy();
    mockPipesById.donor.deletionJobId = "deletion";
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.queryByRole("button", { name: /Possible coverage/ })).toBeNull();
  });

  it("does not show coverage without a selected donor", () => {
    renderStatistics();
    expect(screen.queryByRole("button", { name: /Possible coverage/ })).toBeNull();
  });

  it.each([
    { fed: 6000, spent: 4000, sourceSpent: 7000, amount: "20.00" },
    { fed: 10000, spent: 0, sourceSpent: 5500, amount: "30.00" },
    { fed: 6000, spent: 6000, sourceSpent: 7000, amount: "0.00" },
    { fed: 6000, spent: 0, sourceSpent: 3000, amount: "0.00" },
  ])("shows donor coverage of $amount without counting shared funding twice", async ({ fed, spent, sourceSpent, amount }) => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", fed, spent, capacity: 6000 };
    mockPipesById.root = { id: "root" };
    mockPipesById.groceries = { id: "groceries", parentId: "root", name: "Groceries", capacity: 4000, spent: sourceSpent, fed: 4000, contingencyPipeId: "test_pipe_id" };
    mockPipesById.rent = { id: "rent", parentId: "root", name: "Rent", capacity: 4000, spent: sourceSpent, fed: 4000, contingencyPipeId: "test_pipe_id" };
    // An instant-settlement source's stale selection must not increase the estimate.
    mockPipesById.instant = { id: "instant", parentId: "root", name: "Instant", capacity: 0, spent: 10000, fed: 0, rule: "instant_settlement", contingencyPipeId: "test_pipe_id" };
    renderStatistics({ fed, spent });
    const pill = screen.getByRole("button", { name: `Possible coverage provided, ${amount}` });
    expect(within(pill).getByTestId("icon").getAttribute("data-color")).toBe(colors.warning);
    await userEvent.setup().click(pill);
    expect(screen.getByText(new RegExp(`could provide ${amount.replace(".", "\\.")} in total`))).toBeTruthy();
    expect(screen.getByText(/Groceries, Rent/)).toBeTruthy();
    expect(screen.getByText(/not reserved/)).toBeTruthy();
  });

  it("updates donor coverage with source debt and hides it during tree freezes or after the last selection is cleared", () => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", fed: 6000, spent: 0, capacity: 6000 };
    mockPipesById.root = { id: "root" };
    mockPipesById.source = { id: "source", parentId: "root", name: "Groceries", capacity: -3000, spent: 0, fed: 0, contingencyPipeId: "test_pipe_id" };
    mockPipesById.sibling = { id: "sibling", parentId: "root" };
    const { rerender } = renderStatistics();
    expect(screen.getByRole("button", { name: "Possible coverage provided, 30.00" })).toBeTruthy();
    mockPipesById.source.capacity = -5000;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage provided, 50.00" })).toBeTruthy();
    mockPipesById.sibling.deletionJobId = "deletion";
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.queryByRole("button", { name: /Possible coverage provided/ })).toBeNull();
    delete mockPipesById.sibling.deletionJobId;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage provided, 50.00" })).toBeTruthy();
    delete mockPipesById.source.contingencyPipeId;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.queryByRole("button", { name: /Possible coverage provided/ })).toBeNull();
  });

  it("hides coverage during sibling deletion, restores it afterward, and ignores freezes in other trees", () => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", capacity: 4000, spent: 7000, fed: 0, contingencyPipeId: "donor" };
    mockPipesById.root = { id: "root" };
    mockPipesById.donor = { id: "donor", parentId: "root", name: "Reserve", icon: "wallet", fed: 6000, spent: 4000, capacity: 6000 };
    mockPipesById.sibling = { id: "sibling", parentId: "root" };
    mockPipesById.deleting = { id: "deleting", parentId: "sibling", deletionJobId: "deletion" };
    const { rerender } = renderStatistics();
    expect(screen.queryByRole("button", { name: /Possible coverage/ })).toBeNull();

    delete mockPipesById.deleting.deletionJobId;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00" })).toBeTruthy();

    mockPipesById.otherRoot = { id: "otherRoot" };
    mockPipesById.otherDeleting = { id: "otherDeleting", parentId: "otherRoot", deletionJobId: "otherDeletion" };
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00" })).toBeTruthy();
  });

  it("shows a negative remaining expected amount after exceeding the target", () => {
    renderStatistics({ spent: 100000 });
    expect(screen.getByRole("button", { name: "Remaining expected, -100.00" })).toBeDefined();
  });

  it("calculates StMpD over elapsed days and explains its denominator", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics({ spent: 45000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spent this month per day, 30.00",
      }),
    );
    expect(
      screen.getByText(
        "An average of 30.00 was spent per day over 15 days in this pipe this month.",
      ),
    ).toBeDefined();
  });

  it("updates daily spending from the screen's clock without sampling render time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    const { rerender } = renderStatistics({ spent: 45000, now: new Date(2026, 6, 15, 12).getTime() });
    expect(screen.getByRole("button", { name: "Spent this month per day, 30.00" })).toBeDefined();

    rerender(<StatisticsRow {...baseProps} spent={45000} now={new Date(2026, 6, 16, 12).getTime()} />);
    expect(screen.getByRole("button", { name: "Spent this month per day, 28.13" })).toBeDefined();
  });

  it("calculates and explains accumulated spend through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics();

    fireEvent.click(
      screen.getByRole("button", { name: "Accumulated spend this month, 50.00" }),
    );
    expect(
      screen.getByText(
        "You can spend 50.00. This month expects 900.00 to be spent, which adds up to 30.00 spendable per day. Given you have already spent 400.00, you can spend up to today 50.00.",
      ),
    ).toBeDefined();
  });

  it("explains when negative accumulated spend becomes positive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics({ spent: 50000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accumulated spend this month, -50.00",
      }),
    );
    expect(
      screen.getByText("This value will be positive again in 2 days."),
    ).toBeDefined();
  });

  it("warns when accumulated spend cannot recover this month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics({ spent: 100000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accumulated spend this month, -550.00",
      }),
    );
    expect(
      screen.getByText(
        "You should not spend anymore from this pipe this month.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/positive again in/)).toBeNull();
  });

  it("uses accessible icon-only chips and removes StM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics();

    expect(
      screen.getByRole("button", { name: "Remaining expected, 500.00" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Spent this month per day, 26.67",
      }),
    ).toBeDefined();
    expect(screen.queryByText(/L2S:|StM:|StMpD:/)).toBeNull();
  });

  it("hides boiler remaining expected and presents growth as a statistic", () => {
    renderStatistics({
      fed: 150000,
      spent: 0,
      expected: 0,
      sourceType: "boiler",
      contributedFed: 100000,
    });

    expect(screen.queryByRole("button", { name: /Remaining expected/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Growth, +50%" })).toBeDefined();
    expect(screen.getByTestId("boiler-growth-chip").textContent).toBe("+50%");
  });

  it.each([
    [
      25000,
      "+250.00",
      "Paid elsewhere",
      "This spending counts toward this pipe, but another pipe paid for it. The next rule run will add 250.00 to this pipe's fed balance.",
    ],
    [
      -25000,
      "-250.00",
      "Refunded elsewhere",
      "This refund reduces this pipe's spending, but another pipe received it. The next rule run will subtract 250.00 from this pipe's fed balance.",
    ],
  ])(
    "keeps an external adjustment of %s out of remaining expected and explains it",
    async (pendingFedAdjustment, displayValue, title, description) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 9, 5, 12));
      const user = userEvent.setup();
      renderStatistics({ pendingFedAdjustment });

      expect(
        screen.getByRole("button", { name: "Remaining expected, 500.00" }),
      ).toBeDefined();
      const adjustment = screen.getByRole("button", { name: `${title}, ${displayValue}` });
      expect(adjustment.textContent).toBe(displayValue);
      await user.click(adjustment);
      expect(screen.getByText(new RegExp(title))).toBeDefined();
      expect(screen.getByText(description)).toBeDefined();
    },
  );

  it("shows positive boiler growth with an explanation", async () => {
    const user = userEvent.setup();
    renderStatistics({
      fed: 150000,
      spent: 0,
      sourceType: "boiler",
      contributedFed: 100000,
    });

    await user.click(screen.getByTestId("boiler-growth-chip"));
    expect(
      screen.getByText(
        "This pipe has received 1,000.00 value, but now holds 1,500.00, meaning it has grown +50%.",
      ),
    ).toBeDefined();
  });

  it("shows negative and unavailable boiler growth", () => {
    const { rerender } = renderStatistics({
      fed: 75000,
      spent: 0,
      sourceType: "boiler",
      contributedFed: 100000,
    });
    expect(screen.getByRole("button", { name: "Growth, -25%" })).toBeDefined();

    rerender(
      <StatisticsRow
        {...baseProps}
        now={Date.now()}
        fed={10000}
        spent={0}
        sourceType="boiler"
        contributedFed={0}
      />,
    );
    expect(screen.getByRole("button", { name: "Growth, N/A" })).toBeDefined();
  });

  it("closes a stat popover on backdrop tap", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await user.click(
      screen.getByRole("button", { name: "Remaining expected, 500.00" }),
    );
    expect(screen.getByText(/Remaining expected:/)).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByText(/Remaining expected:/)).toBeNull();
  });

  it("renders days left for cron pipes and clamps past dates to zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12));
    mockPipesById.test_pipe_id.rule = "cron";
    mockPipesById.test_pipe_id.cronNextDate = Date.UTC(2026, 6, 13, 12);
    const { rerender } = renderStatistics();
    expect(screen.getByText("7")).toBeDefined();

    mockPipesById.test_pipe_id.cronNextDate = Date.UTC(2026, 6, 1, 12);
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByText("0")).toBeDefined();
  });

  it("renders no days-left chip for non-cron pipes", () => {
    renderStatistics();
    const timerIcon = screen
      .queryAllByTestId("icon")
      .find((icon) => icon.getAttribute("data-name") === "timer-outline");
    expect(timerIcon).toBeUndefined();
  });
});
