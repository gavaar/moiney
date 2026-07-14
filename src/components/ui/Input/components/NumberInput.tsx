import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";

type Props = {
  label: string;
  error?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-border",
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
  error,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
}: Props) {
  const [focused, setFocused] = useState(false);

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max],
  );

  const handleIncrement = () => {
    const next = clamp(value + step);
    if (next !== value) onChange(next);
  };

  const handleDecrement = () => {
    const next = clamp(value - step);
    if (next !== value) onChange(next);
  };

  const handleChangeText = (text: string) => {
    onChange(parseDigits(text));
  };

  const handleBlur = () => {
    setFocused(false);
    const clamped = clamp(value);
    if (clamped !== value) onChange(clamped);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          testID="decrement-button"
          onPress={handleDecrement}
          disabled={atMin}
          className={cn(
            "h-10 w-10 items-center justify-center rounded-lg border",
            atMin ? "border-border opacity-40" : "border-border",
          )}
        >
          <Text className={cn("text-xl", atMin ? "text-mutedForeground" : "text-text")}>−</Text>
        </Pressable>

        <TextInput
          className={cn(
            "flex-1 rounded-lg border bg-surface px-3 py-2.5 text-center text-base text-text",
            focused ? BORDER_STYLES.focused : error ? BORDER_STYLES.error : BORDER_STYLES.default,
          )}
          keyboardType="numeric"
          value={String(value)}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholderTextColor="#9CA3AF"
        />

        <Pressable
          testID="increment-button"
          onPress={handleIncrement}
          disabled={atMax}
          className={cn(
            "h-10 w-10 items-center justify-center rounded-lg border",
            atMax ? "border-border opacity-40" : "border-border",
          )}
        >
          <Text className={cn("text-xl", atMax ? "text-mutedForeground" : "text-text")}>+</Text>
        </Pressable>
      </View>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
