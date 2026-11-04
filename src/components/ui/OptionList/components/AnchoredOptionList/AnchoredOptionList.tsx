import { useRef, useState, type RefObject } from "react";
import { Platform, View, type ViewInstance } from "react-native";
import { PointerBackdrop } from "@ui/PointerBackdrop/PointerBackdrop";
import { focusMovingInto } from "@ui/keyboard/focus";
import { keyboardKey, type ControlKeyEvent } from "@ui/keyboard/choiceKeyboard";
import { OptionList, type OptionListProps } from "../OptionList/OptionList";
import { OptionListLayer } from "../OptionListLayer/OptionListLayer";
import { useOptionListMeasurements } from "../../useOptionListMeasurements";
import { anchoredFrame, type WindowRect } from "./anchored-frame";

type Props<Item> = Omit<OptionListProps<Item>, "onContentSizeChange" | "onLayout"> & {
  visible: boolean;
  onClose: (reason: "outside" | "keyboard" | "blur") => void;
  anchorRef: RefObject<ViewInstance | null>;
  surfaceRef?: RefObject<ViewInstance | null>;
  maxHeight: number;
  className?: string;
};

/** Floats a virtualized list in the anchor's native window without taking input focus. */
export function AnchoredOptionList<Item>({ visible, onClose, anchorRef, surfaceRef: providedSurfaceRef, maxHeight, className, ...listProps }: Props<Item>) {
  const ownSurfaceRef = useRef<ViewInstance>(null);
  const surfaceRef = providedSurfaceRef ?? ownSurfaceRef;
  const placement = useOptionListMeasurements(anchorRef, visible, listProps.data);
  const anchor: WindowRect = placement.anchor ?? { x: 0, y: 0, width: 0, height: 0 };
  const [contentHeight, setContentHeight] = useState(0);
  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const viewport = placement.viewport;
  // Measure padding and borders rather than coupling placement to surface classes.
  const surfaceInsets = Math.max(0, surfaceHeight - listHeight);
  const frame = anchoredFrame({ anchor, viewport, bounds: placement.bounds, keyboardTop: placement.keyboardTop, contentHeight: contentHeight + surfaceInsets, maxHeight });
  const anchorTop = Math.min(viewport.height, Math.max(0, anchor.y - viewport.y));
  const anchorBottom = Math.min(viewport.height, Math.max(0, anchor.y + anchor.height - viewport.y));
  const anchorLeft = Math.min(viewport.width, Math.max(0, anchor.x - viewport.x));
  const anchorRight = Math.min(viewport.width, Math.max(0, anchor.x + anchor.width - viewport.x));

  if (!visible) return null;

  return <OptionListLayer onRequestClose={() => { onClose("keyboard"); return true; }}>
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0, zIndex: 1000 }}>
      {/* Leave the anchor interactive so tapping the text field does not dismiss it. */}
      <PointerBackdrop testID="option-list-backdrop" style={{ position: "absolute", top: 0, left: 0, right: 0, height: anchorTop }} onPress={() => onClose("outside")} />
      <PointerBackdrop style={{ position: "absolute", top: anchorBottom, left: 0, right: 0, bottom: 0 }} onPress={() => onClose("outside")} />
      <PointerBackdrop style={{ position: "absolute", top: anchorTop, left: 0, width: anchorLeft, height: anchorBottom - anchorTop }} onPress={() => onClose("outside")} />
      <PointerBackdrop style={{ position: "absolute", top: anchorTop, left: anchorRight, right: 0, height: anchorBottom - anchorTop }} onPress={() => onClose("outside")} />
      <View
        ref={surfaceRef}
        testID="anchored-option-list"
        className={className}
        onLayout={event => setSurfaceHeight(event.nativeEvent.layout.height)}
        onPointerDown={Platform.OS === "web" ? event => event.preventDefault() : undefined}
        {...(Platform.OS === "web" ? {
          onBlur: (event: unknown) => {
            if (!focusMovingInto(surfaceRef.current, event) && !focusMovingInto(anchorRef.current, event)) onClose("blur");
          },
          onKeyUp: (event: ControlKeyEvent) => {
            if (keyboardKey(event) !== "Escape") return;
            event.stopPropagation();
            onClose("keyboard");
          },
        } : {})}
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
