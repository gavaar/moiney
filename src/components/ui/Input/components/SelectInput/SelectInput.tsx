import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cn } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { OptionList, OptionRow } from "@ui/OptionList";
import { TreeList, useTreeCollapse, type TreeItemState, type TreeNode } from "@ui/TreeList";
import type { InputInteraction, InputTriggerProps, InputValueProps } from "../../input.types";

type CommonSelectInputProps<Item extends { id: string }> = {
  accessibilityLabel?: string;
  items: readonly Item[];
  tree?: readonly TreeNode[];
  renderItem: (item: Item, state?: TreeItemState) => ReactNode;
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

export function SelectInput<Item extends { id: string }>({ accessibilityLabel, items, tree, renderItem, itemStyle, value, disabled, placeholder, multiple, onChange, loading = false, onFocusChange, onInteractionEnd, triggerClassName }: Props<Item>) {
  const [open, setOpen] = useState(false);
  const collapse = useTreeCollapse();
  const inputLabel = accessibilityLabel;
  const interactionDisabled = disabled || loading;

  const selectedItem = !multiple && value
    ? items.find((item) => item.id === value) ?? null
    : null;

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
        {tree
          ? <TreeList
            items={items}
            tree={tree}
            renderItem={renderItem}
            itemStyle={itemStyle}
            mode={multiple ? "multiple" : "single"}
            selectedIds={multiple ? value : value ? [value] : []}
            disabled={interactionDisabled}
            accessibilityLabel={inputLabel}
            onPress={item => handleItemPress(item.id)}
            collapse={collapse}
          />
          : <OptionList
              accessibilityLabel={inputLabel}
              data={items}
              extraData={{ value, disabled, loading }}
              keyExtractor={item => item.id}
              ListEmptyComponent={<Text className="text-center text-sm text-muted py-4">No options</Text>}
              renderItem={({ item }) => renderOption(item)}
            />}
      </ModalShell>
    </>
  );
}
