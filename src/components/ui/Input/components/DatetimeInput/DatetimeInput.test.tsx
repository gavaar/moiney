// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatetimeInput } from "./DatetimeInput";

describe("DatetimeInput", () => {
  const baseDate = new Date(2026, 6, 21, 15, 45);

  it("renders label", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("Date")).toBeTruthy();
  });

  it("shows formatted date and time", () => {
    render(<DatetimeInput label="Date" value={baseDate} onChange={() => {}} />);
    expect(screen.getByText("Jul 21, 2026 3:45 PM")).toBeTruthy();
  });

  it("shows different date formatting", () => {
    const date = new Date(2025, 0, 1, 8, 5);
    render(<DatetimeInput label="Date" value={date} onChange={() => {}} />);
    expect(screen.getByText("Jan 1, 2025 8:05 AM")).toBeTruthy();
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
});
