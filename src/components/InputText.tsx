import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/Icon";

type Props = TextInputProps & {
  label: string;
  error?: string;
  endIcon?: "eye" | "eye-off";
  onEndIconPress?: () => void;
};

const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-[#D1D5DB]",
};

export function InputText({ label, error, className, endIcon, onEndIconPress, ...props }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="relative">
        <TextInput
          className={cn(
            "rounded-lg border bg-white px-3 py-2.5 text-base text-text",
            endIcon && "pr-10",
            focused ? BORDER_STYLES.focused : error ? BORDER_STYLES.error : BORDER_STYLES.default,
            className,
          )}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {endIcon ? (
          <Pressable
            onPress={onEndIconPress}
            className="absolute right-3 top-0 bottom-0 justify-center"
          >
            <Icon name={endIcon} size={20} color="#6B7280" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}