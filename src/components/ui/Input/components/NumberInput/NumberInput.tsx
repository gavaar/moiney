import { TextInput } from "react-native";
import { colors } from "@/lib/styles";
import type { InputInteraction, InputValueProps } from "../../input.types";
import { clampNumber } from "../../input.utils";

export type NumberInputProps = InputValueProps<number> & {
  min?: number;
  max?: number;
  step?: number;
};

type Props = NumberInputProps & InputInteraction;

function stripNonDigits(input: string): string {
  return input.replace(/\D/g, "");
}

function parseDigits(input: string): number {
  const digits = stripNonDigits(input);
  if (digits === "") return 0;
  return parseInt(digits, 10);
}

export function NumberInput({ accessibilityLabel, disabled, value, onChange, min = 0, max = Infinity, onFocusChange, onInteractionEnd }: Props) {
  const handleChangeText = (text: string) => {
    if (disabled) return;
    const next = parseDigits(text);
    onChange?.(next);
  };

  const handleBlur = () => {
    onFocusChange(false);
    if (disabled) return;
    const clamped = clampNumber(value, min, max);
    onInteractionEnd();
    if (clamped !== value) onChange?.(clamped);
  };

  return (
    <TextInput
      className="w-full p-0 text-center text-base text-text"
      keyboardType="numeric"
      accessibilityLabel={accessibilityLabel}
      value={String(value)}
      onChangeText={handleChangeText}
      editable={!disabled}
      onFocus={() => !disabled && onFocusChange(true)}
      onBlur={handleBlur}
      placeholderTextColor={colors.muted}
    />
  );
}
