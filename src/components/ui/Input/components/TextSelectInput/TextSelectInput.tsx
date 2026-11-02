import { useMemo, useRef, useState } from "react";
import { Platform, Text, TextInput as RNTextInput, View, type TextInputInstance, type ViewInstance } from "react-native";
import { cn, colors } from "@/lib/styles";
import { INPUT_CONTENT_TEXT, INPUT_EDITOR_FOCUS } from "../../input.config";
import { AnchoredOptionList, OptionRow } from "@ui/OptionList";
import type { InputInteraction, InputValueProps } from "../../input.types";
import { focusFirstControl, focusMovingInto } from "@ui/keyboard/focus";
import { isComposingKey, keyboardKey, type ControlKeyEvent } from "@ui/keyboard/choiceKeyboard";

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  const anchorRef = useRef<ViewInstance>(null);
  const suggestionsRef = useRef<ViewInstance>(null);

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    const lower = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().startsWith(lower) && o !== value);
  }, [options, value]);

  const showList = suggestionsOpen && filteredOptions.length > 0;

  function closeSuggestions(reason: "outside" | "keyboard" | "blur" | "selection") {
    if (!disabled && (reason === "blur" || reason === "outside")) onInteractionEnd();
    if (Platform.OS === "web" && (reason === "keyboard" || reason === "selection")) {
      inputRef.current?.focus();
      onFocusChange(true);
    } else {
      onFocusChange(false);
      inputRef.current?.blur();
    }
    setSuggestionsOpen(false);
  }

  return (
    <View ref={anchorRef} collapsable={false}>
      <RNTextInput
        ref={inputRef}
        className={cn("w-full p-0 text-text", INPUT_CONTENT_TEXT, INPUT_EDITOR_FOCUS)}
        placeholderTextColor={colors.muted}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        editable={!disabled}
        value={value}
        onChangeText={text => {
          if (disabled) return;
          if (inputRef.current?.isFocused()) setSuggestionsOpen(true);
          onChange?.(text);
        }}
        placeholder={placeholder}
        multiline={multiline}
        maxLength={maxLength}
        onFocus={() => { if (!disabled) { setSuggestionsOpen(true); onFocusChange(true); } }}
        onBlur={event => {
          if (focusMovingInto(suggestionsRef.current, event)) return;
          setSuggestionsOpen(false);
          onFocusChange(false);
          if (!disabled) onInteractionEnd();
        }}
        onKeyPress={event => {
          if (isComposingKey(event)) return;
          const key = event.nativeEvent;
          if (Platform.OS === "web" && key.key === "ArrowDown" && showList &&
            (!multiline || ("altKey" in key && key.altKey))) {
            event.preventDefault();
            focusFirstControl(suggestionsRef.current);
          }
        }}
        {...(Platform.OS === "web" ? {
          onKeyUp: (event: ControlKeyEvent) => {
            if (isComposingKey(event) || keyboardKey(event) !== "Escape" || !showList) return;
            event.stopPropagation();
            closeSuggestions("keyboard");
          },
        } : {})}
      />
      {showList && !disabled && <AnchoredOptionList
        visible
        anchorRef={anchorRef}
        surfaceRef={suggestionsRef}
        maxHeight={160}
        className="rounded-lg border border-border bg-surface shadow-lg"
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} suggestions` : "Suggestions"}
        data={filteredOptions}
        keyExtractor={option => option}
        onClose={closeSuggestions}
        renderItem={({ item: option }) => (
          <OptionRow
            onPress={() => {
              if (disabled) return;
              onInteractionEnd();
              onChange?.(option);
              closeSuggestions("selection");
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
