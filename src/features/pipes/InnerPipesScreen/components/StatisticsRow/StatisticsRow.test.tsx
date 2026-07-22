// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/dates", () => ({
  getDaysInMonth: () => 30,
}));

vi.mock("@/features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    selectedPipePath: ["test_pipe_id"],
    pipesById: {
      test_pipe_id: { _id: "test_pipe_id", name: "Test Pipe", icon: "home-outline" },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/pipes/InnerPipesScreen/components/DeletePipeConfirmation", () => ({
  DeletePipeConfirmation: ({ visible }: any) =>
    visible ? <div data-testid="delete-confirmation">Delete confirmation</div> : null,
}));

import { StatisticsRow } from "./StatisticsRow";

vi.mock("@/components/ui/Popover", () => ({
  Popover: ({ visible, children, onClose, testID }: any) =>
    visible ? (
      <div data-testid={testID ?? "popover"}>
        <div data-testid="popover-backdrop" onClick={onClose} />
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

describe("StatisticsRow", () => {
  it("renders all three stat labels", () => {
    render(<StatisticsRow fed={1000} spent={400} />);
    expect(screen.getByText(/L2S:/)).toBeDefined();
    expect(screen.getByText(/StM:/)).toBeDefined();
    expect(screen.getByText(/StMpD:/)).toBeDefined();
  });

  it("renders correct computed values", () => {
    render(<StatisticsRow fed={1000} spent={400} />);
    expect(screen.getByText(/L2S: 600\.00/)).toBeDefined();
    expect(screen.getByText(/StM: 400\.00/)).toBeDefined();
    expect(screen.getByText(/StMpD: 13\.33/)).toBeDefined();
  });

  it("renders options icon", () => {
    render(<StatisticsRow fed={1000} spent={400} />);
    const icons = screen.getAllByTestId("icon");
    const optionsIcon = icons.find((i) => i.getAttribute("data-name") === "ellipsis-vertical");
    expect(optionsIcon).toBeDefined();
  });

  it("opens stat description popover on tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    await user.click(screen.getByText(/L2S: 600\.00/));
    expect(screen.getByText(/Left to spend \(L2S\):/)).toBeDefined();
  });

  it("closes stat popover on backdrop tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    await user.click(screen.getByText(/StM: 400\.00/));
    expect(screen.getByText(/Spent this month \(StM\):/)).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByText(/Spent this month \(StM\):/)).toBeNull();
  });

  it("opens popover on options icon tap showing edit and delete icons", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    const icons = screen.getAllByTestId("icon");
    const optionsIcon = icons.find((i) => i.getAttribute("data-name") === "ellipsis-vertical")!;
    await user.click(optionsIcon);
    const popoverIcons = screen.getAllByTestId("icon");
    const pencil = popoverIcons.find((i) => i.getAttribute("data-name") === "pencil-outline");
    const trash = popoverIcons.find((i) => i.getAttribute("data-name") === "trash-bin-outline");
    expect(pencil).toBeDefined();
    expect(trash).toBeDefined();
  });

  it("closes popover on backdrop tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    const icons = screen.getAllByTestId("icon");
    const optionsIcon = icons.find((i) => i.getAttribute("data-name") === "ellipsis-vertical")!;
    await user.click(optionsIcon);
    expect(screen.getByTestId("popover")).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByTestId("popover")).toBeNull();
  });

  it("renders separators between stats", () => {
    render(<StatisticsRow fed={1000} spent={400} />);
    const separators = screen.getAllByText("|");
    expect(separators.length).toBe(2);
  });

  it("opens delete confirmation modal on trash tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    const icons = screen.getAllByTestId("icon");
    const optionsIcon = icons.find((i) => i.getAttribute("data-name") === "ellipsis-vertical")!;
    await user.click(optionsIcon);
    const popoverIcons = screen.getAllByTestId("icon");
    const trash = popoverIcons.find((i) => i.getAttribute("data-name") === "trash-bin-outline")!;
    await user.click(trash);
    expect(screen.getByTestId("delete-confirmation")).toBeDefined();
  });
});
