import { Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import type { FormHeader as FormHeaderProps } from "../../form.types";

export function FormHeader({ title, icon, accessibilityLabel, badge }: FormHeaderProps) {
  return (
    <View accessibilityRole="header" accessibilityLabel={accessibilityLabel ?? title}
      className="flex-row items-center gap-2 border-b border-muted/20 p-2">
      {icon ? <Icon name={icon} size={24} color={colors.muted} /> : null}
      <Text className="flex-1 text-md font-medium text-muted" numberOfLines={1}>{title}</Text>
      {badge ? <View className="flex-row items-center gap-1">
        <Text className="text-sm text-muted">{badge.label}</Text>
        {badge.icon ? <Icon name={badge.icon} size={18} color={colors.muted} /> : null}
      </View> : null}
    </View>
  );
}
