import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Keyboard, Platform, Pressable, useWindowDimensions, View, type ViewInstance } from "react-native";
import { useOptionListHost } from "../../optionListHost.context";
import { OptionListLayer } from "../OptionListLayer/OptionListLayer";
import type { WindowRect } from "../AnchoredOptionList/anchored-frame";
import { overlayFrame } from "./overlay-frame";

type Props = {
  anchorRef: RefObject<ViewInstance | null>;
  onOutsidePress: () => void;
  onRequestClose: () => boolean;
  children: ReactNode;
};

/** Replaces the anchor visually, without moving any of the form beneath it. */
export function OverlaidOptionList({ anchorRef, onOutsidePress, onRequestClose, children }: Props) {
  const host = useOptionListHost();
  const { width, height } = useWindowDimensions();
  const [anchor, setAnchor] = useState<WindowRect>();
  const [viewport, setViewport] = useState<WindowRect>();
  const [keyboardTop, setKeyboardTop] = useState<number>();
  const [bounds, setBounds] = useState<WindowRect>();
  const [contentSize, setContentSize] = useState<{ width: number; height: number }>();

  // Auto-open can mount before ancestor host refs attach in layout effects.
  useEffect(() => {
    let live = true;
    const measure = () => {
      anchorRef.current?.measureInWindow((x, y, w, h) => {
        if (live && w) setAnchor({ x, y, width: w, height: h });
      });
      host?.viewportRef.current?.measureInWindow((x, y, w, h) => {
        if (live && w && h) setViewport({ x, y, width: w, height: h });
      });
      host?.boundsRef?.current?.measureInWindow((x, y, w, h) => {
        if (live && w && h) setBounds({ x, y, width: w, height: h });
      });
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
    return () => { live = false; show.remove(); hide.remove(); };
  }, [anchorRef, host, width, height]);

  const viewportRect = viewport ?? { x: 0, y: 0, width, height };
  const frame = overlayFrame({ anchor: anchor ?? viewportRect, viewport: viewportRect, bounds: bounds ?? viewportRect, keyboardTop, contentHeight: contentSize?.height });
  // Lay out invisibly until both placement and content at the final width are known.
  const ready = Boolean(anchor && viewport && (!host?.boundsRef || bounds) && contentSize?.height && Math.abs(contentSize.width - frame.width) < 1);
  return <OptionListLayer onRequestClose={onRequestClose}><View pointerEvents="box-none" style={{ position: "absolute", inset: 0, zIndex: 1000 }}>
    <Pressable testID="collapsible-select-outside" onPress={onOutsidePress}
      style={{ position: "absolute", inset: 0 }} />
    <View testID="collapsible-select-overlay" className="bg-surface border border-border rounded-xl p-2 gap-2"
      pointerEvents={ready ? "auto" : "none"}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setContentSize({ width, height });
      }}
      style={{ position: "absolute", ...frame, opacity: ready ? 1 : 0 }}>
      {children}
    </View>
  </View></OptionListLayer>;
}
