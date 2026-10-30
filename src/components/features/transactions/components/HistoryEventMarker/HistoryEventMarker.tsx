import { useRef, useState } from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";
import { Icon, type IconName } from "@ui/Icon";
import { Popover } from "@ui/Popover";

const markers = {
  pipe_creation: { icon: "pipe-creation", label: "Created pipe" },
  pipe_deletion: { icon: "pipe-deletion", label: "Deleted pipe" },
  settlement: { icon: "settlement", label: "Pipe settled" },
  settlement_coverage: { icon: "shield", label: "Coverage provided" },
} satisfies Record<string, { icon: IconName; label: string }>;

type Props = { eventType: keyof typeof markers; color: string; size?: number };

export function HistoryEventMarker({ eventType, color, size = 20 }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<ViewInstance>(null);
  const marker = markers[eventType];

  return <>
    <Pressable ref={anchorRef} testID="history-event-marker"
      accessibilityRole="button"
      accessibilityLabel={`Event type: ${marker.label}`}
      accessibilityHint="Shows the event type"
      accessibilityState={{ expanded: open }}
      aria-expanded={open}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 0 }}
      className="self-center items-center justify-center shrink-0"
      onPress={() => setOpen(true)}>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <Icon name={marker.icon} size={size} color={color} />
      </View>
    </Pressable>
    {open
      ? <Popover visible onClose={() => setOpen(false)} anchorRef={anchorRef}>
        <Text className="text-text text-sm">{marker.label}</Text>
      </Popover>
      : null}
  </>;
}
