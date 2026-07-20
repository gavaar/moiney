// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "./NumberInput";

describe("NumberInput", () => {
  it("renders label, minus button, value, and plus button", () => {
    render(<NumberInput label="Priority" value={5} onChange={() => {}} />);
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByTestId("decrement-button")).toBeTruthy();
    expect(screen.getByTestId("increment-button")).toBeTruthy();
    expect(screen.getByDisplayValue("5")).toBeTruthy();
  });

  it("increments value on plus press", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={5} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("increment-button"));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("decrements value on minus press", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={5} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("decrement-button"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("does not decrement below min", () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={0} min={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("decrement-button"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not increment above max", () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={10} max={10} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("increment-button"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses custom step", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={5} step={3} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("increment-button"));
    expect(onChange).toHaveBeenCalledWith(8);
    await userEvent.click(screen.getByTestId("decrement-button"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("accepts typed numeric value", () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={0} onChange={onChange} />);
    const input = screen.getByDisplayValue("0");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("filters non-numeric input", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={5} onChange={onChange} />);
    const input = screen.getByDisplayValue("5");
    await userEvent.clear(input);
    await userEvent.type(input, "abc");
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("clamps value to min on blur when below min", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={-5} min={0} onChange={onChange} />);
    const input = screen.getByDisplayValue("-5");
    await userEvent.click(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("clamps value to max on blur when above max", async () => {
    const onChange = vi.fn();
    render(<NumberInput label="Test" value={200} max={100} onChange={onChange} />);
    const input = screen.getByDisplayValue("200");
    await userEvent.click(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("shows error message", () => {
    render(<NumberInput label="Test" value={0} onChange={() => {}} error="Invalid" />);
    expect(screen.getByText("Invalid")).toBeTruthy();
  });
});
