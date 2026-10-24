import { useEffect, useState, type RefObject } from "react";
import { Keyboard, type KeyboardEvent, Platform, Pressable, useWindowDimensions, View } from "react-native";
import { OptionList, type OptionListProps } from "../OptionList/OptionList";
import { OptionListLayer } from "./components";
import { useOptionListHost } from "../components/OptionListHost/optionListHost.context";
import { anchoredFrame, type WindowRect } from "./utils";

type Props<Item> = Omit<OptionListProps<Item>, "onContentSizeChange" | "onLayout"> & {
  visible: boolean;
  onClose: () => void;
  anchorRef: RefObject<View | null>;
  maxHeight: number;
  className?: string;
};

/** Floats a virtualized list in the anchor's native window without taking input focus. */
export function AnchoredOptionList<Item>({ visible, onClose, anchorRef, maxHeight, className, ...listProps }: Props<Item>) {
  const [anchor, setAnchor] = useState<WindowRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [viewport, setViewport] = useState<WindowRect>();
  const [contentHeight, setContentHeight] = useState(0);
  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState(() => Keyboard.metrics?.()?.screenY);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const host = useOptionListHost();

  useEffect(() => {
    if (!visible) return;
    const update = (event: KeyboardEvent) => setKeyboardTop(event.endCoordinates.screenY);
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", update);
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardTop(undefined));
    return () => { show.remove(); hide.remove(); };
  }, [visible]);

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    let active = true;
    anchorRef.current.measureInWindow((x, y, width, height) => {
      if (active) setAnchor(previous => sameRect(previous, { x, y, width, height }) ? previous : { x, y, width, height });
    });
    host?.viewportRef.current?.measureInWindow((x, y, width, height) => {
      if (!active) return;
      const next = { x, y, width: width || windowWidth, height: height || windowHeight };
      setViewport(previous => previous && sameRect(previous, next) ? previous : next);
    });
    return () => { active = false; };
  }, [visible, anchorRef, host, windowWidth, windowHeight, keyboardTop, listProps.data]);

  const bounds = viewport ?? { x: 0, y: 0, width: windowWidth, height: windowHeight };
  // Measure padding and borders rather than coupling placement to surface classes.
  const surfaceInsets = Math.max(0, surfaceHeight - listHeight);
  const frame = anchoredFrame({ anchor, viewport: bounds, keyboardTop, contentHeight: contentHeight + surfaceInsets, maxHeight });
  const anchorTop = Math.max(0, anchor.y - bounds.y);
  const anchorBottom = anchorTop + anchor.height;
  const anchorLeft = Math.max(0, anchor.x - bounds.x);
  const anchorRight = anchorLeft + anchor.width;

  if (!visible) return null;

  return <OptionListLayer>
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0, zIndex: 1000 }}>
      {/* Leave the anchor interactive so tapping the text field does not dismiss it. */}
      <Pressable testID="option-list-backdrop" style={{ position: "absolute", top: 0, left: 0, right: 0, height: anchorTop }} onPress={onClose} />
      <Pressable style={{ position: "absolute", top: anchorBottom, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
      <Pressable style={{ position: "absolute", top: anchorTop, left: 0, width: anchorLeft, height: anchor.height }} onPress={onClose} />
      <Pressable style={{ position: "absolute", top: anchorTop, left: anchorRight, right: 0, height: anchor.height }} onPress={onClose} />
      <View
        testID="anchored-option-list"
        className={className}
        onLayout={event => setSurfaceHeight(event.nativeEvent.layout.height)}
        onPointerDown={Platform.OS === "web" ? event => event.preventDefault() : undefined}
        style={{ position: "absolute", ...frame }}
      >
        <OptionList
          {...listProps}
          onLayout={event => setListHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
        />
      </View>
    </View>
  </OptionListLayer>;
}

function sameRect(a: WindowRect, b: WindowRect) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
