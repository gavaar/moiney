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

function normalizeToMidday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

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

  const handleValueChange = (selectedDate: Date) => {
    if (isIOS) {
      onChange(selectedDate);
      return;
    }

    if (step === "date") {
      const normalized = normalizeToMidday(selectedDate);
      setPendingDate(normalized);
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
                onValueChange={handleValueChange}
                onDismiss={handleDismiss}
              />
              <Button title="Done" onPress={handleDone} />
            </View>
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
