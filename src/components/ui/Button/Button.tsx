import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";
import { cn, colors } from "@/lib/styles";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: "primary" | "secondary" | "mutedForeground" | "error";
  loading?: boolean;
};

const VARIANT_STYLES = {
  primary: "bg-primary active:bg-primary/90",
  secondary: "bg-secondary active:bg-secondary/90",
  mutedForeground: "bg-transparent active:bg-mutedForeground/90",
  error: "bg-error active:bg-error/90",
};

const TEXT_VARIANTS = {
  primary: "text-white font-semibold text-base",
  secondary: "text-white font-semibold text-base",
  mutedForeground: "text-mutedForeground",
  error: "text-white font-semibold text-base",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...props
}: Props) {
  return (
    <TouchableOpacity
      disabled={disabled || loading}
      className={cn(
        "rounded-lg px-4 py-3 items-center justify-center",
        VARIANT_STYLES[variant],
        (disabled || loading) && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text className={TEXT_VARIANTS[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}