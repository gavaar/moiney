import { Pressable, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";

type Props = {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  error?: string;
};

export function CheckboxInput({ label, value, onChange, disabled, error }: Props) {
  return (
    <View className="gap-1">
      <Pressable
        testID="checkbox-touchable"
        onPress={() => !disabled && onChange?.(!value)}
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
            error && "border-error",
          )}
        >
          {value && <Icon testID="checkbox-checked-icon" name="checkmark" size={16} color={colors.background} />}
        </View>
        <Text className="text-sm text-text">{label}</Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
