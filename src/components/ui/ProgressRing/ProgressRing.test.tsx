// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressRing } from "./ProgressRing";

const CIRC = 2 * Math.PI * 14.5;

function circleProps(index: number) {
  const circles = screen.getAllByTestId("svg-circle");
  return JSON.parse(circles[index].getAttribute("data-props") ?? "{}");
}

describe("ProgressRing", () => {
  it("renders only the progress circle when no trackColor is provided", () => {
    render(<ProgressRing progress={0.5} color="#F8F8F8" />);
    expect(screen.getByTestId("svg")).toBeTruthy();
    expect(screen.getAllByTestId("svg-circle")).toHaveLength(1);

    const progress = circleProps(0);
    expect(progress.stroke).toBe("#F8F8F8");
    expect(progress.r).toBe(14.5);
    expect(progress.fill).toBe("none");
  });

  it("renders an extra track circle when trackColor is provided", () => {
    render(
      <ProgressRing progress={0.5} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    const circles = screen.getAllByTestId("svg-circle");
    expect(circles).toHaveLength(2);
    expect(JSON.parse(circles[0].getAttribute("data-props") ?? "{}").stroke).toBe(
      "#9CA3AF",
    );
  });

  it("starts the arc at 12 o'clock and sweeps counter-clockwise with rounded caps", () => {
    render(
      <ProgressRing progress={0.5} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    const progress = circleProps(1);
    expect(progress.stroke).toBe("#F8F8F8");
    expect(progress.strokeLinecap).toBe("round");
    expect(progress.transform).toBe("translate(32 0) scale(-1 1) rotate(-90 16 16)");
  });

  it("hides the arc entirely at progress 0", () => {
    render(
      <ProgressRing progress={0} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    expect(circleProps(1).strokeDashoffset).toBeCloseTo(CIRC, 5);
  });

  it("draws 75% of the ring at progress 0.75", () => {
    render(
      <ProgressRing progress={0.75} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    expect(circleProps(1).strokeDashoffset).toBeCloseTo(CIRC * 0.25, 5);
  });

  it("closes the ring at progress 1", () => {
    render(
      <ProgressRing progress={1} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    expect(circleProps(1).strokeDashoffset).toBeCloseTo(0, 5);
  });

  it("clamps progress above 1 to a full ring", () => {
    render(
      <ProgressRing progress={2} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    expect(circleProps(1).strokeDashoffset).toBeCloseTo(0, 5);
  });

  it("clamps progress below 0 to no arc", () => {
    render(
      <ProgressRing progress={-1} color="#F8F8F8" trackColor="#9CA3AF" />,
    );
    expect(circleProps(1).strokeDashoffset).toBeCloseTo(CIRC, 5);
  });

  it("honors custom size and strokeWidth", () => {
    render(
      <ProgressRing
        progress={0.5}
        size={40}
        strokeWidth={4}
        color="#F8F8F8"
        trackColor="#9CA3AF"
      />,
    );
    const svg = screen.getByTestId("svg");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
    expect(svg.getAttribute("viewBox")).toBe("0 0 40 40");
    expect(circleProps(0).r).toBe(18);
  });
});
