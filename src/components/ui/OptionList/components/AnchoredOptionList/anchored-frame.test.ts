import { describe, expect, it } from "vitest";
import { anchoredFrame } from "./anchored-frame";

describe("anchored option list placement", () => {
  it("matches the input width below the anchor in host-local coordinates", () => {
    expect(anchoredFrame({
      anchor: { x: 50, y: 150, width: 240, height: 40 },
      viewport: { x: 10, y: 30, width: 400, height: 700 },
      contentHeight: 100,
      maxHeight: 160,
    })).toEqual({ left: 40, top: 164, width: 240, maxHeight: 160 });
  });

  it("moves above the input when the keyboard leaves too little space below", () => {
    expect(anchoredFrame({
      anchor: { x: 20, y: 400, width: 300, height: 40 },
      viewport: { x: 0, y: 24, width: 400, height: 700 },
      keyboardTop: 480,
      contentHeight: 160,
      maxHeight: 160,
    })).toEqual({ left: 20, top: 212, width: 300, maxHeight: 160 });
  });

  it("bounds the list to the available viewport and clamps oversized anchors", () => {
    const frame = anchoredFrame({
      anchor: { x: -20, y: 80, width: 500, height: 40 },
      viewport: { x: 0, y: 0, width: 300, height: 180 },
      contentHeight: 160,
      maxHeight: 160,
    });
    expect(frame).toEqual({ left: 16, top: 16, width: 268, maxHeight: 60 });
  });
});
