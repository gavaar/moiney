import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, CURATED_ICONS, type IconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { OptionList } from "@ui/OptionList";
import { choiceKeyboardProps, editorKeyboardProps } from "@ui/keyboard/choiceKeyboard";
import { INPUT_CONTENT_ICON_SIZE, INPUT_CONTENT_LINE_BOX, INPUT_CONTENT_TEXT, INPUT_EDITOR_FOCUS } from "../../input.config";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";

export type IconInputProps = InputValueProps<IconName | "", IconName>;

type Props = IconInputProps & InputInteraction & InputTriggerProps;

const ICON_COLUMNS = 4;

function filterIcons(search: string, icons: readonly { name: IconName }[]) {
  return search
    ? icons.filter((icon) =>
        icon.name.toLowerCase().includes(search.toLowerCase()),
      )
    : icons;
}

export function IconInput({ accessibilityLabel, value, onChange, disabled, onFocusChange, onInteractionEnd, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = filterIcons(search, CURATED_ICONS);
  const emptySlots = Array.from({ length: (ICON_COLUMNS - filtered.length % ICON_COLUMNS) % ICON_COLUMNS }, () => null);
  const grid = [...filtered, ...emptySlots];

  return (
    <>
      <Pressable
        testID="icon-picker-trigger"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, expanded: open }}
        aria-expanded={open}
        onPress={() => { if (!disabled) { setOpen(true); onFocusChange(true); } }}
        disabled={disabled}
        className={cn(triggerClassName, "flex-row items-center justify-center")}
      >
        <View className={cn(INPUT_CONTENT_LINE_BOX, "items-center justify-center")}>
          {value ? (
            <Icon name={value} size={INPUT_CONTENT_ICON_SIZE} color={colors.text} />
          ) : (
            <Text className={cn(INPUT_CONTENT_TEXT, "text-muted")}>---</Text>
          )}
        </View>
      </Pressable>

      <ModalShell
        visible={open}
        onClose={() => { setOpen(false); onFocusChange(false); }}
      >
        <View className="gap-2" style={{ flexShrink: 1 }}>
          <View {...editorKeyboardProps} className="input-surface rounded-lg border border-border bg-surface">
            <TextInput
              accessibilityLabel="Search icons"
              placeholder="Search icons..."
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              className={cn("px-3 py-2 text-text", INPUT_CONTENT_TEXT, INPUT_EDITOR_FOCUS)}
            />
          </View>
          <OptionList
            accessibilityRole="radiogroup"
            accessibilityLabel="Icons"
            numColumns={ICON_COLUMNS}
            data={grid}
            keyExtractor={(icon, index) => icon?.name ?? `empty-${index}`}
            extraData={{ value, disabled, onChange }}
            ListEmptyComponent={<Text className="text-center text-sm text-muted py-4">
              No icons found
            </Text>}
            renderItem={({ item: icon }) => {
              if (!icon) return <View className="flex-1" aria-hidden />;
              const selected = value === icon.name;
              return (
                <Pressable
                  {...choiceKeyboardProps}
                  accessibilityRole="radio"
                  accessibilityLabel={icon.name}
                  accessibilityState={{ checked: selected, disabled: disabled || !onChange }}
                  aria-checked={selected}
                  disabled={disabled || !onChange}
                  onPress={() => {
                    if (disabled || !onChange) return;
                    onInteractionEnd();
                    onChange(icon.name);
                    setOpen(false);
                    onFocusChange(false);
                    setSearch("");
                  }}
                  className={cn("flex-1 min-w-0 items-center gap-1 py-2 px-1 rounded-lg", selected && "bg-primary/10")}
                >
                  <Icon
                    name={icon.name}
                    size={20}
                    color={selected ? colors.primary : colors.text}
                  />
                  <Text
                    className="self-stretch text-[10px] text-muted text-center"
                    numberOfLines={1}
                  >
                    {icon.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </ModalShell>
    </>
  );
}
