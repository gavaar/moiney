// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatetimeInput } from "./DatetimeInput";

vi.mock("@react-native-community/datetimepicker", () => ({
  default: ({ mode, onValueChange }: any) => (
    <button
      data-testid="dt-picker"
      data-mode={mode}
      onClick={() => onValueChange(null, new Date(Date.UTC(2026, 0, 15, 9, 30)))}
    />
  ),
}));

describe("DatetimeInput", () => {
  const baseDate = new Date(2026, 6, 21, 15, 45);

  it("renders label", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("Date")).toBeTruthy();
  });

  it("shows formatted date and time", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("21 Jul 2026")).toBeTruthy();
  });

  it("shows different date formatting", () => {
    const date = new Date(2025, 0, 1, 8, 5);
    render(<DatetimeInput label="Date" value={date} onChange={() => {}} />);
    expect(screen.getByText("1 Jan 2025")).toBeTruthy();
  });

  it("shows error message", () => {
    render(
      <DatetimeInput label="Date" value={baseDate} onChange={() => {}} error="Required" />,
    );
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("renders calendar icon and trigger", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByTestId("datetime-trigger")).toBeTruthy();
  });

  it("renders in disabled state", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} disabled />);
    expect(screen.getByTestId("datetime-trigger")).toBeTruthy();
  });

  it("advances to a time step without calling onChange in datetime mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatetimeInput label="Date" value={baseDate} onChange={onChange} />);

    await user.click(screen.getByTestId("datetime-trigger"));
    await user.click(screen.getByTestId("dt-picker"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("dt-picker").getAttribute("data-mode")).toBe("time");
  });

  it("commits the picked date directly and closes in date mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatetimeInput label="Date" mode="date" value={baseDate} onChange={onChange} />);

    await user.click(screen.getByTestId("datetime-trigger"));
    expect(screen.getByTestId("dt-picker").getAttribute("data-mode")).toBe("date");

    await user.click(screen.getByTestId("dt-picker"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as Date).getTime()).toBe(
      Date.UTC(2026, 0, 15, 12),
    );
    expect(screen.queryByTestId("dt-picker")).toBeNull();
  });
});
