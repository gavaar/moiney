export type WindowRect = { x: number; y: number; width: number; height: number };

const PADDING = 16;
const GAP = 4;

/** Places a bounded list above or below its anchor without covering the keyboard. */
export function anchoredFrame({ anchor, viewport, keyboardTop, contentHeight, maxHeight }: {
  anchor: WindowRect;
  viewport: WindowRect;
  keyboardTop?: number;
  contentHeight: number;
  maxHeight: number;
}) {
  const topEdge = viewport.y + PADDING;
  const bottomEdge = Math.min(viewport.y + viewport.height, keyboardTop ?? Infinity) - PADDING;
  const below = Math.max(0, bottomEdge - anchor.y - anchor.height - GAP);
  const above = Math.max(0, Math.min(anchor.y - GAP, bottomEdge) - topEdge);
  const desiredHeight = Math.min(maxHeight, contentHeight || maxHeight);
  const placeBelow = below >= desiredHeight || below >= above;
  const height = Math.min(maxHeight, placeBelow ? below : above);
  const width = Math.min(anchor.width, Math.max(0, viewport.width - PADDING * 2));
  return {
    left: Math.max(PADDING, Math.min(anchor.x - viewport.x, viewport.width - width - PADDING)),
    top: Math.max(PADDING, (placeBelow ? anchor.y + anchor.height + GAP
      : Math.min(anchor.y - GAP, bottomEdge) - Math.min(desiredHeight, height)) - viewport.y),
    width,
    maxHeight: height,
  };
}
