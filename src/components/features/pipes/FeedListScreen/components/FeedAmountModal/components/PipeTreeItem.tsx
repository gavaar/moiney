import { Pressable, Text, View } from "react-native";
import { type Id, type Doc } from "@convex/_generated/dataModel";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";

type Props = {
  feed: Doc<"pipes">;
  depth: number;
  pipeId: Id<"pipes">;
  fromFeedId: string | null;
  childrenByParent: Map<Id<"pipes">, Doc<"pipes">[]>;
  expandedIds: Set<Id<"pipes">>;
  onSelect: (id: Id<"pipes">) => void;
  onToggle: (id: Id<"pipes">) => void;
  onPickerClose: () => void;
};

export function PipeTreeItem({
  feed,
  depth,
  pipeId,
  fromFeedId,
  childrenByParent,
  expandedIds,
  onSelect,
  onToggle,
  onPickerClose,
}: Props) {
  if (feed._id === pipeId) return null;

  const children = childrenByParent.get(feed._id) ?? [];
  const isLeaf = children.length === 0;
  const isSelected = fromFeedId === feed._id;
  const isExpanded = expandedIds.has(feed._id);

  return (
    <View>
      <Pressable
        onPress={() => {
          if (isLeaf) {
            onSelect(feed._id);
            onPickerClose();
          } else {
            onToggle(feed._id);
          }
        }}
        className="flex-row items-center gap-2 py-2"
        style={{ paddingLeft: depth * 20 }}
      >
        <Icon
          name={feed.icon as IconName}
          size={14}
          color={isLeaf ? colors.text : colors.muted}
        />
        <Text
          className={`text-sm ${isLeaf ? "text-text" : "text-muted"} ${isSelected ? "font-medium" : ""}`}
        >
          {feed.name}
        </Text>
        {!isLeaf && (
          <Text className="text-muted text-xs ml-auto">
            {isExpanded ? "\u25b2" : "\u25bc"}
          </Text>
        )}
      </Pressable>
      {isExpanded &&
        children.map((child) => (
          <PipeTreeItem
            key={child._id}
            feed={child}
            depth={depth + 1}
            pipeId={pipeId}
            fromFeedId={fromFeedId}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={onToggle}
            onPickerClose={onPickerClose}
          />
        ))}
    </View>
  );
}