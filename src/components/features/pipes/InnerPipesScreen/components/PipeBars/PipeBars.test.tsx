// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipeBars } from "./PipeBars";

describe("PipeBars", () => {
  it("splits projected spending into actual spending and possible coverage with one combined amount", () => {
    render(<PipeBars fed={10000} capacity={10000} spent={4000} expected={10000} coverageProvidedCents={4000} />);
    expect(screen.getByTestId("bar-spent-fill").style.width).toBe("40%");
    const coverage = screen.getByTestId("bar-spent-coverage-fill");
    expect(coverage.style.left).toBe("40%");
    expect(coverage.style.width).toBe("40%");
    expect(screen.getByText("80.00")).toBeTruthy();
    expect(screen.queryByText(/spent \+/)).toBeNull();
  });

  it("does not show a warning segment at zero coverage", () => {
    render(<PipeBars fed={10000} capacity={10000} spent={10000} expected={10000} coverageProvidedCents={0} />);
    expect(screen.queryByTestId("bar-spent-coverage-fill")).toBeNull();
    expect(screen.getByTestId("bar-spent-fill").style.width).toBe("100%");
  });

  it("keeps refunds distinct from possible coverage", () => {
    render(<PipeBars fed={10000} capacity={10000} spent={-4000} expected={10000} coverageProvidedCents={4000} />);
    expect(screen.getByTestId("bar-spent-coverage-fill").style.left).toBe("0%");
    expect(screen.getByText("0.00")).toBeTruthy();
  });

  it("shows a coverage-only spent row for an instant-settlement donor", () => {
    render(<PipeBars fed={10000} capacity={10000} spent={0} expected={10000} rule="instant_settlement" coverageProvidedCents={4000} />);
    expect(screen.getByTestId("bar-spent-coverage-fill").style.width).toBe("40%");
    expect(screen.getByText("40.00")).toBeTruthy();
  });
  it("shows fed before expected and spent without displaying or scaling by capacity", () => {
    const { container } = render(
      <PipeBars fed={5000} spent={1000} capacity={100000} expected={10000} />,
    );

    expect(container.textContent).toMatch(/fed.*expected.*spent/);
    expect(screen.queryByText("capacity")).toBeNull();
    expect(screen.getByTestId("bar-fed-fill").style.width).toBe("50%");
  });

  it("renders labels and values", () => {
    render(
      <PipeBars
        fed={150000}
        spent={120000}
        capacity={200000}
        expected={180000}
      />,
    );
    expect(screen.getByText("fed")).toBeDefined();
    expect(screen.getByText("spent")).toBeDefined();
    expect(screen.queryByText("capacity")).toBeNull();
    expect(screen.getByText("expected")).toBeDefined();
    expect(screen.getByText("1,500.00")).toBeDefined();
    expect(screen.getByText("1,200.00")).toBeDefined();
    expect(screen.queryByText("2,000.00")).toBeNull();
    expect(screen.getByText("1,800.00")).toBeDefined();
  });

  it("hides the expected bar when its value is zero", () => {
    render(
      <PipeBars
        fed={5000}
        spent={1000}
        capacity={10000}
        expected={0}
      />,
    );

    expect(screen.queryByTestId("bar-expected-fill")).toBeNull();
  });

  it("includes expected funding when scaling financial proportions", () => {
    render(
      <PipeBars
        fed={10000}
        spent={4000}
        capacity={15000}
        expected={12000}
      />,
    );

    const expected = screen.getByTestId("bar-expected-fill");
    expect(expected.style.width).toBe("100%");
  });

  it("overlays a positive external adjustment at the beginning of the fed bar", () => {
    render(
      <PipeBars
        fed={5000}
        spent={4500}
        capacity={5000}
        expected={5000}
        pendingFedAdjustment={500}
      />,
    );

    const adjustment = screen.getByTestId("bar-fed-adjustment-fill");
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
        expected={15000}
        pendingFedAdjustment={-900}
      />,
    );

    const adjustment = screen.getByTestId("bar-fed-adjustment-fill");
    expect(adjustment.style.left).toBe("94%");
    expect(adjustment.style.width).toBe("6%");
  });

  it("hides the spent bar when rule is instant_settlement", () => {
    render(
      <PipeBars
        fed={150000}
        spent={0}
        capacity={200000}
        expected={200000}
        rule="instant_settlement"
      />,
    );
    expect(screen.queryByText("spent")).toBeNull();
    expect(screen.queryByTestId("bar-spent-fill")).toBeNull();
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.queryByTestId("bar-capacity-fill")).toBeNull();
  });

  it("shows the spent bar when rule is spend_overflow", () => {
    render(
      <PipeBars
        fed={150000}
        spent={120000}
        capacity={200000}
        expected={200000}
        rule="spend_overflow"
      />,
    );
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
  });

  it("labels boiler contributions without hiding spending by source type", () => {
    const { container } = render(
      <PipeBars
        fed={10000}
        spent={100000}
        capacity={10000}
        expected={10000}
        sourceType="boiler"
      />,
    );

    expect(screen.getByText("contributed")).toBeDefined();
    expect(container.textContent).toMatch(/fed.*expected.*contributed.*spent/);
    expect(screen.queryByText("capacity")).toBeNull();
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
    expect(screen.getByTestId("bar-fed-fill").style.width).toBe("10%");
  });
});
