// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateInput } from "./DateInput";

describe("DateInput", () => {
  const baseDate = new Date(Date.UTC(2026, 6, 21, 12));

  it("renders label", () => {
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("Date")).toBeTruthy();
  });

  it("shows the formatted date", () => {
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("21 Jul 2026")).toBeTruthy();
  });

  it("shows a placeholder and opens the calendar when the date is unset", async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 28, 12)));

    render(
      <DateInput
        label="From date"
        value={null}
        placeholder="Any date"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText("Any date")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "From date" }));
    expect(screen.getByText("Aug 2026")).toBeTruthy();

    vi.useRealTimers();
  });

  it("shows different date formatting", () => {
    const date = new Date(Date.UTC(2025, 0, 1, 12));
    render(<DateInput label="Date" value={date} onChange={() => {}} />);
    expect(screen.getByText("1 Jan 2025")).toBeTruthy();
  });

  it("labels the date trigger", () => {
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Date" })).toBeTruthy();
  });

  it("shows error message", () => {
    render(
      <DateInput label="Date" value={baseDate} onChange={() => {}} error="Required" />,
    );
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("renders calendar icon and trigger", () => {
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByTestId("date-trigger")).toBeTruthy();
  });

  it("renders in disabled state", () => {
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} disabled />);
    expect(screen.getByTestId("date-trigger")).toBeTruthy();
  });

  it("opens the calendar when the trigger is pressed", async () => {
    const user = userEvent.setup();
    render(<DateInput label="Date" value={baseDate} onChange={() => {}} />);

    await user.click(screen.getByTestId("date-trigger"));

    expect(screen.getByTestId("calendar-title")).toBeTruthy();
    expect(screen.getByText("Jul 2026")).toBeTruthy();
  });

  it("commits a picked day at UTC noon and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput label="Date" value={baseDate} onChange={onChange} />);

    await user.click(screen.getByTestId("date-trigger"));
    await user.click(screen.getByTestId("day-15"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].getTime()).toBe(Date.UTC(2026, 6, 15, 12));
    expect(screen.queryByTestId("calendar-title")).toBeNull();
  });

  it("cancels via backdrop without committing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput label="Date" value={baseDate} onChange={onChange} />);

    await user.click(screen.getByTestId("date-trigger"));
    await user.click(screen.getByTestId("modal-backdrop"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("calendar-title")).toBeNull();
  });
});
