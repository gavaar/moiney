import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";
import { cn } from "@/lib/cn";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
};

const VARIANT_STYLES = {
  primary: "bg-primary active:bg-primary/90",
  secondary: "bg-secondary active:bg-secondary/90",
  danger: "bg-error active:bg-error/90",
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
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-white font-semibold text-base">{title}</Text>
      )}
    </TouchableOpacity>
  );
}