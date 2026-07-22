import { useEffect, useMemo, useState } from "react";
import { Dimensions, type GestureResponderEvent, Modal as RNModal, Pressable, View } from "react-native";

type AnchorPosition =
  | "bottom-start" | "bottom-end" | "bottom"
  | "left-start" | "left-end"
  | "right-start" | "right-end";

type PopoverProps = {
  visible: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<View>;
  children: React.ReactNode;
  anchorPosition?: AnchorPosition;
};

const GAP = 4;
const VIEWPORT_PADDING = 8;

function calcTop(
  position: AnchorPosition,
  y: number,
  height: number,
  contentHeight: number,
  windowHeight: number,
): number {
  const raw = position.startsWith("left") || position.startsWith("right")
    ? position.endsWith("end") ? y + height - contentHeight : y
    : position.startsWith("bottom") ? y + height + GAP
    : y - contentHeight - GAP;

  return Math.max(VIEWPORT_PADDING, Math.min(raw, windowHeight - contentHeight - VIEWPORT_PADDING));
}

function calcLeft(
  position: AnchorPosition,
  x: number,
  width: number,
  contentWidth: number,
  windowWidth: number,
): number {
  const raw = position.startsWith("left") ? x - contentWidth - GAP
    : position.startsWith("right") ? x + width + GAP
    : position === "bottom-end" ? x + width - contentWidth
    : position === "bottom" ? x + width / 2 - contentWidth / 2
    : x;

  return Math.max(VIEWPORT_PADDING, Math.min(raw, windowWidth - contentWidth - VIEWPORT_PADDING));
}

export function Popover({
  visible,
  onClose,
  anchorRef,
  children,
  anchorPosition = "bottom-start",
}: PopoverProps) {
  const [triggerRect, setTriggerRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    anchorRef.current.measureInWindow((x, y, width, height) => {
      setTriggerRect({ x, y, width, height });
    });
  }, [visible, anchorRef]);

  const top = useMemo(
    () => calcTop(anchorPosition, triggerRect.y, triggerRect.height, contentSize.height, windowHeight),
    [anchorPosition, triggerRect.y, triggerRect.height, contentSize.height, windowHeight],
  );

  const left = useMemo(
    () => calcLeft(anchorPosition, triggerRect.x, triggerRect.width, contentSize.width, windowWidth),
    [anchorPosition, triggerRect.x, triggerRect.width, contentSize.width, windowWidth],
  );

  return (
    <RNModal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <Pressable className="flex-1" onPress={onClose}>
        <View
          className="bg-surface border border-border rounded-xl p-2"
          style={{ position: "absolute", top, left }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContentSize({ width, height });
          }}
        >
          <Pressable onPress={(e: GestureResponderEvent) => e.stopPropagation()}>
            {children}
          </Pressable>
        </View>
      </Pressable>
    </RNModal>
  );
}
