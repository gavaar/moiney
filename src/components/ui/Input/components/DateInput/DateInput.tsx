import { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { MONTH_LABELS } from "./calendar";
import { Calendar } from "./components";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";

export type DateInputProps = InputValueProps<Date | null, Date> & {
  placeholder?: string;
};

type Props = DateInputProps & InputInteraction & InputTriggerProps;

function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function currentUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

export function DateInput({
  accessibilityLabel,
  disabled,
  value,
  placeholder,
  onChange,
  onFocusChange,
  onInteractionEnd,
  triggerClassName,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const handleTrigger = useCallback(() => {
    if (disabled) return;
    onFocusChange(true);
    setShowPicker(true);
  }, [disabled, onFocusChange]);

  const handleClose = useCallback(() => {
    setShowPicker(false);
    onFocusChange(false);
  }, [onFocusChange]);

  return (
    <>
      <Pressable
        testID="date-trigger"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, expanded: showPicker && !!onChange }}
        aria-expanded={showPicker && !!onChange}
        onPress={handleTrigger}
        disabled={disabled}
        className={cn(triggerClassName, "flex-row items-center justify-between")}
      >
        <Text className={cn("text-base", disabled ? "text-muted" : "text-text")}>
          {value ? formatDate(value) : placeholder ?? "Any date"}
        </Text>
        <Icon name="calendar-outline" size={12} color={disabled ? colors.muted : colors.text} />
      </Pressable>

      {showPicker && onChange ? (
        <Calendar visible value={value ?? currentUtcDate()} onChange={date => {
          if (disabled) return;
           onInteractionEnd();
          onChange(date);
        }} onClose={handleClose} />
      ) : null}
    </>
  );
}
