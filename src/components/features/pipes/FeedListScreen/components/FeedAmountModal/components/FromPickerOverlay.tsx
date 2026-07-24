import { ScrollView, Text } from "react-native";
import { type Id, type Doc } from "@convex/_generated/dataModel";
import { ModalShell } from "@ui/Modal";
import { PipeTreeItem } from "./PipeTreeItem";

type Props = {
  open: boolean;
  roots: Doc<"pipes">[];
  pipeId: Id<"pipes">;
  fromFeedId: string | null;
  childrenByParent: Map<Id<"pipes">, Doc<"pipes">[]>;
  expandedIds: Set<Id<"pipes">>;
  onSelect: (id: Id<"pipes">) => void;
  onToggle: (id: Id<"pipes">) => void;
  onClose: () => void;
};

export function FromPickerOverlay({
  open,
  roots,
  pipeId,
  fromFeedId,
  childrenByParent,
  expandedIds,
  onSelect,
  onToggle,
  onClose,
}: Props) {
  return (
    <ModalShell visible={open} onClose={onClose}>
      <ScrollView className="max-h-64">
        {roots.length === 0 ? (
          <Text className="text-center text-sm text-muted py-4">
            No pipes available
          </Text>
        ) : (
          roots.map((feed) => (
            <PipeTreeItem
              key={feed._id}
              feed={feed}
              depth={0}
              pipeId={pipeId}
              fromFeedId={fromFeedId}
              childrenByParent={childrenByParent}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onPickerClose={onClose}
            />
          ))
        )}
      </ScrollView>
    </ModalShell>
  );
}
