// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders all three stat labels", () => {
    render(<StatisticsRow fed={100000} spent={40000} />);
    expect(screen.getByText(/L2S:/)).toBeDefined();
    expect(screen.getByText(/StM:/)).toBeDefined();
    expect(screen.getByText(/StMpD:/)).toBeDefined();
  });

  it("renders correct computed values", () => {
    render(<StatisticsRow fed={100000} spent={40000} />);
    expect(screen.getByText(/L2S: 600\.00/)).toBeDefined();
    expect(screen.getByText(/StM: 400\.00/)).toBeDefined();
    expect(screen.getByText(/StMpD: 13\.33/)).toBeDefined();
  });

  it("keeps paid-elsewhere adjustments out of L2S and explains the purple chip", async () => {
    const user = userEvent.setup();
    render(
      <StatisticsRow fed={100000} spent={40000} pendingFedAdjustment={25000} />,
    );

    expect(screen.getByText(/L2S: 600\.00/)).toBeDefined();
    expect(screen.getByTestId("external-adjustment-chip")).toBeDefined();
    expect(screen.getByText("+250.00")).toBeDefined();
    expect(
      screen
        .getAllByTestId("icon")
        .find(
          (icon) =>
            icon.getAttribute("data-name") === "swap-horizontal-outline",
        ),
    ).toBeDefined();

    await user.click(screen.getByTestId("external-adjustment-chip"));
    expect(screen.getByText(/Paid elsewhere/)).toBeDefined();
    expect(
      screen.getByText(
        "This spending counts toward this pipe, but another pipe paid for it. The next rule run will add 250.00 to this pipe's fed balance.",
      ),
    ).toBeDefined();
  });

  it("keeps refunded-elsewhere adjustments out of L2S and explains the purple chip", async () => {
    const user = userEvent.setup();
    render(
      <StatisticsRow
        fed={100000}
        spent={40000}
        pendingFedAdjustment={-25000}
      />,
    );

    expect(screen.getByText(/L2S: 600\.00/)).toBeDefined();
    expect(screen.getByText("-250.00")).toBeDefined();

    await user.click(screen.getByTestId("external-adjustment-chip"));
    expect(screen.getByText(/Refunded elsewhere/)).toBeDefined();
    expect(
      screen.getByText(
        "This refund reduces this pipe's spending, but another pipe received it. The next rule run will subtract 250.00 from this pipe's fed balance.",
      ),
    ).toBeDefined();
  });

  it("opens stat description popover on tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={100000} spent={40000} />);
    await user.click(screen.getByText(/L2S: 600\.00/));
    expect(screen.getByText(/Left to spend \(L2S\):/)).toBeDefined();
  });

  it("shows positive boiler growth in blue with an explanation", async () => {
    const user = userEvent.setup();
    render(
      <StatisticsRow
        fed={150000}
        spent={0}
        sourceType="boiler"
        contributedFed={100000}
      />,
    );

    const growth = screen.getByTestId("boiler-growth-chip");
    expect(growth.textContent).toContain("+50%");
    expect(
      screen.getByRole("button", { name: "Boiler growth, non-negative" }),
    ).toBeDefined();

    await user.click(growth);
    expect(
      screen.getByText(
        "This pipe has received 1,000.00 value, but now holds 1,500.00, meaning it has grown +50%.",
      ),
    ).toBeDefined();
  });

  it("shows negative boiler growth in red", () => {
    render(
      <StatisticsRow
        fed={75000}
        spent={0}
        sourceType="boiler"
        contributedFed={100000}
      />,
    );

    const growth = screen.getByTestId("boiler-growth-chip");
    expect(growth.textContent).toContain("-25%");
    expect(
      screen.getByRole("button", { name: "Boiler growth, negative" }),
    ).toBeDefined();
  });

  it("shows unavailable growth when no principal has been contributed", () => {
    render(
      <StatisticsRow
        fed={10000}
        spent={0}
        sourceType="boiler"
        contributedFed={0}
      />,
    );

    expect(screen.getByTestId("boiler-growth-chip").textContent).toContain(
      "N/A",
    );
  });

  it("closes stat popover on backdrop tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={100000} spent={40000} />);
    await user.click(screen.getByText(/StM: 400\.00/));
    expect(screen.getByText(/Spent this month \(StM\):/)).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByText(/Spent this month \(StM\):/)).toBeNull();
  });

  it("renders separators between stats", () => {
    render(<StatisticsRow fed={100000} spent={40000} />);
    const separators = screen.getAllByText("|");
    expect(separators.length).toBe(2);
  });

  it("renders days left with a timer-outline icon for cron pipes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12));
    mockPipesById = {
      test_pipe_id: {
        id: "test_pipe_id",
        name: "Test Pipe",
        icon: "home-outline",
        rule: "cron",
        cronNextDate: Date.UTC(2026, 6, 13, 12),
      },
    };

    render(<StatisticsRow fed={100000} spent={40000} />);

    const timerIcon = screen
      .getAllByTestId("icon")
      .find((i) => i.getAttribute("data-name") === "timer-outline");
    expect(timerIcon).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
  });

  it("renders 0 days left when the cron reset is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12));
    mockPipesById = {
      test_pipe_id: {
        id: "test_pipe_id",
        name: "Test Pipe",
        icon: "home-outline",
        rule: "cron",
        cronNextDate: Date.UTC(2026, 6, 1, 12),
      },
    };

    render(<StatisticsRow fed={100000} spent={40000} />);

    expect(screen.getByText("0")).toBeDefined();
  });

  it("renders no timer-outline chip for non-cron pipes", () => {
    render(<StatisticsRow fed={100000} spent={40000} />);

    const timerIcon = screen
      .queryAllByTestId("icon")
      .find((i) => i.getAttribute("data-name") === "timer-outline");
    expect(timerIcon).toBeUndefined();
  });
});
