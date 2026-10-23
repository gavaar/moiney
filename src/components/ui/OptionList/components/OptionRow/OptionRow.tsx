import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { cn, colors } from "@/lib/styles";

type Props = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  multiple?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function OptionRow({ children, onPress, disabled, selected = false, multiple = false, className = "px-2 py-2", style }: Props) {
  return <Pressable
    accessibilityRole={multiple ? "checkbox" : "button"}
    accessibilityState={{ disabled, ...(multiple ? { checked: selected } : {}) }}
    aria-checked={multiple ? selected : undefined}
    disabled={disabled}
    onPress={onPress}
    className={cn("border-b border-border/30 last:border-b-0 active:opacity-70", className)}
    style={[style, selected ? { backgroundColor: `${colors.muted}1A`, borderRadius: 8 } : undefined]}
  >{children}</Pressable>;
}
