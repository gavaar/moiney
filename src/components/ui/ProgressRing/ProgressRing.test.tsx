// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressRing } from "./ProgressRing";

describe("ProgressRing quantitative output", () => {
  it.each([
    { progress: -1, fraction: 0 },
    { progress: 0, fraction: 0 },
    { progress: 0.75, fraction: 0.75 },
    { progress: 1, fraction: 1 },
    { progress: 2, fraction: 1 },
  ])("represents progress $progress as fraction $fraction", ({ progress, fraction }) => {
    render(<ProgressRing progress={progress} color="#000000" />);
    const arc = JSON.parse(screen.getByTestId("svg-circle").getAttribute("data-props") ?? "{}");
    expect(arc.strokeDasharray).toBeCloseTo(2 * Math.PI * arc.r, 5);
    expect(1 - arc.strokeDashoffset / arc.strokeDasharray).toBeCloseTo(fraction, 5);
  });
});
