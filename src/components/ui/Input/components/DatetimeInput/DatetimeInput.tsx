import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { cn } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { getBorderStyle } from "../../input.config";

export type DatetimeMode = "date" | "datetime";

type Props = {
  label: string;
  error?: string;
  disabled?: boolean;
  value: Date;
  onChange: (date: Date) => void;
  mode?: DatetimeMode;
};

function toUtcMidday(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

function toLocalMidday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date: Date, mode: DatetimeMode): string {
  const utc = mode === "date";
  const month = MONTHS[utc ? date.getUTCMonth() : date.getMonth()];
  const day = utc ? date.getUTCDate() : date.getDate();
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function DatetimeInput({ label, error, disabled, value, onChange, mode = "datetime" }: Props) {
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [step, setStep] = useState<"date" | "time">("date");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const borderStyle = getBorderStyle(disabled, focused, error);

  const isIOS = Platform.OS === "ios";

  const handleTrigger = () => {
    if (disabled) return;
    setFocused(true);
    setShowPicker(true);
    setStep("date");
    setPendingDate(null);
  };

  const close = () => {
    setShowPicker(false);
    setFocused(false);
  };

  const handleDismiss = () => {
    close();
  };

  const handleValueChange = (_: unknown, selectedDate: Date) => {
    if (isIOS) {
      const next = mode === "date" ? toUtcMidday(selectedDate) : selectedDate;
      onChange(next);
      if (mode === "date") close();
      return;
    }

    if (step === "date") {
      if (mode === "date") {
        onChange(toUtcMidday(selectedDate));
        close();
        return;
      }
      setPendingDate(toLocalMidday(selectedDate));
      setStep("time");
      return;
    }

    if (step === "time" && pendingDate) {
      const combined = new Date(pendingDate);
      combined.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      onChange(combined);
      close();
    }
  };

  const handleDone = () => {
    close();
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
          {formatDate(value, mode)}
        </Text>
        <Icon name="calendar-outline" size={16} color={disabled ? "#9CA3AF" : "#F8F8F8"} />
      </Pressable>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}

      {showPicker ? (
        isIOS ? (
          <ModalShell visible={showPicker} onClose={handleDone}>
            <DateTimePicker
              value={value}
              mode={mode}
              display="spinner"
              onValueChange={handleValueChange}
              onDismiss={handleDismiss}
            />
          </ModalShell>
        ) : (
          <>
            {step === "date" && (
              <DateTimePicker
                value={value}
                mode="date"
                display="default"
                onValueChange={handleValueChange}
                onDismiss={handleDismiss}
              />
            )}
            {step === "time" && pendingDate && (
              <DateTimePicker
                value={pendingDate}
                mode="time"
                display="default"
                onValueChange={handleValueChange}
                onDismiss={handleDismiss}
              />
            )}
          </>
        )
      ) : null}
    </View>
  );
}
