import { useState } from "react";
import {
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";
import { getBorderStyle } from "../../input.config";

type Props = {
  label: string;
  error?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function sanitizeDecimal(input: string): string {
  const allowed = input.replace(/[^0-9.]/g, "");
  const parts = allowed.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return allowed;
}

export function DecimalInput({ label, error, disabled, value, onChange, placeholder }: Props) {
  const [focused, setFocused] = useState(false);

  const borderStyle = getBorderStyle(disabled, focused, error);

  const handleChangeText = (text: string) => {
    const sanitized = sanitizeDecimal(text);
    if (sanitized !== text) {
      onChange(sanitized);
    } else {
      onChange(text);
    }
  };

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <RNTextInput
        className={cn(
          "rounded-lg border bg-surface px-3 py-2.5 text-base text-text",
          disabled && "opacity-60",
          borderStyle,
        )}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        editable={!disabled}
        onFocus={() => !disabled && setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
