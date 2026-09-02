import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput as RNTextInput, View } from "react-native";
import { cn } from "@/lib/styles";
import { getBorderStyle } from "../../input.config";

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onOptionSelect: (value: string) => void;
  options: readonly string[];
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
};

export function TextSelectInput({
  label,
  value,
  onChangeText,
  onOptionSelect,
  options,
  error,
  disabled,
  maxLength,
  placeholder,
  multiline,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    const lower = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().startsWith(lower) && o !== value);
  }, [options, value]);

  const showList = focused && filteredOptions.length > 0;

  const currentLength = String(value ?? "").length;
  const borderStyle = getBorderStyle(disabled, focused, error);

  return (
    <View className="gap-1">
      {label ? <Text className="text-sm font-medium text-text">{label}</Text> : null}
      <View className="relative">
        <RNTextInput
          ref={inputRef}
          className={cn(
            "rounded-lg border bg-surface px-3 py-2 text-base text-text",
            disabled && "opacity-60",
            borderStyle,
          )}
           placeholderTextColor="#9CA3AF"
           accessibilityLabel={label}
           accessibilityState={{ disabled }}
           editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => !disabled && setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {showList && (
          <>
            <View
              className="absolute left-0 right-0 z-40"
              style={{ top: "100%", height: 2000 }}
              onStartShouldSetResponder={() => {
                inputRef.current?.blur();
                return true;
              }}
            />
            <View className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface shadow-lg">
              <ScrollView className="max-h-40" keyboardShouldPersistTaps="handled">
                {filteredOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onOptionSelect(option);
                      inputRef.current?.blur();
                    }}
                    className="px-3 py-3 border-b border-border/30 last:border-b-0 active:opacity-70"
                  >
                    <Text className="text-text text-base">{option}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
          {error}
        </Text>
      ) : maxLength !== undefined ? (
        <Text className={cn("text-sm", currentLength > maxLength ? "text-error" : "text-muted")}>
          {currentLength} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
}
