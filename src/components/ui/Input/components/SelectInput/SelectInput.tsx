import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { InputError, useInputValidation } from "../../useInputValidation";

export type SelectGroup = {
  id: string;
  name: string;
  icon?: string;
  itemIds: readonly string[];
  initiallyExpanded?: boolean;
};

type CommonSelectInputProps = {
  label: string;
  hideLabel?: boolean;
  items: readonly ({ id: string } & Record<string, any>)[];
  groups?: readonly SelectGroup[];
  renderItem: (item: CommonSelectInputProps["items"][number]) => React.ReactNode;
  itemStyle?: (item: CommonSelectInputProps["items"][number]) => StyleProp<ViewStyle>;
  disabled?: boolean;
  placeholder?: string;
  onError?: (error?: string) => void;
  presentation?: "modal" | "inline";
  loading?: boolean;
};

export type SelectInputProps = CommonSelectInputProps &
  (
    | {
        multiple?: false;
        value: string | null;
        onChange?: (id: string) => void;
        validator?: (value: string | null) => string | undefined;
      }
    | {
        multiple: true;
        value: readonly string[];
        onChange?: (ids: string[]) => void;
        validator?: (value: readonly string[]) => string | undefined;
      }
  );

export function SelectInput({ label, hideLabel, items, groups, renderItem, itemStyle, value, disabled, placeholder, validator, multiple, onChange, onError, presentation = "modal", loading = false }: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const [modalContentHeight, setModalContentHeight] = useState<number | null>(null);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const validateValue = useCallback((next: string | null | readonly string[]) => {
    if (multiple) return typeof next !== "string" && next !== null ? validator?.(next) : undefined;
    return typeof next === "string" || next === null ? validator?.(next) : undefined;
  }, [multiple, validator]);
  const { error, markAsDirty } = useInputValidation(value, validateValue, onError);

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
  };

  const handleItemPress = (id: string) => {
    if (disabled || loading) return;
    if (multiple) {
      const next = value.includes(id)
          ? value.filter((selectedId) => selectedId !== id)
          : [...value, id];
      onChange?.(next);
      if (presentation === "inline") markAsDirty();
    } else {
      markAsDirty();
      onChange?.(id);
      setOpen(false);
    }
  };

  function renderOption(item: (typeof items)[number], inline: boolean) {
    const checked = multiple ? value.includes(item.id) : value === item.id;
    return <Pressable
      accessibilityRole={multiple ? "checkbox" : inline ? "radio" : "button"}
      accessibilityState={inline ? { checked, disabled } : multiple ? { checked } : undefined}
      aria-checked={inline || multiple ? checked : undefined}
      disabled={disabled || loading}
      onPress={() => handleItemPress(item.id)}
      className={inline ? "rounded-xl border border-muted/30 px-2 py-2" : "px-2 py-2 border-b border-border/30 last:border-b-0 active:opacity-70"}
      style={[itemStyle?.(item), checked
        ? { backgroundColor: `${colors.muted}1A`, ...(inline ? {} : { borderRadius: 8 }) }
        : inline ? { backgroundColor: "transparent" } : undefined]}
    >{renderItem(item)}</Pressable>;
  }

  function renderRow(row: (typeof rows)[number], inline: boolean) {
    if (row.kind === "option") return row.grouped
      ? <View className="pl-2">{renderOption(row.item, inline)}</View>
      : renderOption(row.item, inline);
    const { group } = row;
    const expanded = expandedOverrides[group.id] ?? group.initiallyExpanded ?? false;
    return <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.name}`}
      accessibilityState={{ expanded, disabled }} aria-expanded={expanded} disabled={disabled || loading}
      onPress={() => setExpandedOverrides(previous => ({ ...previous, [group.id]: !expanded }))}
      className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5">
      {group.icon ? <Icon name={safeIconName(group.icon)} size={16} color={colors.muted} /> : null}
      <Text className="text-text font-semibold flex-1" numberOfLines={1}>{group.name}</Text>
      <Text className="text-muted text-xs">{group.itemIds.length}</Text>
      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
    </Pressable>;
  }

  if (presentation === "inline") {
    return (
      <View className={cn("gap-1", disabled && "opacity-60")} style={{ flexShrink: 1 }}>
        {!hideLabel ? <Text className="text-sm font-medium text-text">{label}</Text> : null}
        {loading ? <ActivityIndicator accessibilityLabel={`Loading ${label}`} /> : (
          <FlatList
            data={rows}
            extraData={{ value, disabled }}
            keyExtractor={row => row.key}
            style={{ maxHeight: 320, flexShrink: 1 }}
            contentContainerStyle={{ gap: 4 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            ListEmptyComponent={<Text className="py-4 text-center text-muted">No options</Text>}
            renderItem={({ item }) => renderRow(item, true)}
          />
        )}
        <InputError error={error} />
      </View>
    );
  }

  return (
    <View className={cn("gap-1", disabled && "opacity-60")}>
      {!hideLabel ? <Text className="text-sm font-medium text-text">{label}</Text> : null}
      <Pressable
        testID="select-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled || loading}
        aria-expanded={open}
        onPress={handleTriggerPress}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2 flex-row items-center gap-2",
          error !== undefined ? "border-error" : "border-border",
        )}
      >
        {multiple && value.length > 0 ? (
          <Text className="text-base text-text">{value.length} selected</Text>
        ) : selectedItem ? (
          <View className="flex-1">{renderItem(selectedItem)}</View>
        ) : (
          <Text className="text-base text-muted">{placeholder ?? "Select..."}</Text>
        )}
      </Pressable>
      <InputError error={error} />

      <ModalShell visible={open} onClose={() => {
        if (multiple && !disabled) markAsDirty();
        setOpen(false);
      }}>
        <ScrollView className="max-h-64" style={{ flexShrink: 1, height: modalContentHeight && modalContentHeight > 0 ? Math.min(modalContentHeight, 256) : undefined }}
          onContentSizeChange={(_, height) => setModalContentHeight(height)}>
          {items.length === 0 ? (
            <Text className="text-center text-sm text-muted py-4">No options</Text>
          ) : (
            rows.map((row) => <View key={row.key}>{renderRow(row, false)}</View>)
          )}
        </ScrollView>
      </ModalShell>
    </View>
  );
}
