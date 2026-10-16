import type { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";

export function FormActionRow({ onClear, clearDisabled = false, clearLabel = "Clear form", clearIcon = "eraser", children }: {
  onClear: () => void;
  clearDisabled?: boolean;
  clearLabel?: string;
  clearIcon?: IconName;
  children: ReactNode;
}) {
  return <View className="flex-row items-center justify-between gap-3">
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={clearLabel}
      accessibilityState={{ disabled: clearDisabled }} onPress={onClear} disabled={clearDisabled}
      testID="eraser-button" hitSlop={8}
      className={cn("rounded-full border border-muted p-2", clearDisabled && "opacity-50")}>
      <Icon name={clearIcon} size={16} color={colors.muted} />
    </TouchableOpacity>
    {children}
  </View>;
}
