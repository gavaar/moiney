import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { OptionList, OptionRow } from "@ui/OptionList";
import { TreeBranch } from "@ui/TreeBranch";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";
import { buildSelectRows, type SelectGroup } from "./selectRows";

export type { SelectGroup } from "./selectRows";

type CommonSelectInputProps<Item extends { id: string }> = {
  accessibilityLabel?: string;
  items: readonly Item[];
  groups?: readonly SelectGroup[];
  renderItem: (item: Item) => ReactNode;
  itemStyle?: (item: Item) => StyleProp<ViewStyle>;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
};

export type SelectInputProps<Item extends { id: string } = { id: string }> = CommonSelectInputProps<Item> & InputValueProps<string | null, string>;
export type SelectMultipleInputProps<Item extends { id: string } = { id: string }> = CommonSelectInputProps<Item> & InputValueProps<readonly string[], string[]>;

type Props<Item extends { id: string }> = InputInteraction & InputTriggerProps & (
  | (SelectInputProps<Item> & { multiple?: false })
  | (SelectMultipleInputProps<Item> & { multiple: true })
);

export function SelectInput<Item extends { id: string }>({ accessibilityLabel, items, groups, renderItem, itemStyle, value, disabled, placeholder, multiple, onChange, loading = false, onFocusChange, onInteractionEnd, triggerClassName }: Props<Item>) {
  const [open, setOpen] = useState(false);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const inputLabel = accessibilityLabel;
  const interactionDisabled = disabled || loading;

  const selectedItem = !multiple && value
    ? items.find((item) => item.id === value) ?? null
    : null;
  const rows = buildSelectRows(items, groups, expandedOverrides);

  const handleTriggerPress = () => {
    if (interactionDisabled) return;
    setOpen(true);
    onFocusChange(true);
  };

  const handleItemPress = (id: string) => {
    if (interactionDisabled) return;
    if (multiple) {
      const next = value.includes(id)
        ? value.filter((selectedId) => selectedId !== id)
        : [...value, id];
      onChange?.(next);
    } else {
      onInteractionEnd();
      onChange?.(id);
      setOpen(false);
      onFocusChange(false);
    }
  };

  function renderOption(item: (typeof items)[number]) {
    const checked = multiple ? value.includes(item.id) : value === item.id;
    return <OptionRow
      multiple={multiple}
      selected={checked}
      disabled={interactionDisabled}
      onPress={() => handleItemPress(item.id)}
      style={itemStyle?.(item)}
    >{renderItem(item)}</OptionRow>;
  }

  function renderRow(row: (typeof rows)[number]) {
    if (row.kind === "option") return row.branch
      ? <View className="flex-row items-center">
          <TreeBranch path={row.branch} />
          <View className="flex-1">
            {renderOption(row.item)}
          </View>
        </View>
      : renderOption(row.item);
    const { group } = row;
    const expanded = expandedOverrides[group.id] ?? group.initiallyExpanded ?? false;
    return <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.name}`}
      accessibilityState={{ expanded, disabled: interactionDisabled }} aria-expanded={expanded} disabled={interactionDisabled}
      onPress={() => setExpandedOverrides(previous => ({ ...previous, [group.id]: !expanded }))}
      className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-2">
      {group.icon ? <Icon name={safeIconName(group.icon)} size={16} color={colors.muted} /> : null}
      <Text className="text-text font-semibold flex-1" numberOfLines={1}>{group.name}</Text>
      <Text className="text-muted text-xs">{group.itemIds.length}</Text>
      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
    </Pressable>;
  }

  return (
    <>
      <Pressable
        testID="select-trigger"
        accessibilityRole="button"
        accessibilityLabel={inputLabel}
        accessibilityState={{ disabled: interactionDisabled, expanded: open }}
        disabled={interactionDisabled}
        aria-expanded={open}
        onPress={handleTriggerPress}
        className={cn(triggerClassName, "flex-row items-center gap-2")}
      >
        {loading ? <ActivityIndicator accessibilityLabel={`Loading ${inputLabel ?? "options"}`} /> : multiple && value.length > 0 ? (
          <Text className="text-base text-text">{value.length} selected</Text>
        ) : selectedItem ? (
          <View className="flex-1">{renderItem(selectedItem)}</View>
        ) : (
          <Text className="text-base text-muted">{placeholder ?? "Select..."}</Text>
        )}
      </Pressable>

      <ModalShell visible={open} onClose={() => {
        if (multiple && !disabled) onInteractionEnd();
        setOpen(false);
        onFocusChange(false);
      }}>
        <OptionList
          accessibilityLabel={inputLabel}
          data={rows}
          extraData={{ value, disabled, loading }}
          keyExtractor={row => row.key}
          ListEmptyComponent={<Text className="text-center text-sm text-muted py-4">No options</Text>}
          renderItem={({ item }) => renderRow(item)} />
      </ModalShell>
    </>
  );
}
