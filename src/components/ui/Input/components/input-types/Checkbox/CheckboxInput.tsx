import { Pressable, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../../input.types";

export type CheckboxInputProps = InputValueProps<boolean> & {
  checkboxLabel?: string;
};

type Props = CheckboxInputProps & InputInteraction & InputTriggerProps;

export function CheckboxInput({ checkboxLabel, accessibilityLabel, value, onChange, disabled, error, onInteractionEnd, triggerClassName }: Props) {
  return (
    <Pressable
      testID="checkbox-touchable"
      onPress={() => {
        if (disabled) return;
        onInteractionEnd();
        onChange?.(!value);
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? checkboxLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      className={cn(triggerClassName, "flex-row items-center gap-2")}
    >
      <View
        className={cn(
          "w-6 h-6 shrink-0 rounded border items-center justify-center",
          value ? "bg-primary" : "bg-surface",
          !disabled && error !== undefined ? "border-error" : value ? "border-primary" : "border-border",
        )}
      >
        {value && <Icon testID="checkbox-checked-icon" name="checkmark" size={16} color={colors.background} />}
      </View>
      {checkboxLabel ? <Text className="min-w-0 flex-1 text-base text-text">{checkboxLabel}</Text> : null}
    </Pressable>
  );
}
