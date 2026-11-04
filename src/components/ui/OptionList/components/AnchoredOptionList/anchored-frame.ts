export type WindowRect = { x: number; y: number; width: number; height: number };

const PADDING = 16;
const GAP = 4;

/** Places a bounded list above or below its anchor without covering the keyboard. */
export function anchoredFrame({ anchor, viewport, bounds = viewport, keyboardTop, contentHeight, maxHeight }: {
  anchor: WindowRect;
  viewport: WindowRect;
  bounds?: WindowRect;
  keyboardTop?: number;
  contentHeight: number;
  maxHeight: number;
}) {
  const topEdge = Math.max(viewport.y, bounds.y) + PADDING;
  const bottomEdge = Math.max(topEdge, Math.min(viewport.y + viewport.height, bounds.y + bounds.height, keyboardTop ?? Infinity) - PADDING);
  const belowTop = Math.max(topEdge, anchor.y + anchor.height + GAP);
  const below = Math.max(0, bottomEdge - belowTop);
  const above = Math.max(0, Math.min(anchor.y - GAP, bottomEdge) - topEdge);
  const desiredHeight = Math.min(maxHeight, contentHeight || maxHeight);
  const placeBelow = below >= desiredHeight || below >= above;
  const height = Math.min(maxHeight, placeBelow ? below : above);
  const leftEdge = Math.max(viewport.x, bounds.x) + PADDING;
  const rightEdge = Math.min(viewport.x + viewport.width, bounds.x + bounds.width) - PADDING;
  const width = Math.min(anchor.width, Math.max(0, rightEdge - leftEdge));
  return {
    left: Math.max(leftEdge, Math.min(anchor.x, rightEdge - width)) - viewport.x,
    top: Math.max(topEdge, (placeBelow ? belowTop
      : Math.min(anchor.y - GAP, bottomEdge) - Math.min(desiredHeight, height))) - viewport.y,
    width,
    maxHeight: height,
  };
}
