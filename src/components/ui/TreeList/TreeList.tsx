import { useEffect, useId, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { OptionList, OptionRow } from "@ui/OptionList";
import { TreeBranch } from "@ui/TreeBranch";
import { treeRows, type TreeItemState, type TreeNode } from "./tree-list";
import { useTreeCollapse, type TreeCollapse } from "./use-tree-collapse";

type Props<Item extends { id: string }> = {
  items: readonly Item[];
  tree: readonly TreeNode[];
  renderItem: (item: Item, state: TreeItemState) => ReactNode;
  itemStyle?: (item: Item) => StyleProp<ViewStyle>;
  mode?: "single" | "multiple" | "browse";
  selectedIds?: readonly string[];
  onPress?: (item: Item) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  itemAccessibilityLabel?: (item: Item) => string;
  collapse?: TreeCollapse;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
};

function DisclosureChevron({ expanded }: { expanded: boolean }) {
  const [rotation] = useState(() => new Animated.Value(expanded ? 0 : 1));
  useEffect(() => {
    const animation = Animated.timing(rotation, { toValue: expanded ? 0 : 1, duration: 180, useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [expanded, rotation]);
  return <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
    <Icon name="chevron-up" size={16} color={colors.muted} />
  </Animated.View>;
}

/** One virtualized hierarchy for pickers, navigation, and read-only previews. */
export function TreeList<Item extends { id: string }>({ items, tree, renderItem, itemStyle, mode = "browse", selectedIds = [], onPress, disabled, accessibilityLabel, itemAccessibilityLabel, collapse, ListHeaderComponent, ListFooterComponent }: Props<Item>) {
  const localCollapse = useTreeCollapse();
  const listId = useId();
  const { ids: collapsed, onToggle: toggle } = collapse ?? localCollapse;
  const selected = new Set(selectedIds);
  const rows = treeRows(items, tree, collapsed, selected);
  return <OptionList
    accessibilityLabel={accessibilityLabel}
    data={rows}
    extraData={{ collapsed, selectedIds, disabled }}
    keyExtractor={row => row.item.id}
    ListHeaderComponent={ListHeaderComponent} ListFooterComponent={ListFooterComponent}
    ListEmptyComponent={<Text className="text-center text-sm text-muted py-4">No options</Text>}
    renderItem={({ item: row }) => {
      const { item, node, branch, hasChildren, selectedInside } = row;
      const expanded = !collapsed.has(node.id);
      const structural = mode !== "browse" && !node.selectable;
      const state = { root: branch.length === 0, muted: structural, selected: node.selectable && selected.has(node.id), multiple: mode === "multiple" };
      const disclosureLabel = `${expanded ? "Collapse" : "Expand"} ${node.label}`;
      const disclosure = hasChildren ? <DisclosureChevron expanded={expanded} /> : null;
      const countLabel = !expanded && selectedInside > 0 ? `${selectedInside} selected inside` : undefined;
      const countId = `${listId}-${node.id}-selection-count`;
      const count = countLabel && <Text className="self-center text-muted text-xs" nativeID={countId} accessibilityLabel={countLabel}>{selectedInside} selected</Text>;

      return <View className="min-h-6 flex-row items-center">
        <TreeBranch path={branch} expanded={hasChildren && expanded} />
        {structural
          ? <Pressable className="flex-1 self-stretch flex-row items-center gap-2 px-2" disabled={disabled}
              accessibilityRole="button" accessibilityLabel={disclosureLabel}
              accessibilityHint={countLabel} aria-describedby={countLabel ? countId : undefined}
              accessibilityState={{ expanded, disabled }} aria-expanded={expanded} onPress={() => toggle(node.id)}
            >
              <View className="flex-1">
                {renderItem(item, state)}
              </View>
              {count}
              {disclosure}
            </Pressable>
          : <>
          <View className="flex-1 self-stretch">
            {onPress
              ? <OptionRow
                  className="flex-1 justify-center px-2"
                  selected={state.selected}
                  multiple={mode === "multiple"}
                  selectionAppearance={mode === "multiple" ? "content" : "neutral"}
                  disabled={disabled}
                  accessibilityLabel={itemAccessibilityLabel?.(item) ?? node.label}
                  style={itemStyle?.(item)}
                  onPress={() => onPress(item)}
                >
                  {renderItem(item, state)}
                </OptionRow>
              : <View className="flex-1 justify-center px-2">{renderItem(item, state)}</View>}
          </View>
          {count}
          {hasChildren &&
            <Pressable
              className="min-w-8 self-stretch items-center justify-center px-3"
              accessibilityRole="button"
              accessibilityLabel={disclosureLabel}
              accessibilityHint={countLabel}
              aria-describedby={countLabel ? countId : undefined}
              accessibilityState={{ expanded, disabled }} aria-expanded={expanded} disabled={disabled}
              onPress={() => toggle(node.id)}
            >
              {disclosure}
            </Pressable>}
        </>}
      </View>;
    }} />;
}
