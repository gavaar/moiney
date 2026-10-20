import { useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, Platform, useWindowDimensions, type KeyboardEvent, type LayoutChangeEvent, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EDGE_GAP = 24;
const VIEWPORT_TOP_MARGIN = 0.1;
const VIEWPORT_BOTTOM_MARGIN = 0.2;

/** Bounds growth between 10% and 80% of the viewport, shrinking for keyboard overlap. */
export function useModalFrame() {
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewportRef = useRef<View>(null);
  const [viewport, setViewport] = useState<{ top: number; height: number; windowWidth: number }>();
  const [keyboardTop, setKeyboardTop] = useState(() => Keyboard.metrics?.()?.screenY);

  useEffect(() => {
    const update = (event: KeyboardEvent) => setKeyboardTop(event.endCoordinates.screenY);
    const hide = () => setKeyboardTop(undefined);
    const frame = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", update);
    const hidden = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", hide);
    return () => {
      frame.remove();
      hidden.remove();
    };
  }, []);

  function onViewportLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    // Keyboard frames use screen coordinates; a native modal can start below the status bar.
    viewportRef.current?.measureInWindow((_x, top) => {
      setViewport(previous => previous?.top === top && previous.height === height && previous.windowWidth === windowSize.width
        ? previous : { top, height, windowWidth: windowSize.width });
    });
  }

  // A browser's screen is the monitor, not its viewport. The layout viewport stays
  // stable when the visual viewport shrinks for an on-screen keyboard.
  const referenceHeight = Platform.OS === "web" && typeof document !== "undefined"
    ? document.documentElement.clientHeight || window.innerHeight
    : Dimensions.get("screen").height;
  const measured = viewport?.windowWidth === windowSize.width ? viewport : undefined;
  const viewportTop = measured?.top ?? 0;
  const viewportHeight = Math.min(windowSize.height || referenceHeight, measured?.height ?? Infinity);
  const top = Math.max(insets.top + EDGE_GAP, referenceHeight * VIEWPORT_TOP_MARGIN - viewportTop);
  const bottom = Math.min(
    referenceHeight * (1 - VIEWPORT_BOTTOM_MARGIN) - viewportTop,
    viewportHeight - insets.bottom - EDGE_GAP,
    keyboardTop === undefined ? Infinity : keyboardTop - viewportTop - EDGE_GAP,
  );

  return {
    viewportRef,
    onViewportLayout,
    top,
    height: Math.max(0, bottom - top),
    left: insets.left,
    right: insets.right,
  };
}
