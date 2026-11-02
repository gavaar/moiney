import { describe, expect, it } from "vitest";
import { overlayFrame } from "./overlay-frame";

describe("overlaid option list placement", () => {
  const anchor = { x: 40, y: 500, width: 320, height: 70 };
  const viewport = { x: 0, y: 0, width: 400, height: 800 };
  const bounds = { x: 0, y: 80, width: 400, height: 560 };
  it("grows over the anchor within the modal's allowed region rather than below it", () => {
    expect(overlayFrame({ anchor, viewport, bounds })).toEqual({ left: 40, top: 96, width: 320, maxHeight: 528 });
  });
  it("hugs short content and stays above the keyboard", () => {
    expect(overlayFrame({ anchor, viewport, bounds, keyboardTop: 400, contentHeight: 200 }))
      .toEqual({ left: 40, top: 176, width: 320, maxHeight: 280 });
  });
  it("never produces negative geometry in a severely constrained viewport", () => {
    const frame = overlayFrame({ anchor, viewport, bounds, keyboardTop: 50 });
    expect(frame.maxHeight).toBe(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
  });
  it("clamps horizontal placement to inset host bounds, not just the viewport", () => {
    const frame = overlayFrame({
      anchor: { x: 10, y: 300, width: 320, height: 50 },
      viewport,
      bounds: { x: 100, y: 200, width: 200, height: 400 },
      contentHeight: 100,
    });
    expect(frame.left).toBeGreaterThanOrEqual(116);
    expect(frame.left + frame.width).toBeLessThanOrEqual(284);
  });
});
