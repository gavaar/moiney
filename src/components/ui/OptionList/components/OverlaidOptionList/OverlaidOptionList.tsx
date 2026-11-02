import { useState, type ReactNode, type RefObject } from "react";
import { View, type ViewInstance } from "react-native";
import { PointerBackdrop } from "@ui/PointerBackdrop/PointerBackdrop";
import { useOptionListMeasurements } from "../../useOptionListMeasurements";
import { OptionListLayer } from "../OptionListLayer/OptionListLayer";
import { overlayFrame } from "./overlay-frame";
import { useOverlayFocus } from "./useOverlayFocus";

type Props = {
  anchorRef: RefObject<ViewInstance | null>;
  onOutsidePress: () => void;
  onRequestClose: () => boolean;
  children: ReactNode;
};

/** Replaces the anchor visually, without moving any of the form beneath it. */
export function OverlaidOptionList({ anchorRef, onOutsidePress, onRequestClose, children }: Props) {
  const placement = useOptionListMeasurements(anchorRef);
  const [contentSize, setContentSize] = useState<{ width: number; height: number }>();

  const frame = overlayFrame({ ...placement, anchor: placement.anchor ?? placement.viewport, contentHeight: contentSize?.height });
  // Lay out invisibly until both placement and content at the final width are known.
  const ready = Boolean(placement.measured && contentSize?.height && Math.abs(contentSize.width - frame.width) < 1);
  const surfaceRef = useOverlayFocus(ready, anchorRef, onRequestClose);
  return <OptionListLayer onRequestClose={onRequestClose}><View pointerEvents="box-none" style={{ position: "absolute", inset: 0, zIndex: 1000 }}>
    <PointerBackdrop testID="collapsible-select-outside" onPress={onOutsidePress}
      style={{ position: "absolute", inset: 0 }} />
    <View ref={surfaceRef} tabIndex={-1} testID="collapsible-select-overlay" className="bg-surface border border-border rounded-xl p-2 gap-2"
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
