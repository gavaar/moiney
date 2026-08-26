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
  variant?: "primary" | "secondary" | "muted" | "error";
  loading?: boolean;
  icon?: IconName;
};

const VARIANT_STYLES = {
  primary: "bg-primary active:bg-primary/90",
  secondary: "bg-secondary active:bg-secondary/90",
  muted: "bg-transparent active:bg-muted/90",
  error: "bg-error active:bg-error/90",
};

const TEXT_VARIANTS = {
  primary: "text-white font-semibold text-base",
  secondary: "text-white font-semibold text-base",
  muted: "text-muted",
  error: "text-white font-semibold text-base",
};

const ICON_COLORS: Record<NonNullable<Props["variant"]>, string> = {
  primary: colors.text,
  secondary: colors.text,
  muted: colors.muted,
  error: colors.text,
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
      className={cn(
        "rounded-lg px-4 py-3 items-center justify-center",
        VARIANT_STYLES[variant],
        (disabled || loading) && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={`Loading ${title}`}
          color={colors.background}
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
