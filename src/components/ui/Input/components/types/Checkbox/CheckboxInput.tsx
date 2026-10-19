import { Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { InputError, useInputValidation } from "../../InputError";
import { InputWrapper, type InputActions } from "../../InputWrapper";
import { getBorderStyle } from "../../../input.config";

type Props = InputActions & {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  onError?: (error?: string) => void;
  validator?: (value: boolean) => string | undefined;
  disabled?: boolean;
};

export function CheckboxInput({ label, value, onChange, disabled, validator, onError, prefix, suffix }: Props) {
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  return (
    <View className="gap-1">
      <InputWrapper
        appearance="borderless"
        borderStyle={getBorderStyle(disabled, false, error)}
        prefix={prefix}
        suffix={suffix}
        testID="checkbox-touchable"
        onPress={() => {
          if (disabled) return;
          markAsDirty();
          onChange?.(!value);
        }}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        aria-checked={value}
        contentClassName="flex-row items-center gap-2"
        className={cn(disabled && "opacity-50")}
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
        <Text className="min-w-0 flex-1 text-base text-text">{label}</Text>
      </InputWrapper>
      <InputError error={error} />
    </View>
  );
}
