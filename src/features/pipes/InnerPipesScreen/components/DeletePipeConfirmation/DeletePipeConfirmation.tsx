import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { type Id, type Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ModalShell } from "@/components/ui/Modal";
import { colors } from "@/lib/styles";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  pipeId: Id<"pipes">;
  onConfirm: (result: { pipeIds: Id<"pipes">[]; deleteTransactions: boolean }) => void;
};

type DescendantNode = {
  id: Id<"pipes">;
  name: string;
  icon: string;
  depth: number;
};

function collectDescendants(
  pipeId: Id<"pipes">,
  childrenByParent: Map<Id<"pipes">, Doc<"pipes">[]>,
  depth = 1,
): DescendantNode[] {
  const result: DescendantNode[] = [];
  const children = childrenByParent.get(pipeId) ?? [];
  for (const child of children) {
    result.push({ id: child._id, name: child.name, icon: child.icon, depth });
    result.push(...collectDescendants(child._id, childrenByParent, depth + 1));
  }
  return result;
}

export function DeletePipeConfirmation({ visible, onClose, pipeId, onConfirm }: Props) {
  const { pipesById, childrenByParent } = usePipeSelection();
  const [isEnabled, setIsEnabled] = useState(false);
  const [deleteTransactions, setDeleteTransactions] = useState(false);

  useEffect(() => {
    setIsEnabled(false);
    const timer = setTimeout(() => setIsEnabled(true), 2000);
    return () => clearTimeout(timer);
  }, [visible, pipeId]);

  useEffect(() => {
    setDeleteTransactions(false);
  }, [visible]);

  const pipe = pipeId ? pipesById?.[pipeId] ?? null : null;

  const descendants = useMemo(
    () => collectDescendants(pipeId, childrenByParent),
    [pipeId, childrenByParent],
  );

  const allPipeIds = [pipeId, ...descendants.map((d) => d.id)];

  const handleConfirm = () => {
    onConfirm({ pipeIds: allPipeIds, deleteTransactions });
  };

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View className="gap-4 min-w-[300px]">
        <View className="flex-row items-center gap-2">
          {pipe && <Icon name={pipe.icon as IconName} size={24} color={colors.text} />}
          <Text className="text-text font-bold text-lg">{pipe?.name ?? "Unknown"}</Text>
        </View>

        <Text className="text-text text-sm">This will delete the following pipes:</Text>

        <ScrollView className="max-h-48">
          {pipe && (
            <View className="flex-row items-center gap-2 py-1">
              <View style={{ width: 0 }} />
              <Icon name={pipe.icon as IconName} size={16} color={colors.text} />
              <Text className="text-text text-sm font-medium">{pipe.name}</Text>
              <Text className="text-muted text-xs">(selected)</Text>
            </View>
          )}
          {descendants.map((d) => (
            <View key={d.id} className="flex-row items-center gap-2 py-1">
              <View style={{ width: d.depth * 16 }} />
              <Icon name={d.icon as IconName} size={14} color={colors.muted} />
              <Text className="text-text text-sm">{d.name}</Text>
            </View>
          ))}
        </ScrollView>

        <View className="bg-error/10 border border-error rounded-lg p-3">
          <Text className="text-error text-sm">
            Warning: You are about to delete this pipe and all its child pipes. This action cannot be undone.
          </Text>
        </View>

        <Input
          type="checkbox"
          label="Also delete pipe's transactions"
          checked={deleteTransactions}
          onChange={setDeleteTransactions}
        />

        <Button
          variant="error"
          title="Confirm deletion"
          disabled={!isEnabled}
          onPress={handleConfirm}
        />
      </View>
    </ModalShell>
  );
}
