// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipeBars } from "./PipeBars";
import { colors } from "@/lib/styles";

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe("PipeBars", () => {
  it("renders labels and values", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} />);
    expect(screen.getByText("fed")).toBeDefined();
    expect(screen.getByText("spent")).toBeDefined();
    expect(screen.getByText("capacity")).toBeDefined();
    expect(screen.getByText("1,500.00")).toBeDefined();
    expect(screen.getByText("1,200.00")).toBeDefined();
    expect(screen.getByText("2,000.00")).toBeDefined();
  });

  it("renders fed bar with green fill", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} />);
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
  });

  it("renders spent bar with red fill when positive", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} />);
    const fill = screen.getByTestId("bar-spent-fill");
    expect(fill.style.backgroundColor).toBe(toRgb(colors.error));
  });

  it("renders spent bar with green fill when negative", () => {
    render(<PipeBars fed={100} spent={-500} capacity={2000} />);
    const fill = screen.getByTestId("bar-spent-fill");
    expect(fill.style.backgroundColor).toBe(toRgb(colors.primary));
  });

  it("renders capacity bar with a dashed line", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} />);
    expect(screen.getByTestId("bar-capacity-fill").style.borderTopStyle).toBe("dashed");
  });

  it("hides the spent bar when rule is any_spend", () => {
    render(<PipeBars fed={1500} spent={0} capacity={2000} rule="any_spend" />);
    expect(screen.queryByText("spent")).toBeNull();
    expect(screen.queryByTestId("bar-spent-fill")).toBeNull();
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });

  it("shows the spent bar when rule is spend_overflow", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} rule="spend_overflow" />);
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
  });
});
