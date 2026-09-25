import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";

type Props = {
  action: {
    label: string;
    icon: IconName;
    isValid: boolean;
    loading: boolean;
    style: { border: string; iconColor: string; textColor: string };
    submit: () => void;
  };
  onReset: () => void;
};

export function AmountFormActions({ action, onReset }: Props) {
  const disabled = !action.isValid || action.loading;
  return (
    <View className="flex-row items-center justify-between gap-3 pt-2">
      <TouchableOpacity testID="eraser-button" accessibilityRole="button" accessibilityLabel="Clear form"
        accessibilityState={{ disabled: action.loading }} onPress={onReset} disabled={action.loading}
        className={cn("p-3 border border-muted rounded-full", action.loading && "opacity-50")}>
        <Icon name="eraser" size={20} color={colors.muted} />
      </TouchableOpacity>
      <Pressable testID="submit-button" accessibilityRole="button" accessibilityLabel={action.label}
        accessibilityState={{ disabled, busy: action.loading }} aria-busy={action.loading}
        onPress={action.submit} disabled={disabled}
        className={cn("rounded-lg border px-5 py-3 flex-row items-center gap-2", disabled && "opacity-50", action.style.border)}>
        {action.loading ? <ActivityIndicator accessibilityLabel={`Submitting ${action.label}`} color={action.style.iconColor} /> : (
          <>
            <Icon name={action.icon} size={20} color={action.style.iconColor} />
            <Text className={cn("font-semibold text-base", action.style.textColor)}>{action.label}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
