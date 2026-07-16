// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedBox } from "./FeedBox";

describe("FeedBox", () => {
  const baseProps = {
    name: "Groceries",
    icon: "cart-outline",
    description: "Food and household items",
    capacity: 1500,
    fed: 1000,
    spent: 500,
  };

  it("renders feed name", () => {
    render(<FeedBox {...baseProps} />);
    expect(screen.getByText("Groceries")).toBeDefined();
  });

  it("renders summary text with spent, fed, and capacity", () => {
    render(<FeedBox {...baseProps} />);
    expect(screen.getByText("500.0 / 1000.0")).toBeDefined();
  });

  it("renders icon with primary color", () => {
    render(<FeedBox {...baseProps} />);
    const icon = screen.getByTestId("mock-icon");
    expect(icon.getAttribute("color")).toBe("#46AE82");
  });

  it("calls onPress when tapped", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<FeedBox {...baseProps} onPress={onPress} />);
    await user.click(screen.getByText("Groceries"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders with zero capacity, fed, and spent", () => {
    render(
      <FeedBox
        {...baseProps}
        capacity={0}
        fed={0}
        spent={0}
      />,
    );
    expect(screen.getByText("0.0 / 0.0")).toBeDefined();
  });
});
