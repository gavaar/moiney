import { Pressable, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function CheckboxInput({ label, checked, onChange, disabled }: Props) {
  return (
    <Pressable
      testID="checkbox-touchable"
      onPress={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn("flex-row items-center gap-2", disabled && "opacity-50")}
    >
      <View
        className={cn(
          "w-6 h-6 rounded border items-center justify-center",
          checked ? "bg-primary border-primary" : "bg-surface border-border",
        )}
      >
        {checked && <Icon testID="checkbox-checked-icon" name="checkmark" size={16} color={colors.background} />}
      </View>
      <Text className="text-sm text-text">{label}</Text>
    </Pressable>
  );
}
