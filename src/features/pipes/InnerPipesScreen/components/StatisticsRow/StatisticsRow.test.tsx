// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/dates", () => ({
  getDaysInMonth: () => 30,
}));

import { StatisticsRow } from "./StatisticsRow";

vi.mock("@/components/ui/Modal", () => ({
  ModalShell: ({ visible, children, onClose, testID }: any) =>
    visible ? (
      <div data-testid={testID ?? "modal-shell"}>
        <div data-testid="modal-backdrop" onClick={onClose} />
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

  it("opens stat description modal on tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    await user.click(screen.getByText(/L2S: 600\.00/));
    expect(screen.getByText(/Left to spend \(L2S\):/)).toBeDefined();
  });

  it("closes stat modal on backdrop tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    await user.click(screen.getByText(/StM: 400\.00/));
    expect(screen.getByText(/Spent this month \(StM\):/)).toBeDefined();
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByText(/Spent this month \(StM\):/)).toBeNull();
  });

  it("opens options modal on options icon tap", async () => {
    const user = userEvent.setup();
    render(<StatisticsRow fed={1000} spent={400} />);
    const icons = screen.getAllByTestId("icon");
    const optionsIcon = icons.find((i) => i.getAttribute("data-name") === "ellipsis-vertical")!;
    await user.click(optionsIcon);
    expect(screen.getByText("options modal")).toBeDefined();
  });

  it("renders separators between stats", () => {
    render(<StatisticsRow fed={1000} spent={400} />);
    const separators = screen.getAllByText("|");
    expect(separators.length).toBe(2);
  });
});
