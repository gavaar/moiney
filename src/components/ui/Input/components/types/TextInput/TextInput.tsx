import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { getBorderStyle } from "../../../input.config";
import { InputError, useInputValidation } from "../../InputError";
import { InputWrapper, type InputActions } from "../../InputWrapper";
import { InputLabel } from "../../InputLabel";

type Props = InputActions & Omit<TextInputProps, "value" | "defaultValue" | "onChange" | "onChangeText"> & {
  value: string;
  label?: string;
  disabled?: boolean;
  status?: "checking" | "available" | "unavailable";
  maxLength?: number;
  onChange?: (value: string) => void;
  onError?: (error?: string) => void;
  validator?: (value: string) => string | undefined;
};

export function TextInput({
  label,
  accessibilityLabel,
  validator,
  className,
  disabled,
  status,
  maxLength,
  editable,
  onFocus,
  onBlur,
  onChange,
  onError,
  value,
  prefix,
  suffix,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  const inputLabel = accessibilityLabel ?? label;

  const borderStyle = getBorderStyle(disabled, focused, error);

  const currentLength = String(value ?? "").length;

  return (
    <View className="gap-1">
      <InputLabel label={label} />
      <InputWrapper
        borderStyle={borderStyle}
        disabled={disabled}
        prefix={prefix}
        suffix={suffix}
        contentClassName="flex-row items-center gap-2"
        className={cn(disabled && "opacity-60")}
      >
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
            if (!disabled) setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            if (!disabled && editable !== false) markAsDirty();
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
      </InputWrapper>
      {error !== undefined ? (
        <InputError error={error} />
      ) : maxLength !== undefined ? (
        <Text className={cn("text-sm", currentLength > maxLength ? "text-error" : "text-muted")}>
          {currentLength} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
}
