// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipeBars } from "./PipeBars";

describe("PipeBars", () => {
  it("renders labels and values", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} max={2000} />);
    expect(screen.getByText("fed")).toBeDefined();
    expect(screen.getByText("spent")).toBeDefined();
    expect(screen.getByText("capacity")).toBeDefined();
    expect(screen.getByText("1500.00")).toBeDefined();
    expect(screen.getByText("1200.00")).toBeDefined();
    expect(screen.getByText("2000.00")).toBeDefined();
  });

  it("renders fed bar with green fill", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} max={2000} />);
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
  });

  it("renders spent bar with red fill", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} max={2000} />);
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
  });

  it("renders capacity bar with dashed line", () => {
    render(<PipeBars fed={1500} spent={1200} capacity={2000} max={2000} />);
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });
});
