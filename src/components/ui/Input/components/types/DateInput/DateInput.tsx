import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { cn } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { getBorderStyle } from "../../../input.config";
import { MONTH_LABELS } from "./calendar";
import { Calendar } from "./components";
import { InputError, useInputValidation } from "../../InputError";
import { InputWrapper, type InputActions } from "../../InputWrapper";
import { InputLabel } from "../../InputLabel";

type Props = InputActions & {
  label?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  value: Date | null;
  placeholder?: string;
  onChange?: (date: Date) => void;
  onError?: (error?: string) => void;
  validator?: (value: Date | null) => string | undefined;
};

function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function currentUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

export function DateInput({
  label,
  accessibilityLabel,
  validator,
  disabled,
  value,
  placeholder,
  onChange,
  onError,
  prefix,
  suffix,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const { error, markAsDirty } = useInputValidation(value, validator, onError);

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
      <InputLabel label={label} />
      <InputWrapper
        testID="date-trigger"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        onPress={handleTrigger}
        disabled={disabled}
        prefix={prefix}
        suffix={suffix}
        borderStyle={borderStyle}
        contentClassName="flex-row items-center justify-between"
        className={cn(disabled && "opacity-50")}
      >
        <Text className={cn("text-base", disabled ? "text-muted" : "text-text")}>
          {value ? formatDate(value) : placeholder ?? "Any date"}
        </Text>
        <Icon name="calendar-outline" size={16} color={disabled ? "#9CA3AF" : "#F8F8F8"} />
      </InputWrapper>
      <InputError error={error} />

      {showPicker && onChange ? (
        <Calendar visible value={value ?? currentUtcDate()} onChange={date => {
          if (disabled) return;
          markAsDirty();
          onChange(date);
        }} onClose={handleClose} />
      ) : null}
    </View>
  );
}
