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
    pipesById: mockPipesById,
    isLoading: false,
  }),
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
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

describe("StatisticsRow", () => {
  beforeEach(() => {
    mockPipesById = {
      test_pipe_id: { _id: "test_pipe_id", name: "Test Pipe", icon: "home-outline" },
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

  it("opens stat description popover on tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={100000} spent={40000} />);
    await user.click(screen.getByText(/L2S: 600\.00/));
    expect(screen.getByText(/Left to spend \(L2S\):/)).toBeDefined();
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
        _id: "test_pipe_id",
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
        _id: "test_pipe_id",
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
