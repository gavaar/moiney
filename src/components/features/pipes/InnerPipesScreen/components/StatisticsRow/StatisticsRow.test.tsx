// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { colors } from "@/lib/styles";
import userEvent from "@testing-library/user-event";
import { StatisticsRow } from "./StatisticsRow";

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
  monthlySpent: 40000,
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
      screen.getByText((_, element) =>
        element?.textContent === "The monthly expected amount is 900.00.",
      ),
    ).toBeDefined();
    expect(screen.getByText((_, element) => element?.textContent ===
      "After 400.00 in currently tracked spending, 500.00 remains. Spending before the last settlement is not included.")).toBeDefined();
    expect(screen.queryByText(/this is not your available balance/)).toBeNull();
  });

  it.each([
    { fed: 100000, spent: 40000, pendingFedAdjustment: 25000, sentence: "This pipe should have 850.00 of funding left after settlement." },
    { fed: 100000, spent: 40000, pendingFedAdjustment: -25000, sentence: "This pipe should have 350.00 of funding left after settlement." },
    { fed: 40000, spent: 40000, pendingFedAdjustment: 0, sentence: "This pipe should have 0.00 of funding left after settlement." },
    { fed: 10000, spent: 40000, pendingFedAdjustment: 5000, sentence: "This pipe should have a funding shortfall of 250.00." },
    { fed: 100000, spent: -40000, sentence: "This pipe should have 1,400.00 of funding left after settlement." },
  ])("projects funding including pending adjustments: $sentence", async ({ sentence, ...props }) => {
    renderStatistics(props);
    await userEvent.setup().click(screen.getByRole("button", { name: /Remaining expected,/ }));
    expect(screen.getByText((_, element) => element?.textContent === sentence)).toBeDefined();
  });

  it.each([
    { expected: 90000, spent: 40000, pendingFedAdjustment: 25000, expectedLabel: "900.00", spentLabel: "400.00", externalLabel: "250.00", simpleLabel: "150.00" },
    { expected: 10000, spent: 40000, pendingFedAdjustment: -25000, expectedLabel: "100.00", spentLabel: "400.00", externalLabel: "-250.00", simpleLabel: "650.00" },
    { expected: -10000, spent: -40000, pendingFedAdjustment: -25000, expectedLabel: "-100.00", spentLabel: "-400.00", externalLabel: "-250.00", simpleLabel: "-150.00" },
    { expected: 0, spent: 0, pendingFedAdjustment: 0, expectedLabel: "0.00", spentLabel: "0.00", externalLabel: "0.00", simpleLabel: "0.00" },
  ])("exposes signed expected and net spending breakdown: $spentLabel", async ({ expectedLabel, spentLabel, externalLabel, simpleLabel, ...props }) => {
    renderStatistics(props);
    await userEvent.setup().click(screen.getByRole("button", { name: /Remaining expected,/ }));
    expect(screen.getByRole("img", { name: `Expected ${expectedLabel}` })).toBeDefined();
    expect(screen.getByRole("img", { name: `Spent ${spentLabel}: paid elsewhere ${externalLabel}, simple ${simpleLabel}` })).toBeDefined();
  });

  it.each([
    { capacity: 4000, spent: 7000, donorFed: 6000, donorSpent: 4000, amount: "20.00", demand: "30.00", available: "20.00", uncovered: "10.00" },
    { capacity: -3000, spent: 0, donorFed: 6000, donorSpent: 1000, amount: "30.00", demand: "30.00", available: "50.00", uncovered: "0.00" },
    { capacity: 4000, spent: 1000, donorFed: 6000, donorSpent: 0, amount: "0.00", demand: "0.00", available: "60.00", uncovered: "0.00" },
    { capacity: 4000, spent: 7000, donorFed: 1000, donorSpent: 6000, amount: "0.00", demand: "30.00", available: "0.00", uncovered: "30.00" },
  ])("shows current coverage of $amount and explains settlement-time use", async ({ capacity, spent, donorFed, donorSpent, amount, demand, available, uncovered }) => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", capacity, spent, fed: 0, contingencyPipeId: "donor" };
    mockPipesById.root = { id: "root" };
    mockPipesById.donor = { id: "donor", parentId: "root", name: "Reserve", icon: "wallet", fed: donorFed, spent: donorSpent, capacity: 6000 };
    renderStatistics({ spent });
    const pill = screen.getByRole("button", { name: `Possible coverage, ${amount}, estimated` });
    expect(pill.textContent).toBe(`${amount} ?`);
    expect(within(pill).getByTestId("icon").getAttribute("data-color")).toBe(colors.warningSoft);
    await userEvent.setup().click(pill);
    expect(screen.getByLabelText(`Above capacity, ${demand}`)).toBeDefined();
    expect(screen.getByLabelText(`Reserve funding, ${available}`)).toBeDefined();
    expect(within(screen.getByLabelText(`Reserve funding, ${available}`)).getByTestId("icon").getAttribute("data-name")).toBe("wallet");
    expect(screen.getByText("check donor pipe details for current breakdown")).toBeDefined();
    expect(screen.getByLabelText(`Possible coverage, ${amount}`)).toBeDefined();
    expect(screen.getByLabelText(`Carried-forward debt, ${uncovered}`)).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("Still uncovered")).toBeNull();
    expect(screen.getByText("Uncovered amount before any update.")).toBeDefined();
    expect(screen.getByText("Estimate · Funding is not reserved")).toBeDefined();
    expect(screen.getByText(/Applied at settlement/)).toBeDefined();
  });

  it("updates the estimate with donor balances and hides it when the donor becomes ineligible", () => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", capacity: 4000, spent: 7000, fed: 0, contingencyPipeId: "donor" };
    mockPipesById.root = { id: "root" };
    mockPipesById.donor = { id: "donor", parentId: "root", name: "Reserve", icon: "wallet", fed: 6000, spent: 4000, capacity: 6000 };
    const { rerender } = renderStatistics();
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00, estimated" })).toBeTruthy();
    mockPipesById.donor.spent = 6000;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage, 0.00, estimated" })).toBeTruthy();
    mockPipesById.donor.deletionJobId = "deletion";
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.queryByRole("button", { name: /Possible coverage/ })).toBeNull();
  });

  it("does not show coverage without a selected donor", () => {
    renderStatistics();
    expect(screen.queryByRole("button", { name: /Possible coverage/ })).toBeNull();
  });

  it.each([
    { fed: 6000, spent: 4000, sourceSpent: 7000, amount: "20.00", allocation: "10.00", available: "20.00", left: "0.00" },
    { fed: 10000, spent: 0, sourceSpent: 5500, amount: "30.00", allocation: "15.00", available: "100.00", left: "70.00" },
    { fed: 6000, spent: 6000, sourceSpent: 7000, amount: "0.00", allocation: null, available: "0.00", left: "0.00" },
    { fed: 6000, spent: 0, sourceSpent: 3000, amount: "0.00", allocation: null, available: "60.00", left: "60.00" },
  ])("shows donor coverage of $amount without counting shared funding twice", async ({ fed, spent, sourceSpent, amount, allocation, available, left }) => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", fed, spent, capacity: 6000 };
    mockPipesById.root = { id: "root" };
    mockPipesById.groceries = { id: "groceries", parentId: "root", name: "Groceries", capacity: 4000, spent: sourceSpent, fed: 4000, contingencyPipeId: "test_pipe_id" };
    mockPipesById.rent = { id: "rent", parentId: "root", name: "Rent", capacity: 4000, spent: sourceSpent, fed: 4000, contingencyPipeId: "test_pipe_id" };
    mockPipesById.transport = { id: "transport", parentId: "root", name: "Transport", capacity: 4000, spent: 1000, fed: 4000, contingencyPipeId: "test_pipe_id" };
    // An instant-settlement source's stale selection must not increase the estimate.
    mockPipesById.instant = { id: "instant", parentId: "root", name: "Instant", capacity: 0, spent: 10000, fed: 0, rule: "instant_settlement", contingencyPipeId: "test_pipe_id" };
    renderStatistics({ fed, spent });
    const pill = screen.getByRole("button", { name: `Possible coverage provided, ${amount}, estimated` });
    expect(pill.textContent).toBe(`${amount} ?`);
    expect(within(pill).getByTestId("icon").getAttribute("data-color")).toBe(colors.warningSoft);
    await userEvent.setup().click(pill);
    expect(screen.getByLabelText(`Available funding, ${available}`)).toBeDefined();
    expect(screen.getByLabelText(`Possible coverage, ${amount}`)).toBeDefined();
    expect(screen.getByLabelText(`Funding left if applied, ${left}`)).toBeDefined();
    if (allocation) {
      expect(screen.getByLabelText(`Groceries, ${allocation}`)).toBeDefined();
      expect(screen.getByLabelText(`Rent, ${allocation}`)).toBeDefined();
    } else {
      expect(screen.queryByText("Groceries")).toBeNull();
      expect(screen.queryByText("Rent")).toBeNull();
      expect(screen.getByText("No pipes could receive coverage right now.")).toBeDefined();
    }
    expect(screen.queryByText("Transport")).toBeNull();
    expect(screen.queryByText("Instant")).toBeNull();
    expect(screen.getByText("Estimate · Funding is not reserved")).toBeDefined();
    expect(screen.getByText(/Applied at settlement/)).toBeDefined();
  });

  it("updates donor coverage with source debt and hides it during tree freezes or after the last selection is cleared", () => {
    mockPipesById.test_pipe_id = { ...mockPipesById.test_pipe_id, parentId: "root", fed: 6000, spent: 0, capacity: 6000 };
    mockPipesById.root = { id: "root" };
    mockPipesById.source = { id: "source", parentId: "root", name: "Groceries", capacity: -3000, spent: 0, fed: 0, contingencyPipeId: "test_pipe_id" };
    mockPipesById.sibling = { id: "sibling", parentId: "root" };
    const { rerender } = renderStatistics();
    expect(screen.getByRole("button", { name: "Possible coverage provided, 30.00, estimated" })).toBeTruthy();
    mockPipesById.source.capacity = -5000;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage provided, 50.00, estimated" })).toBeTruthy();
    mockPipesById.sibling.deletionJobId = "deletion";
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.queryByRole("button", { name: /Possible coverage provided/ })).toBeNull();
    delete mockPipesById.sibling.deletionJobId;
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage provided, 50.00, estimated" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00, estimated" })).toBeTruthy();

    mockPipesById.otherRoot = { id: "otherRoot" };
    mockPipesById.otherDeleting = { id: "otherDeleting", parentId: "otherRoot", deletionJobId: "otherDeletion" };
    rerender(<StatisticsRow {...baseProps} now={Date.now()} />);
    expect(screen.getByRole("button", { name: "Possible coverage, 20.00, estimated" })).toBeTruthy();
  });

  it("shows a negative remaining expected amount after exceeding the target", () => {
    renderStatistics({ spent: 100000 });
    expect(screen.getByRole("button", { name: "Remaining expected, -100.00" })).toBeDefined();
  });

  it("calculates StMpD over elapsed days and explains its denominator", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    renderStatistics({ spent: 0, monthlySpent: 45000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spent this month per day, 30.00",
      }),
    );
    expect(
      screen.getByText((_, element) => element?.textContent ===
        "An average of 30.00 was spent per day over 15 days this month."),
    ).toBeDefined();
    expect(screen.getByText((_, element) => element?.textContent ===
      "If maintained, you would spend 930.00 by the end of the month.")).toBeDefined();
    expect(screen.getByText((_, element) => element?.textContent ===
      "This would set you above your expected spend goal by 30.00.")).toBeDefined();
  });

  it("updates daily spending from the screen's clock without sampling render time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    const { rerender } = renderStatistics({ monthlySpent: 45000, now: new Date(2026, 6, 15, 12).getTime() });
    expect(screen.getByRole("button", { name: "Spent this month per day, 30.00" })).toBeDefined();

    rerender(<StatisticsRow {...baseProps} monthlySpent={45000} now={new Date(2026, 6, 16, 12).getTime()} />);
    expect(screen.getByRole("button", { name: "Spent this month per day, 28.13" })).toBeDefined();
  });

  it.each([
    { monthlySpent: 200000, expected: 310000, projection: "3,100.00", outcome: "Leaving you with 0.00 leftover." },
    { monthlySpent: 200000, expected: 309999, projection: "3,100.00", outcome: "This would set you above your expected spend goal by 0.01." },
    { monthlySpent: 100000, expected: 310000, projection: "1,550.00", outcome: "Leaving you with 1,550.00 leftover." },
    { monthlySpent: -20000, expected: 0, projection: "-310.00", outcome: "Leaving you with 310.00 leftover." },
  ])("explains the projected outcome for $monthlySpent cents against $expected cents", ({ projection, outcome, ...props }) => {
    renderStatistics({ ...props, now: Date.UTC(2026, 6, 20, 12) });
    fireEvent.click(screen.getByRole("button", { name: /Spent this month per day,/ }));
    expect(screen.getByText((_, element) => element?.textContent ===
      `If maintained, you would spend ${projection} by the end of the month.`)).toBeDefined();
    expect(screen.getByText((_, element) => element?.textContent === outcome)).toBeDefined();
    if (props.monthlySpent < 0) {
      expect(screen.getByText((_, element) => element?.textContent ===
        "Net spending averaged -10.00 per day over 20 days this month.")).toBeDefined();
    }
  });

  it("shows a loading placeholder rather than a partial average or forecast", () => {
    renderStatistics({ monthlySpent: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Spent this month per day, Loading" }));
    expect(screen.getByText("Loading monthly spending…")).toBeDefined();
    expect(screen.queryByText(/If maintained/)).toBeNull();
  });

  it("calculates and explains accumulated spend through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 12)));
    renderStatistics({ spent: 0 });

    fireEvent.click(
      screen.getByRole("button", { name: "Accumulated spend this month, 50.00" }),
    );
    for (const sentence of [
      "This month’s expected spending is 900.00, or 30.00 per day.",
      "Adding up to today, that gives you an allowance of 450.00.",
      "You’ve spent 400.00 this month, leaving an accumulated allowance of 50.00.",
    ]) {
      expect(screen.getByText((_, element) => element?.textContent === sentence)).toBeDefined();
    }
    expect(screen.queryByText(/positive again|Avoid further spending/)).toBeNull();
  });

  it("keeps accumulated allowance loading until the monthly spending total is ready", () => {
    renderStatistics({ monthlySpent: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Accumulated spend this month, Loading" }));
    expect(screen.getByText("Loading monthly spending…")).toBeDefined();
    expect(screen.queryByText(/accumulated allowance|positive again|Avoid further spending/)).toBeNull();
  });

  it.each([
    { monthlySpent: 50000, amount: "-50.00", color: colors.errorMuted },
    { monthlySpent: 40000, amount: "50.00", color: colors.primaryMuted },
    { monthlySpent: 45000, amount: "0.00", color: colors.primaryMuted },
    { monthlySpent: undefined, amount: "Loading", color: colors.text },
  ])("colors the accumulated spend chip for $amount", ({ monthlySpent, amount, color }) => {
    renderStatistics({ monthlySpent, now: Date.UTC(2026, 5, 15, 12) });
    const chip = screen.getByRole("button", { name: `Accumulated spend this month, ${amount}` });
    expect(within(chip).getByTestId("icon").getAttribute("data-color")).toBe(color);
  });

  it("explains when negative accumulated spend becomes positive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 12)));
    renderStatistics({ spent: 0, monthlySpent: 50000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accumulated spend this month, -50.00",
      }),
    );
    expect(
      screen.getByText("Assuming no further spending, this value will be positive again in 2 days."),
    ).toBeDefined();
  });

  it("warns when accumulated spend cannot recover this month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 12)));
    renderStatistics({ spent: 0, monthlySpent: 100000 });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accumulated spend this month, -550.00",
      }),
    );
    expect(
      screen.getByText(
        "You’ve used up this month’s allowance. Avoid further spending this month.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/positive again in/)).toBeNull();
  });

  it.each([
    { now: "2026-07-01T00:30:00Z", expected: 31000, monthlySpent: 0, amount: "10.00", recovery: null },
    { now: "2028-02-29T23:30:00Z", expected: 29000, monthlySpent: 0, amount: "290.00", recovery: null },
    { now: "2026-06-15T12:00:00Z", expected: 100, monthlySpent: 0, amount: "0.50", recovery: null },
    { now: "2026-06-15T12:00:00Z", expected: 90000, monthlySpent: -1000, amount: "460.00", recovery: null },
    { now: "2026-06-15T12:00:00Z", expected: 90000, monthlySpent: 45000, amount: "0.00", recovery: null },
    { now: "2026-06-15T12:00:00Z", expected: 90000, monthlySpent: 48000, amount: "-30.00", recovery: "2 days" },
    { now: "2026-06-29T12:00:00Z", expected: 90000, monthlySpent: 89000, amount: "-20.00", recovery: "1 day" },
    { now: "2026-06-29T12:00:00Z", expected: 90000, monthlySpent: 90000, amount: "-30.00", recovery: "never" },
    { now: "2026-06-30T12:00:00Z", expected: 90000, monthlySpent: 90001, amount: "-0.01", recovery: "never" },
    { now: "2026-06-15T12:00:00Z", expected: 0, monthlySpent: 1, amount: "-0.01", recovery: "never" },
    { now: "2026-06-15T12:00:00Z", expected: 0, monthlySpent: 0, amount: "0.00", recovery: null },
  ])("shows accumulated allowance $amount with recovery $recovery at $now", ({ now, amount, recovery, ...props }) => {
    renderStatistics({ ...props, spent: 123456, now: Date.parse(now) });
    fireEvent.click(screen.getByRole("button", { name: `Accumulated spend this month, ${amount}` }));
    if (recovery === "never") {
      expect(screen.getByText("You’ve used up this month’s allowance. Avoid further spending this month.")).toBeDefined();
      expect(screen.queryByText(/positive again/)).toBeNull();
    } else if (recovery) {
      expect(screen.getByText(`Assuming no further spending, this value will be positive again in ${recovery}.`)).toBeDefined();
      expect(screen.queryByText(/Avoid further spending/)).toBeNull();
    } else {
      expect(screen.queryByText(/positive again|Avoid further spending/)).toBeNull();
    }
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
      "Expenses were added and counted towards this pipe’s spending budget, but actual funding was taken from somewhere else.",
    ],
    [
      -25000,
      "-250.00",
      "Refunded elsewhere",
      "Refunds were added and reduced this pipe’s spending, but actual funding was received somewhere else.",
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
      expect(screen.queryByText("Next rule run")).toBeNull();
      expect(screen.queryByText("Funding adjustment")).toBeNull();
      const direction = pendingFedAdjustment > 0 ? "increased" : "decreased";
      expect(screen.getByText((_, element) => element?.textContent ===
        `This pipe’s funding will be ${direction} at next settlement by 250.00.`)).toBeDefined();
      expect(screen.getByText(description)).toBeDefined();
    },
  );

  it("hides the external adjustment when payments and refunds net to zero", () => {
    renderStatistics({ pendingFedAdjustment: 0 });
    expect(screen.queryByTestId("external-adjustment-chip")).toBeNull();
  });

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

  it.each([
    { rule: "cron", days: 7, event: "reset", date: "Jul 13, 2026" },
    { rule: "self_destruct", days: 7, event: "self-destroy", date: "Jul 13, 2026" },
    { rule: "cron", days: 1, event: "reset", date: "Jul 7, 2026" },
    { rule: "self_destruct", days: 0, event: "self-destroy", date: "Jul 6, 2026" },
  ])("explains the $rule event in $days days with its date", ({ rule, days, event, date }) => {
    const now = new Date(2026, 6, 6, 12).getTime();
    mockPipesById.test_pipe_id.rule = rule;
    mockPipesById.test_pipe_id.cronNextDate = now + days * 86400000;
    renderStatistics({ now });
    fireEvent.click(screen.getByRole("button", { name: `Days left, ${days}` }));
    expect(screen.getByText(`This pipe will ${event} automatically in ${days} ${days === 1 ? "day" : "days"} (${date}).`)).toBeDefined();
  });

  it("renders no days-left chip for unscheduled pipes", () => {
    renderStatistics();
    const timerIcon = screen
      .queryAllByTestId("icon")
      .find((icon) => icon.getAttribute("data-name") === "timer-outline");
    expect(timerIcon).toBeUndefined();
  });
});
