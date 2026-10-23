import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { OptionList, OptionRow } from "@ui/OptionList";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../../input.types";

export type SelectGroup = {
  id: string;
  name: string;
  icon?: string;
  itemIds: readonly string[];
  initiallyExpanded?: boolean;
};

type CommonSelectInputProps = {
  accessibilityLabel?: string;
  items: readonly ({ id: string } & Record<string, any>)[];
  groups?: readonly SelectGroup[];
  renderItem: (item: CommonSelectInputProps["items"][number]) => React.ReactNode;
  itemStyle?: (item: CommonSelectInputProps["items"][number]) => StyleProp<ViewStyle>;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
};

export type SelectInputProps = CommonSelectInputProps & InputValueProps<string | null, string>;
export type SelectMultipleInputProps = CommonSelectInputProps & InputValueProps<readonly string[], string[]>;

type Props = InputInteraction & InputTriggerProps & (
  | (SelectInputProps & { multiple?: false })
  | (SelectMultipleInputProps & { multiple: true })
);

export function SelectInput({ accessibilityLabel, items, groups, renderItem, itemStyle, value, disabled, placeholder, multiple, onChange, loading = false, onFocusChange, onInteractionEnd, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const inputLabel = accessibilityLabel;

  const selectedItem = !multiple && value
    ? items.find((item) => item.id === value) ?? null
    : null;
  const groupedIds = new Set(groups?.flatMap(group => group.itemIds) ?? []);
  const itemsById = new Map(items.map(item => [item.id, item]));
  const rows: ({ key: string; kind: "option"; item: (typeof items)[number]; grouped?: boolean } | { key: string; kind: "group"; group: SelectGroup })[] = [
    ...items.filter(item => !groupedIds.has(item.id)).map(item => ({ key: `item:${item.id}`, kind: "option" as const, item })),
    ...(groups ?? []).flatMap(group => {
      const members = group.itemIds.flatMap(id => {
        const item = itemsById.get(id);
        return item ? [item] : [];
      });
      if (members.length === 0) return [];
      return [
        { key: `group:${group.id}`, kind: "group" as const, group },
        ...((expandedOverrides[group.id] ?? group.initiallyExpanded ?? false)
          ? members.map(item => ({ key: `item:${item.id}`, kind: "option" as const, item, grouped: true })) : []),
      ];
    }),
  ];

  const handleTriggerPress = () => {
    if (disabled || loading) return;
    setOpen(true);
    onFocusChange(true);
  };

  const handleItemPress = (id: string) => {
    if (disabled || loading) return;
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
      disabled={disabled || loading}
      onPress={() => handleItemPress(item.id)}
      style={itemStyle?.(item)}
    >{renderItem(item)}</OptionRow>;
  }

  function renderRow(row: (typeof rows)[number]) {
    if (row.kind === "option") return row.grouped
      ? <View className="pl-2">{renderOption(row.item)}</View>
      : renderOption(row.item);
    const { group } = row;
    const expanded = expandedOverrides[group.id] ?? group.initiallyExpanded ?? false;
    return <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.name}`}
      accessibilityState={{ expanded, disabled }} aria-expanded={expanded} disabled={disabled || loading}
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
        accessibilityState={{ disabled: disabled || loading, expanded: open }}
        disabled={disabled || loading}
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
