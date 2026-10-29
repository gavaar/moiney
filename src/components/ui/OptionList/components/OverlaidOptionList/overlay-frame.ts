import type { WindowRect } from "../AnchoredOptionList/anchored-frame";

export function overlayFrame({ anchor, viewport, bounds, keyboardTop, contentHeight }: {
  anchor: WindowRect; viewport: WindowRect; bounds: WindowRect; keyboardTop?: number; contentHeight?: number;
}) {
  const topEdge = Math.max(viewport.y, bounds.y) + 16;
  const bottom = Math.min(viewport.y + viewport.height - 16, bounds.y + bounds.height - 16,
    keyboardTop === undefined ? Infinity : keyboardTop - 24);
  const maxHeight = Math.max(0, bottom - topEdge);
  const desiredHeight = Math.min(contentHeight || maxHeight, maxHeight);
  const width = Math.min(anchor.width, Math.max(0, bounds.width - 32), Math.max(0, viewport.width - 32));
  return {
    left: Math.max(16, Math.min(anchor.x - viewport.x, viewport.width - width - 16)),
    top: Math.max(0, Math.max(topEdge, Math.min(anchor.y, bottom - desiredHeight)) - viewport.y),
    width,
    maxHeight,
  };
}
