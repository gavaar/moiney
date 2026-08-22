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
    render(<PipeBars fed={150000} spent={120000} capacity={200000} />);
    expect(screen.getByText("fed")).toBeDefined();
    expect(screen.getByText("spent")).toBeDefined();
    expect(screen.getByText("capacity")).toBeDefined();
    expect(screen.getByText("1,500.00")).toBeDefined();
    expect(screen.getByText("1,200.00")).toBeDefined();
    expect(screen.getByText("2,000.00")).toBeDefined();
  });

  it("renders fed bar with green fill", () => {
    render(<PipeBars fed={150000} spent={120000} capacity={200000} />);
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
  });

  it("overlays a positive external adjustment at the beginning of the fed bar", () => {
    render(
      <PipeBars
        fed={5000}
        spent={4500}
        capacity={5000}
        pendingFedAdjustment={500}
      />,
    );

    const adjustment = screen.getByTestId("bar-fed-adjustment-fill");
    expect(adjustment.style.backgroundColor).toBe(toRgb(colors.accent));
    expect(adjustment.style.left).toBe("0%");
    expect(adjustment.style.width).toBe("10%");
    expect(screen.queryByText("55.00")).toBeNull();
  });

  it("overlays a negative external adjustment at the end of the fed bar", () => {
    render(
      <PipeBars
        fed={15000}
        spent={14415}
        capacity={15000}
        pendingFedAdjustment={-900}
      />,
    );

    const adjustment = screen.getByTestId("bar-fed-adjustment-fill");
    expect(adjustment.style.backgroundColor).toBe(toRgb(colors.accent));
    expect(adjustment.style.left).toBe("94%");
    expect(adjustment.style.width).toBe("6%");
  });

  it("renders spent bar with red fill when positive", () => {
    render(<PipeBars fed={150000} spent={120000} capacity={200000} />);
    const fill = screen.getByTestId("bar-spent-fill");
    expect(fill.style.backgroundColor).toBe(toRgb(colors.error));
  });

  it("renders spent bar with green fill when negative", () => {
    render(<PipeBars fed={10000} spent={-50000} capacity={200000} />);
    const fill = screen.getByTestId("bar-spent-fill");
    expect(fill.style.backgroundColor).toBe(toRgb(colors.primary));
  });

  it("renders capacity bar with a dashed line", () => {
    render(<PipeBars fed={150000} spent={120000} capacity={200000} />);
    expect(screen.getByTestId("bar-capacity-fill").style.borderTopStyle).toBe(
      "dashed",
    );
  });

  it("hides the spent bar when rule is instant_settlement", () => {
    render(
      <PipeBars
        fed={150000}
        spent={0}
        capacity={200000}
        rule="instant_settlement"
      />,
    );
    expect(screen.queryByText("spent")).toBeNull();
    expect(screen.queryByTestId("bar-spent-fill")).toBeNull();
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });

  it("shows the spent bar when rule is spend_overflow", () => {
    render(
      <PipeBars
        fed={150000}
        spent={120000}
        capacity={200000}
        rule="spend_overflow"
      />,
    );
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
  });
});
