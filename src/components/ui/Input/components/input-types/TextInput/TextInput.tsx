import {
  ActivityIndicator,
  TextInput as RNTextInput,
  View,
  type TextInputProps as NativeTextInputProps,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import type { InputInteraction, InputValueProps } from "../../../input.types";

export type TextInputProps = InputValueProps<string> & Omit<NativeTextInputProps, "value" | "defaultValue" | "onChange" | "onChangeText"> & {
  status?: "checking" | "available" | "unavailable";
  maxLength?: number;
};

type Props = TextInputProps & InputInteraction;

export function TextInput({
  accessibilityLabel,
  className,
  disabled,
  status,
  maxLength: _maxLength,
  editable,
  onFocus,
  onBlur,
  onChange,
  value,
  onFocusChange,
  onInteractionEnd,
  error: _error,
  ...props
}: Props) {
  const inputLabel = accessibilityLabel;

  return (
    <View className="flex-row items-center gap-2">
      <RNTextInput
        {...props}
        value={value}
        onChangeText={text => {
          if (disabled || editable === false) return;
          onChange?.(text);
        }}
        accessibilityLabel={inputLabel}
        accessibilityState={{ disabled }}
        className={cn("min-w-0 flex-1 p-0 text-base text-text", className)}
        placeholderTextColor="#9CA3AF"
        editable={disabled ? false : editable}
        onFocus={(event) => {
          if (!disabled) onFocusChange(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          onFocusChange(false);
          if (!disabled && editable !== false) onInteractionEnd();
          onBlur?.(event);
        }}
      />
      {status === "checking" ? (
        <ActivityIndicator
          testID="status-checking"
          accessibilityLabel={`${inputLabel ?? "Input"} checking`}
          size="small"
          color={colors.secondary}
        />
      ) : status === "available" ? (
        <View accessible accessibilityRole="image" accessibilityLabel={`${inputLabel ?? "Input"} available`}>
          <Icon testID="status-available" name="checkmark-circle" size={20} color={colors.success} />
        </View>
      ) : status === "unavailable" ? (
        <View accessible accessibilityRole="image" accessibilityLabel={`${inputLabel ?? "Input"} unavailable`}>
          <Icon testID="status-unavailable" name="close-circle" size={20} color={colors.error} />
        </View>
      ) : null}
    </View>
  );
}
