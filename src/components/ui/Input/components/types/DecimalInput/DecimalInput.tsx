import { useMemo, useState } from "react";
import {
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";
import { getBorderStyle } from "../../../input.config";
import { InputError, useInputValidation } from "../../InputError";
import { InputWrapper, type InputActions } from "../../InputWrapper";
import { InputLabel } from "../../InputLabel";

type Props = InputActions & {
  label?: string;
  accessibilityLabel?: string;
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

export function DecimalInput({ label, accessibilityLabel, validator, disabled, value, onChange, onError, placeholder, allowNegative = true, prefix, suffix }: Props) {
  const [focused, setFocused] = useState(false);
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  const inputLabel = accessibilityLabel ?? label;
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

  const signAction = allowNegative ? {
    content: <Text className="text-base font-bold text-muted">{isNegative ? "-" : "+"}</Text>,
    accessibilityLabel: `Change ${inputLabel ?? "value"} sign, currently ${isNegative ? "negative" : "positive"}`,
    onPress: handleSignPress,
  } : null;

  return (
    <View className="gap-1">
      <InputLabel label={label} />
      <InputWrapper
        borderStyle={borderStyle}
        disabled={disabled}
        className={cn(disabled && "opacity-60")}
        prefix={prefix === undefined ? signAction : prefix}
        suffix={suffix}
      >
        <RNTextInput
          className="w-full p-0 text-base text-text"
          keyboardType="decimal-pad"
          accessibilityLabel={inputLabel}
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
      </InputWrapper>
      <InputError error={error} />
    </View>
  );
}
