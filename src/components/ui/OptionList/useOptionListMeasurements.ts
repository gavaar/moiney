import { useEffect, useState, type RefObject } from "react";
import { Keyboard, Platform, useWindowDimensions, type ViewInstance } from "react-native";
import { useOptionListHost } from "./optionListHost.context";
import type { WindowRect } from "./components/AnchoredOptionList/anchored-frame";

/** Tracks placement in the host's window, independently of the list's own scrolling. */
export function useOptionListMeasurements(anchorRef: RefObject<ViewInstance | null>, visible = true, layoutKey?: unknown) {
  const host = useOptionListHost();
  const { width, height } = useWindowDimensions();
  const [anchor, setAnchor] = useState<WindowRect>();
  const [viewport, setViewport] = useState<WindowRect>();
  const [bounds, setBounds] = useState<WindowRect>();
  const [browserViewport, setBrowserViewport] = useState<WindowRect>();
  const [keyboardTop, setKeyboardTop] = useState(() => Keyboard.metrics?.()?.screenY);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    const record = (setter: typeof setAnchor) => (x: number, y: number, width: number, height: number) => {
      if (live && width && height) setter(previous => sameRect(previous, { x, y, width, height }) ? previous : { x, y, width, height });
    };
    const measure = () => {
      anchorRef.current?.measureInWindow(record(setAnchor));
      host?.viewportRef.current?.measureInWindow(record(setViewport));
      host?.boundsRef?.current?.measureInWindow(record(setBounds));
      const visual = Platform.OS === "web" ? window.visualViewport : undefined;
      if (visual) record(setBrowserViewport)(visual.offsetLeft, visual.offsetTop, visual.width, visual.height);
    };
    measure();
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", event => {
      setKeyboardTop(event.endCoordinates.screenY);
      measure();
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardTop(undefined);
      measure();
    });

    let stopTracking: () => void;
    if (Platform.OS === "web") {
      // Scroll doesn't bubble, and a mobile keyboard may resize only visualViewport.
      document.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
      const visual = window.visualViewport;
      visual?.addEventListener("resize", measure);
      visual?.addEventListener("scroll", measure);
      const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
      // Ancestor reflow can move the anchor without changing the anchor's own size.
      let node: unknown = anchorRef.current;
      while (node instanceof Element) {
        observer?.observe(node);
        node = node.parentElement;
      }
      for (const ref of [host?.viewportRef, host?.boundsRef]) {
        if (ref?.current instanceof Element) observer?.observe(ref.current);
      }
      stopTracking = () => {
        document.removeEventListener("scroll", measure, true);
        window.removeEventListener("resize", measure);
        visual?.removeEventListener("resize", measure);
        visual?.removeEventListener("scroll", measure);
        observer?.disconnect();
      };
    } else {
      // Native ancestor scrolling/reflow doesn't bubble to this detached layer.
      // Measure only while open; equality checks keep stationary frames out of React.
      let frame: number;
      const track = () => { measure(); frame = requestAnimationFrame(track); };
      frame = requestAnimationFrame(track);
      stopTracking = () => cancelAnimationFrame(frame);
    }
    return () => { live = false; show.remove(); hide.remove(); stopTracking(); };
  }, [visible, anchorRef, host, width, height, layoutKey]);

  const viewportRect = viewport ?? { x: 0, y: 0, width, height };
  const availableBounds = bounds ?? viewportRect;
  return {
    anchor,
    viewport: viewportRect,
    measured: Boolean(anchor && viewport && (!host?.boundsRef || bounds)),
    keyboardTop,
    bounds: browserViewport ? intersection(availableBounds, browserViewport) : availableBounds,
  };
}

function sameRect(a: WindowRect | undefined, b: WindowRect) {
  return a?.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function intersection(a: WindowRect, b: WindowRect): WindowRect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}
