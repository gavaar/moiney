// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "./Calendar";

const JULY = Date.UTC(2026, 6, 21, 12);

function renderCalendar(props: Partial<Parameters<typeof Calendar>[0]> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <Calendar
      visible
      value={new Date(JULY)}
      onChange={onChange}
      onClose={onClose}
      {...props}
    />,
  );
  return { onChange, onClose, ...utils };
}

describe("Calendar", () => {
  it("renders the month header and weekday labels", () => {
    renderCalendar();
    expect(screen.getByText("Jul 2026")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByText("F")).toBeTruthy();
    expect(screen.getAllByText("S").length).toBe(2);
  });

  it("renders one cell per day in the month", () => {
    renderCalendar();
    expect(screen.getAllByTestId(/^day-/).length).toBe(31);
  });

  it("labels calendar navigation controls", () => {
    renderCalendar();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select calendar view" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose today" })).toBeTruthy();
  });

  it("marks the selected day", () => {
    renderCalendar();
    expect(screen.getByTestId("day-21").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("day-1").getAttribute("aria-selected")).toBe("false");
  });

  it("marks today in the current month", () => {
    const today = new Date();
    const todayNoon = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12),
    );
    renderCalendar({ value: todayNoon });
    expect(
      screen.getByTestId(`day-${today.getDate()}`).getAttribute("aria-current"),
    ).toBe("date");
  });

  it("commits the picked day at UTC noon and closes", async () => {
    const user = userEvent.setup();
    const { onChange, onClose } = renderCalendar();

    await user.click(screen.getByTestId("day-15"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].getTime()).toBe(Date.UTC(2026, 6, 15, 12));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to the previous and next month", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByTestId("calendar-next"));
    expect(screen.getByText("Aug 2026")).toBeTruthy();

    await user.click(screen.getByTestId("calendar-prev"));
    expect(screen.getByText("Jul 2026")).toBeTruthy();
  });

  it("cycles header views: days -> months -> years -> days", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByTestId("calendar-title"));
    expect(screen.getByText("2026")).toBeTruthy();

    await user.click(screen.getByTestId("calendar-title"));
    expect(screen.getByText("2021 - 2030")).toBeTruthy();

    await user.click(screen.getByTestId("calendar-title"));
    expect(screen.getByText("Jul 2026")).toBeTruthy();
  });

  it("selecting a month returns to the days view", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByTestId("calendar-title"));
    await user.click(screen.getByTestId("month-7"));

    expect(screen.getByText("Aug 2026")).toBeTruthy();
    expect(screen.getAllByTestId(/^day-/).length).toBe(31);
  });

  it("selecting a year returns to the months view", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByTestId("calendar-title"));
    await user.click(screen.getByTestId("calendar-title"));
    await user.click(screen.getByTestId("year-2024"));

    expect(screen.getByText("2024")).toBeTruthy();
    expect(screen.getByTestId("month-6")).toBeTruthy();
  });

  it("pages the year range in years view", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByTestId("calendar-title"));
    await user.click(screen.getByTestId("calendar-title"));
    await user.click(screen.getByTestId("calendar-next"));
    expect(screen.getByText("2031 - 2040")).toBeTruthy();
  });

  it("Today button commits today and closes", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const todayNoon = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    const { onChange, onClose } = renderCalendar();

    await user.click(screen.getByTestId("calendar-today"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].getTime()).toBe(todayNoon);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop tap cancels without committing", async () => {
    const user = userEvent.setup();
    const { onChange, onClose } = renderCalendar();

    await user.click(screen.getByTestId("modal-backdrop"));

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
