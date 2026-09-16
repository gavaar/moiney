import { useMemo, useState } from "react";
import {
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";
import { getBorderStyle } from "../../input.config";
import { InputError, useInputValidation } from "../../useInputValidation";

type Props = {
  label: string;
  disabled?: boolean;
  value: string;
  placeholder?: string;
  allowNegative?: boolean;
  onChange?: (value: string) => void;
  onError?: (error?: string) => void;
  validator?: (value: string) => string | undefined;
};

const sanitizeDecimal = (input: string): string => {
  const cleaned = input.replace(/-/g, "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
};

export function DecimalInput({ label, validator, disabled, value, onChange, onError, placeholder, allowNegative = true }: Props) {
  const [focused, setFocused] = useState(false);
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  const borderStyle = useMemo(() => getBorderStyle(disabled, focused, error), [disabled, focused, error]);

  const displayValue = useMemo(() => sanitizeDecimal(value), [value]);
  const isNegative = useMemo(() => allowNegative && (value.startsWith("-")), [allowNegative, value]);

  const handleChangeText = (text: string) => {
    if (!onChange || disabled) return;
    const newSign = allowNegative
      ? text.includes("-") ? (isNegative ? "" : "-") : (isNegative ? "-" : "")
      : "";
    const next = `${newSign}${sanitizeDecimal(text)}`;
    onChange(next);
  };

  const handleSignPress = () => {
    if (disabled || !onChange) return;
    const newSign = isNegative ? "" : "-";
    const next = `${newSign}${sanitizeDecimal(value)}`;
    onChange(next);
  };

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="flex-row">
        {allowNegative ? (
          <Pressable
            onPress={handleSignPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Change ${label} sign, currently ${isNegative ? "negative" : "positive"}`}
            accessibilityState={{ disabled }}
            className={cn(
              "justify-center rounded-tl-lg rounded-bl-lg border border-r-0 bg-surface px-2",
              disabled && "opacity-60",
              borderStyle
            )}
          >
            <Text className="text-base font-bold text-muted w-2 text-center">{isNegative ? "-" : "+"}</Text>
          </Pressable>
        ) : null}
        <RNTextInput
          className={cn(
            "flex-1 rounded-tr-lg rounded-br-lg border bg-surface px-3 py-2 text-base text-text",
            disabled && "opacity-60",
            allowNegative ? "" : "rounded-tl-lg rounded-bl-lg",
            borderStyle,
          )}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          editable={!disabled}
          onFocus={() => !disabled && setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (!disabled) {
              markAsDirty();
            }
          }}
        />
      </View>
      <InputError error={error} />
    </View>
  );
}
