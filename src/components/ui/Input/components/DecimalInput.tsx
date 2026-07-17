import { useState } from "react";
import {
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { cn } from "@/lib/styles";

type Props = {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-border",
};

function sanitizeDecimal(input: string): string {
  const allowed = input.replace(/[^0-9.]/g, "");
  const parts = allowed.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return allowed;
}

export function DecimalInput({ label, error, value, onChange, placeholder }: Props) {
  const [focused, setFocused] = useState(false);

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
          focused ? BORDER_STYLES.focused : error ? BORDER_STYLES.error : BORDER_STYLES.default,
        )}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
