import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, CURATED_ICONS, type IconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";

export type IconInputProps = InputValueProps<IconName | "", IconName>;

type Props = IconInputProps & InputInteraction & InputTriggerProps;

function filterIcons(search: string, icons: { name: string }[]) {
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
        className={cn(triggerClassName, "flex-row items-center gap-2 justify-center")}
      >
        {value ? (
          <Icon name={value} size={16} color={colors.text} />
        ) : (
          <Text className="text-base text-muted">---</Text>
        )}
      </Pressable>

      <ModalShell
        visible={open}
        onClose={() => { setOpen(false); onFocusChange(false); }}
      >
        <TextInput
          accessibilityLabel="Search icons"
          placeholder="Search icons..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-base text-text mb-3"
        />
        {filtered.length === 0 ? (
          <Text className="text-center text-sm text-muted mt-4">
            No icons found
          </Text>
        ) : (
          <ScrollView accessibilityRole="radiogroup" accessibilityLabel="Icons" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap" }}>
            {filtered.map((icon) => {
              const selected = value === icon.name;
              return (
                <View key={icon.name} className="w-1/4 p-1 items-center">
                  <Pressable
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
                    className={cn("items-center py-2 px-1 rounded-lg", selected && "bg-primary/10")}
                  >
                    <Icon
                      name={icon.name}
                      size={24}
                      color={selected ? colors.primary : colors.text}
                    />
                    <Text
                      className="text-[10px] text-muted text-center mt-1"
                      numberOfLines={1}
                    >
                      {icon.name}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
      </ModalShell>
    </>
  );
}
