import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { cn } from "@/lib/styles";
import { Icon } from "@/components/ui/Icon";
import { ModalShell } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getBorderStyle } from "../../input.config";

type Props = {
  label: string;
  error?: string;
  disabled?: boolean;
  value: Date;
  onChange: (date: Date) => void;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${month} ${day}, ${year} ${h12}:${mm} ${ampm}`;
}

export function DatetimeInput({ label, error, disabled, value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const borderStyle = getBorderStyle(disabled, focused, error);

  const handleTrigger = () => {
    if (disabled) return;
    setFocused(true);
    setShowPicker(true);
  };

  const isIOS = Platform.OS === "ios";

  const handleChange = (_: any, selectedDate?: Date) => {
    if (!isIOS) {
      setShowPicker(false);
      setFocused(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const handleDone = () => {
    setShowPicker(false);
    setFocused(false);
  };

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <Pressable
        testID="datetime-trigger"
        onPress={handleTrigger}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2.5 flex-row items-center justify-between",
          disabled && "opacity-50",
          borderStyle,
        )}
      >
        <Text
          className={cn(
            "text-base",
            disabled ? "text-muted" : "text-text",
          )}
        >
          {formatDate(value)}
        </Text>
        <Icon name="calendar-outline" size={20} color={disabled ? "#9CA3AF" : "#F8F8F8"} />
      </Pressable>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}

      {showPicker ? (
        isIOS ? (
          <ModalShell visible={showPicker} onClose={handleDone}>
            <View className="gap-4">
              <DateTimePicker
                value={value}
                mode="datetime"
                display="spinner"
                onChange={handleChange}
              />
              <Button title="Done" onPress={handleDone} />
            </View>
          </ModalShell>
        ) : (
          <DateTimePicker
            value={value}
            mode="datetime"
            display="default"
            onChange={handleChange}
          />
        )
      ) : null}
    </View>
  );
}
