
import { createElement } from "react";
import { Text } from "react-native";
import { cn } from "@/lib/styles";
import type { InputProps } from "./Input";
import type { InputActions } from "./input.types";
import { clampNumber, sanitizeDecimal } from "./input.utils";

export const INPUT_CONTENT_PADDING = "px-3 py-2";

export const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-border",
};

export function getBorderStyle(
  disabled: boolean | undefined,
  focused: boolean,
  error: string | undefined,
): string {
  if (disabled) return "border-border";
  if (focused) return BORDER_STYLES.focused;
  if (error !== undefined) return BORDER_STYLES.error;
  return BORDER_STYLES.default;
}

export function getDefaultActions<Item extends { id: string }>(props: InputProps<Item>, interaction: {
  onInteractionEnd: () => void;
  onValueChange: () => void;
}): InputActions {
  const accessibilityLabel = props.accessibilityLabel ?? props.label;

  switch (props.type) {
    case "number": {
      const { value, min = 0, max = Infinity, step = 1, disabled, onChange } = props;
      function commit(delta: number) {
        if (disabled || !onChange) return;
        const next = clampNumber(value + delta, min, max);
        if (next === value) return;
        interaction.onInteractionEnd();
        interaction.onValueChange();
        onChange(next);
      }

      return {
        prefix: {
          content: createElement(Text, { className: cn("text-xl", disabled || value <= min ? "text-muted" : "text-text") }, "−"),
          accessibilityLabel: `Decrease ${accessibilityLabel ?? "value"}`,
          onPress: () => commit(-step),
          disabled: value <= min,
        },
        suffix: {
          content: createElement(Text, { className: cn("text-xl", disabled || value >= max ? "text-muted" : "text-text") }, "+"),
          accessibilityLabel: `Increase ${accessibilityLabel ?? "value"}`,
          onPress: () => commit(step),
          disabled: value >= max,
        },
      };
    }
    case "decimal": {
      const { value, onChange, disabled, allowNegative = true } = props;
      const isNegative = allowNegative && value.startsWith("-");

      return {
        prefix: allowNegative ? {
          content: createElement(Text, { className: "text-base font-bold text-muted" }, isNegative ? "-" : "+"),
          accessibilityLabel: `Change ${accessibilityLabel ?? "value"} sign, currently ${isNegative ? "negative" : "positive"}`,
          onPress: () => {
            if (disabled || !onChange) return;
            interaction.onValueChange();
            onChange(`${isNegative ? "" : "-"}${sanitizeDecimal(value)}`);
          },
        } : null,
      };
    }
    default:
      return {};
  }
}
