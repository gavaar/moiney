import { Pressable, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { InputError, useInputValidation } from "../../useInputValidation";

type Props = {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  onError?: (error?: string) => void;
  validator?: (value: boolean) => string | undefined;
  disabled?: boolean;
};

export function CheckboxInput({ label, value, onChange, disabled, validator, onError }: Props) {
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  return (
    <View className="gap-1">
      <Pressable
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
        className={cn("flex-row items-center gap-2", disabled && "opacity-50")}
      >
        <View
          className={cn(
            "w-6 h-6 rounded border items-center justify-center",
            value ? "bg-primary border-primary" : "bg-surface border-border",
            error !== undefined && "border-error",
          )}
        >
          {value && <Icon testID="checkbox-checked-icon" name="checkmark" size={16} color={colors.background} />}
        </View>
        <Text className="text-sm text-text">{label}</Text>
      </Pressable>
      <InputError error={error} />
    </View>
  );
}
