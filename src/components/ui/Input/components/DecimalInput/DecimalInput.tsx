import { TextInput as RNTextInput } from "react-native";
import { cn, colors } from "@/lib/styles";
import { INPUT_CONTENT_TEXT } from "../../input.config";
import type { InputInteraction, InputValueProps } from "../../input.types";
import { sanitizeDecimal } from "../../input.utils";

export type DecimalInputProps = InputValueProps<string> & {
  placeholder?: string;
  allowNegative?: boolean;
};

type Props = DecimalInputProps & InputInteraction;

export function DecimalInput({ accessibilityLabel, disabled, value, onChange, placeholder, allowNegative = true, onFocusChange, onInteractionEnd }: Props) {
  const displayValue = sanitizeDecimal(value);
  const isNegative = allowNegative && value.startsWith("-");

  const handleChangeText = (text: string) => {
    if (!onChange || disabled) return;
    const newSign = allowNegative
      ? text.includes("-") ? (isNegative ? "" : "-") : (isNegative ? "-" : "")
      : "";
    const next = `${newSign}${sanitizeDecimal(text)}`;
    onChange(next);
  };

  return (
    <RNTextInput
      className={cn("w-full p-0 text-text", INPUT_CONTENT_TEXT)}
      keyboardType="decimal-pad"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      value={displayValue}
      onChangeText={handleChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      editable={!disabled}
      onFocus={() => !disabled && onFocusChange(true)}
      onBlur={() => {
        onFocusChange(false);
        if (!disabled) onInteractionEnd();
      }}
    />
  );
}
