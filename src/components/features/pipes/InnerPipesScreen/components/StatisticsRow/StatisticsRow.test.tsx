// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { StatisticsRow } from "./StatisticsRow";

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
  Icon: ({ name, testID }: any) => (
    <span data-testid={testID ?? "icon"} data-name={name} />
  ),
}));

const baseProps = {
  fed: 100000,
  spent: 40000,
  capacity: 100000,
  expected: 90000,
};

function renderStatistics(
  overrides: Partial<React.ComponentProps<typeof StatisticsRow>> = {},
) {
  return render(<StatisticsRow {...baseProps} {...overrides} />);
}

describe("StatisticsRow", () => {
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

  it("calculates L2S from operational capacity and explains the amount", async () => {
    const user = userEvent.setup();
    renderStatistics({ capacity: 200000 });

    await user.click(
      screen.getByRole("button", { name: "Left to spend, 1,600.00" }),
    );
    expect(
      screen.getByText(
        "You have 1,600.00 left to spend from this pipe at the moment.",
      ),
    ).toBeDefined();
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
      screen.getByRole("button", { name: "Left to spend, 600.00" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Spent this month per day, 26.67",
      }),
    ).toBeDefined();
    expect(screen.queryByText(/L2S:|StM:|StMpD:/)).toBeNull();
  });

  it("hides boiler L2S and presents growth as a statistic", () => {
    renderStatistics({
      fed: 150000,
      spent: 0,
      capacity: 0,
      expected: 0,
      sourceType: "boiler",
      contributedFed: 100000,
    });

    expect(screen.queryByRole("button", { name: /Left to spend/ })).toBeNull();
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
    "keeps an external adjustment of %s out of L2S and explains it",
    async (pendingFedAdjustment, displayValue, title, description) => {
      const user = userEvent.setup();
      renderStatistics({ pendingFedAdjustment });

      expect(
        screen.getByRole("button", { name: "Left to spend, 600.00" }),
      ).toBeDefined();
      expect(screen.getByText(displayValue)).toBeDefined();
      await user.click(screen.getByTestId("external-adjustment-chip"));
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
      screen.getByRole("button", { name: "Left to spend, 600.00" }),
    );
    expect(screen.getByText(/Left to spend:/)).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByText(/Left to spend:/)).toBeNull();
  });

  it("renders days left for cron pipes and clamps past dates to zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12));
    mockPipesById.test_pipe_id.rule = "cron";
    mockPipesById.test_pipe_id.cronNextDate = Date.UTC(2026, 6, 13, 12);
    const { rerender } = renderStatistics();
    expect(screen.getByText("7")).toBeDefined();

    mockPipesById.test_pipe_id.cronNextDate = Date.UTC(2026, 6, 1, 12);
    rerender(<StatisticsRow {...baseProps} />);
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
