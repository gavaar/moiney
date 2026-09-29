// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipeBox } from "./PipeBox";

describe("PipeBox", () => {
  const baseProps = {
    name: "Groceries",
    icon: "cart-outline",
    description: "Food and household items",
    priority: 0,
    capacity: 150000,
    fed: 100000,
    spent: 50000,
    showPriority: true,
  };

  it("renders feed name", () => {
    render(<PipeBox {...baseProps} />);
    expect(screen.getByText("Groceries")).toBeDefined();
  });

  it("renders summary text with spent, fed, and capacity", () => {
    render(<PipeBox {...baseProps} />);
    expect(screen.getByText("500.00 / 1,000.00")).toBeDefined();
  });

  it("renders icon with primary color", () => {
    render(<PipeBox {...baseProps} />);
    const icon = screen.getByTestId("mock-icon");
    expect(icon.getAttribute("color")).toBe("#F8F8F8");
  });

  it("calls onPress when tapped", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<PipeBox {...baseProps} onPress={onPress} />);
    await user.click(screen.getByText("Groceries"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("opens options on a held pipe without selecting it", async () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    render(<PipeBox {...baseProps} onPress={onPress} onLongPress={onLongPress} />);
    const pipe = screen.getByRole("button", { name: "Groceries" });
    const touch = { identifier: 1, clientX: 10, clientY: 10, pageX: 10, pageY: 10, target: pipe };
    fireEvent.touchStart(pipe, { touches: [touch], changedTouches: [touch] });
    await waitFor(() => expect(onLongPress).toHaveBeenCalledTimes(1), { timeout: 1200 });
    fireEvent.touchEnd(pipe, { changedTouches: [{ identifier: 1, pageX: 10, pageY: 10 }] });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders with zero capacity, fed, and spent", () => {
    render(
      <PipeBox
        {...baseProps}
        capacity={0}
        fed={0}
        spent={0}
      />,
    );
    expect(screen.getByText("0.00")).toBeDefined();
  });
});
