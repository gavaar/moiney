import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { cn, colors } from "@/lib/styles";

type Props = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  multiple?: boolean;
  variant?: "separator" | "card";
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function OptionRow({ children, onPress, disabled, selected = false, multiple = false, variant = "separator", className = "px-2 py-2", style, accessibilityLabel }: Props) {
  return <Pressable
    accessibilityRole={multiple ? "checkbox" : "button"}
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled, ...(multiple ? { checked: selected } : { selected }) }}
    aria-checked={multiple ? selected : undefined}
    aria-pressed={multiple ? undefined : selected}
    disabled={disabled}
    onPress={onPress}
    className={cn("active:opacity-70", variant === "card" ? "rounded-lg border" : "border-b border-border/30 last:border-b-0", className)}
    style={[style, selected ? { backgroundColor: `${colors.muted}1A`, borderRadius: 8 } : undefined]}
  >{children}</Pressable>;
}
