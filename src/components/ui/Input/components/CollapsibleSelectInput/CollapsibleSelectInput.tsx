import { useRef, useState } from "react";
import { Keyboard, Pressable, Text, View, type ViewInstance } from "react-native";
import { colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { OptionList, OptionRow, OverlaidOptionList, useOptionListActive } from "@ui/OptionList";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";
import { SelectGroupHeader } from "./components/SelectGroupHeader/SelectGroupHeader";

export type CollapsibleSelectGroup = {
  id: string;
  title: string;
  itemIds: readonly string[];
  info?: string;
};

type CollapsibleSelectItem = {
  id: string;
  icon?: string;
  title: string;
  description?: string;
};

export type CollapsibleSelectInputProps = InputValueProps<string | null, string> & {
  items: readonly CollapsibleSelectItem[];
  isItemDisabled?: (item: CollapsibleSelectItem) => boolean;
  groups?: readonly CollapsibleSelectGroup[];
  placeholder?: string;
  initiallyExpanded?: boolean;
};

type Row = { id: string; kind: "group"; group: CollapsibleSelectGroup } | { id: string; kind: "option"; item: CollapsibleSelectItem };

export function CollapsibleSelectInput({
  value,
  onChange,
  disabled,
  accessibilityLabel,
  items,
  isItemDisabled,
  groups,
  placeholder,
  initiallyExpanded = false,
  onFocusChange,
  onInteractionEnd,
  triggerClassName,
}: CollapsibleSelectInputProps & InputInteraction & InputTriggerProps) {
  const anchorRef = useRef<ViewInstance>(null);
  const active = useOptionListActive();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const selected = items.find(item => item.id === value);
  const selectedLabel = selected?.title ?? "No selection";
  const open = expanded && !disabled && active;
  const rows: Row[] = groups?.length ? groups.flatMap(group => [
    { id: `group:${group.id}`, kind: "group" as const, group },
    ...items.filter(item => group.itemIds.includes(item.id)).map(item => ({ id: item.id, kind: "option" as const, item })),
  ]) : items.map(item => ({ id: item.id, kind: "option", item }));

  function collapse() {
    setExpanded(false);
    onFocusChange(false);
    onInteractionEnd();
  }

  return <>
    <View ref={anchorRef} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: selectedLabel }} aria-valuetext={selectedLabel}
        accessibilityState={{ disabled, expanded: open }} aria-expanded={open} disabled={disabled}
        className={`${triggerClassName} flex-row items-center gap-2`} onPress={() => {
          Keyboard.dismiss(); setExpanded(true); onFocusChange(true);
        }}>
        <View className="flex-1">
          {selected
            ? <View className="flex-row items-center gap-2">
                {selected.icon && <Icon name={safeIconName(selected.icon)} size={20} color={colors.muted} />}
                <Text className="text-text text-md font-bold flex-1">{selected.title}</Text>
              </View>
            : <Text className="text-muted">
                {placeholder ?? "Select an option"}
              </Text>}
        </View>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
    </View>

    {open &&
      <OverlaidOptionList
        anchorRef={anchorRef}
        onOutsidePress={collapse}
        onRequestClose={() => {
          collapse(); return true;
        }}
      >
        <Text className="text-text font-semibold px-2">
          {accessibilityLabel}
        </Text>

        <OptionList
          data={rows}
          keyExtractor={row => row.id}
          accessibilityLabel={`${accessibilityLabel ?? "Select"} options`}
          renderItem={
            ({ item: row }) => row.kind === "group"
              ? <SelectGroupHeader title={row.group.title} info={row.group.info} />
              : <OptionRow
                  variant="card"
                  selected={value === row.item.id}
                   accessibilityLabel={row.item.title}
                  disabled={disabled || isItemDisabled?.(row.item)}
                  className="p-1 my-1 border-secondary/20"
                  style={isItemDisabled?.(row.item) ? { opacity: 0.4 } : undefined}
                  onPress={() => {
                    if (disabled || isItemDisabled?.(row.item)) return;
                    onChange?.(row.item.id);
                    collapse();
                  }}
                >
                   <View className="gap-1 px-2">
                     <Text className="text-text text-md font-bold">{row.item.title}</Text>
                     {(row.item.icon || row.item.description) && <View className="flex-row gap-2">
                       {row.item.icon && <Icon name={safeIconName(row.item.icon)} size={20} color={colors.muted} />}
                       {row.item.description && <Text className="text-muted text-sm flex-1">{row.item.description}</Text>}
                     </View>}
                   </View>
                </OptionRow>
            }
        />
      </OverlaidOptionList>
    }
  </>;
}
