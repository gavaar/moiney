import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@/components/ui/Icon";

type Props = TextInputProps & {
  label: string;
  error?: string;
  endIcon?: "eye" | "eye-off";
  onEndIconPress?: () => void;
  status?: "checking" | "available" | "unavailable";
};

const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-border",
};

export function TextInput({ label, error, className, endIcon, onEndIconPress, status, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const hasTrailing = !!(status || endIcon);

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="relative">
        <RNTextInput
          className={cn(
            "rounded-lg border bg-surface px-3 py-2.5 text-base text-text",
            hasTrailing && "pr-10",
            focused ? BORDER_STYLES.focused : error ? BORDER_STYLES.error : BORDER_STYLES.default,
            className,
          )}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {hasTrailing ? (
          <View className="absolute right-3 top-0 bottom-0 flex-row items-center gap-1">
            {status === "checking" ? (
              <ActivityIndicator testID="status-checking" size="small" color={colors.secondary} />
            ) : status === "available" ? (
              <Icon testID="status-available" name="checkmark-circle" size={20} color={colors.success} />
            ) : status === "unavailable" ? (
              <Icon testID="status-unavailable" name="close-circle" size={20} color={colors.error} />
            ) : null}
            {endIcon ? (
              <Pressable testID="end-icon-button" onPress={onEndIconPress} hitSlop={8}>
                <Icon name={endIcon} size={20} color={colors.secondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
