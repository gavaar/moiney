import { ActivityIndicator, Pressable, Text } from "react-native";
import { cn } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";
import { actionButtonSizing } from "@ui/Button";
import { FormActionRow } from "@ui/Form";

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
    <FormActionRow onClear={onReset} clearDisabled={action.loading}>
      <Pressable testID="submit-button" accessibilityRole="button" accessibilityLabel={action.label}
        accessibilityState={{ disabled, busy: action.loading }} aria-busy={action.loading}
        onPress={action.submit} disabled={disabled} hitSlop={6}
        className={cn("rounded-lg border flex-row items-center gap-2", actionButtonSizing, disabled && "opacity-50", action.style.border)}>
        {action.loading ? <ActivityIndicator accessibilityLabel={`Submitting ${action.label}`} color={action.style.iconColor} /> : (
          <>
            <Icon name={action.icon} size={18} color={action.style.iconColor} />
            <Text className={cn("font-semibold text-base", action.style.textColor)}>{action.label}</Text>
          </>
        )}
      </Pressable>
    </FormActionRow>
  );
}
