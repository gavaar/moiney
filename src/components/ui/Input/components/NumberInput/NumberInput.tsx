import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";
import { getBorderStyle } from "../../input.config";
import { InputError, useInputValidation } from "../../useInputValidation";

type Props = {
  label: string;
  disabled?: boolean;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onError?: (error?: string) => void;
  validator?: (value: number) => string | undefined;
};

function stripNonDigits(input: string): string {
  return input.replace(/\D/g, "");
}

function parseDigits(input: string): number {
  const digits = stripNonDigits(input);
  if (digits === "") return 0;
  return parseInt(digits, 10);
}

export function NumberInput({
  label,
  validator,
  disabled,
  value,
  onChange,
  onError,
  min = 0,
  max = Infinity,
  step = 1,
}: Props) {
  const [focused, setFocused] = useState(false);
  const { error, markAsDirty } = useInputValidation(value, validator, onError);

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max],
  );

  const handleIncrement = () => {
    if (disabled || !onChange) return;
    const next = clamp(value + step);
    if (next !== value) {
      markAsDirty();
      onChange(next);
    }
  };

  const handleDecrement = () => {
    if (disabled || !onChange) return;
    const next = clamp(value - step);
    if (next !== value) {
      markAsDirty();
      onChange(next);
    }
  };

  const handleChangeText = (text: string) => {
    if (disabled) return;
    const next = parseDigits(text);
    onChange?.(next);
  };

  const handleBlur = () => {
    setFocused(false);
    if (disabled) return;
    const clamped = clamp(value);
    markAsDirty();
    if (clamped !== value) onChange?.(clamped);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  const borderStyle = getBorderStyle(disabled, focused, error);

  return (
    <View className={cn("gap-1", disabled && "opacity-60")}>
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="flex-row items-center gap-1">
        <Pressable
          testID="decrement-button"
          onPress={handleDecrement}
          disabled={disabled || atMin}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: disabled || atMin }}
          className={cn(
            "h-10 w-10 items-center justify-center rounded-lg border border-border",
            disabled || atMin ? "opacity-40" : "",
          )}
        >
          <Text className={cn("text-xl", disabled || atMin ? "text-muted" : "text-text")}>−</Text>
        </Pressable>

        <TextInput
          className={cn(
            "flex-1 rounded-lg border bg-surface px-3 py-2 text-center text-base text-text",
            borderStyle,
          )}
          keyboardType="numeric"
          accessibilityLabel={label}
          value={String(value)}
          onChangeText={handleChangeText}
          editable={!disabled}
          onFocus={() => !disabled && setFocused(true)}
          onBlur={handleBlur}
          placeholderTextColor="#9CA3AF"
        />

        <Pressable
          testID="increment-button"
          onPress={handleIncrement}
          disabled={disabled || atMax}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: disabled || atMax }}
          className={cn(
            "h-10 w-10 items-center justify-center rounded-lg border",
            disabled || atMax ? "border-border opacity-40" : "border-border",
          )}
        >
          <Text className={cn("text-xl", disabled || atMax ? "text-muted" : "text-text")}>+</Text>
        </Pressable>
      </View>
      <InputError error={error} />
    </View>
  );
}
