import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput as RNTextInput, View } from "react-native";
import type { InputInteraction, InputValueProps } from "../../../input.types";

export type TextSelectInputProps = InputValueProps<string> & {
  options: readonly string[];
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
};

type Props = TextSelectInputProps & InputInteraction;

export function TextSelectInput({
  accessibilityLabel,
  value,
  onChange,
  options,
  disabled,
  maxLength,
  placeholder,
  multiline,
  onFocusChange,
  onInteractionEnd,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    const lower = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().startsWith(lower) && o !== value);
  }, [options, value]);

  const showList = focused && filteredOptions.length > 0;

  return (
      <>
          <RNTextInput
            ref={inputRef}
            className="w-full p-0 text-base text-text"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled }}
            editable={!disabled}
            value={value}
            onChangeText={text => {
              if (disabled) return;
              onChange?.(text);
            }}
            placeholder={placeholder}
            multiline={multiline}
            maxLength={maxLength}
            onFocus={() => { if (!disabled) { setFocused(true); onFocusChange(true); } }}
            onBlur={() => {
              setFocused(false);
              onFocusChange(false);
              if (!disabled) onInteractionEnd();
            }}
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
                      if (disabled) return;
                      onInteractionEnd();
                      onChange?.(option);
                      setFocused(false);
                      onFocusChange(false);
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
      </>
  );
}
