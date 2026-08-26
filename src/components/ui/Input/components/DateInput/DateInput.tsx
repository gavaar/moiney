import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { getBorderStyle } from "../../input.config";
import { MONTH_LABELS } from "./calendar";
import { Calendar } from "./components";

type Props = {
  label: string;
  error?: string;
  disabled?: boolean;
  value: Date;
  onChange: (date: Date) => void;
};

function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function DateInput({ label, error, disabled, value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const borderStyle = getBorderStyle(disabled, focused, error);

  const handleTrigger = useCallback(() => {
    if (disabled) return;
    setFocused(true);
    setShowPicker(true);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setShowPicker(false);
    setFocused(false);
  }, []);

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <Pressable
        testID="date-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onPress={handleTrigger}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2.5 flex-row items-center justify-between",
          disabled && "opacity-50",
          borderStyle,
        )}
      >
        <Text className={cn("text-base", disabled ? "text-muted" : "text-text")}>
          {formatDate(value)}
        </Text>
        <Icon name="calendar-outline" size={16} color={disabled ? "#9CA3AF" : "#F8F8F8"} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
          {error}
        </Text>
      ) : null}

      {showPicker ? (
        <Calendar visible value={value} onChange={onChange} onClose={handleClose} />
      ) : null}
    </View>
  );
}
