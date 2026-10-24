import { useMemo, useRef, useState } from "react";
import { Text, TextInput as RNTextInput, View } from "react-native";
import { colors } from "@/lib/styles";
import { AnchoredOptionList, OptionRow } from "@ui/OptionList";
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
  const anchorRef = useRef<View>(null);

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    const lower = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().startsWith(lower) && o !== value);
  }, [options, value]);

  const showList = focused && filteredOptions.length > 0;

  return (
    <View ref={anchorRef} collapsable={false}>
      <RNTextInput
        ref={inputRef}
        className="w-full p-0 text-base text-text"
        placeholderTextColor={colors.muted}
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
      {showList && !disabled && <AnchoredOptionList
        visible
        anchorRef={anchorRef}
        maxHeight={160}
        className="rounded-lg border border-border bg-surface shadow-lg"
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} suggestions` : "Suggestions"}
        data={filteredOptions}
        keyExtractor={option => option}
        onClose={() => {
          setFocused(false);
          onFocusChange(false);
          inputRef.current?.blur();
        }}
        renderItem={({ item: option }) => (
          <OptionRow
            onPress={() => {
              if (disabled) return;
              onInteractionEnd();
              onChange?.(option);
              setFocused(false);
              onFocusChange(false);
              inputRef.current?.blur();
            }}
            className="px-3 py-3"
          >
            <Text className="text-text text-base">{option}</Text>
          </OptionRow>
        )}
      />}
    </View>
  );
}
