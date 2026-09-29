import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: "primary" | "secondary" | "muted" | "error" | "outline";
  loading?: boolean;
  icon?: IconName;
};

export const actionButtonSizing = "min-h-10 px-4 py-2";

const VARIANT_STYLES = {
  primary: "bg-primary active:bg-primary/90",
  secondary: "bg-secondary active:bg-secondary/90",
  muted: "bg-transparent active:bg-muted/90",
  error: "bg-error active:bg-error/90",
  outline: "border border-primary bg-transparent active:bg-primary/10",
};

const TEXT_VARIANTS = {
  primary: "text-white font-semibold text-base",
  secondary: "text-white font-semibold text-base",
  muted: "text-muted",
  error: "text-white font-semibold text-base",
  outline: "text-primary font-semibold text-base",
};

const ICON_COLORS: Record<NonNullable<Props["variant"]>, string> = {
  primary: colors.text,
  secondary: colors.text,
  muted: colors.muted,
  error: colors.text,
  outline: colors.primary,
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  icon,
  className,
  accessibilityLabel,
  accessibilityState,
  hitSlop = 6,
  ...props
}: Props) {
  return (
    <TouchableOpacity
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled || loading,
        busy: loading,
      }}
      aria-busy={loading}
      hitSlop={hitSlop}
      className={cn(
        "rounded-lg items-center justify-center",
        actionButtonSizing,
        VARIANT_STYLES[variant],
        (disabled || loading) && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={`Loading ${title}`}
          color={variant === "outline" ? colors.primary : colors.background}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Icon name={icon} size={16} color={ICON_COLORS[variant]} /> : null}
          <Text className={TEXT_VARIANTS[variant]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
