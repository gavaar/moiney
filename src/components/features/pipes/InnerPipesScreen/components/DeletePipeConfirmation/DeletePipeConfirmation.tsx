import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type {
  PipeModel,
} from "@features/pipes/data/pipes";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { Icon, type IconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useOptionalTransactionCache } from "@features/transactions/cache/TransactionCacheContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  pipeId: PipeModel["id"];
  onDeleted: () => void;
};

type DescendantNode = {
  id: PipeModel["id"];
  name: string;
  icon: string;
  depth: number;
};

function collectDescendants(
  pipeId: PipeModel["id"],
  childrenByParent: Map<PipeModel["id"], PipeModel[]>,
  depth = 1,
): DescendantNode[] {
  const result: DescendantNode[] = [];
  const children = childrenByParent.get(pipeId) ?? [];
  for (const child of children) {
    result.push({ id: child.id, name: child.name, icon: child.icon, depth });
    result.push(...collectDescendants(child.id, childrenByParent, depth + 1));
  }
  return result;
}

export function DeletePipeConfirmation({ visible, onClose, pipeId, onDeleted }: Props) {
  const { pipesById, childrenByParent } = usePipeCatalog();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [jobId, setJobId] = useState<NonNullable<PipeModel["deletionJobId"]> | null>(null);
  const [completedDeletion, setCompletedDeletion] = useState<{
    jobId: NonNullable<PipeModel["deletionJobId"]>;
    deleteTransactions: boolean;
  } | null>(null);
  const notifiedJobId = useRef<typeof jobId>(null);
  const showAlert = useAlert();
  const transactionCache = useOptionalTransactionCache();
  const convex = useConvex();
  const startPipeDeletion = useMutation(api.pipes.startPipeDeletion);
  const deletionStatus = useQuery(
    api.pipes.getPipeDeletionStatus,
    jobId ? { jobId } : "skip",
  );
  const pipe = pipeId ? pipesById?.[pipeId] ?? null : null;

  const descendants = useMemo(
    () => collectDescendants(pipeId, childrenByParent),
    [pipeId, childrenByParent],
  );

  if (!visible && !jobId && (isDeleting || deleteTransactions)) {
    setIsDeleting(false);
    setDeleteTransactions(false);
  }
  if (jobId && deletionStatus?.phase === "complete") {
    setCompletedDeletion({ jobId, deleteTransactions: deletionStatus.deleteTransactions });
    setJobId(null);
    setIsDeleting(false);
  }

  useEffect(() => {
    if (completedDeletion && notifiedJobId.current !== completedDeletion.jobId) {
      notifiedJobId.current = completedDeletion.jobId;
      showAlert.success(
        `Deleted ${descendants.length ? "pipe subtree." : "pipe."}${
          completedDeletion.deleteTransactions ? " Orphaned history was deleted" : ""
        }`,
      );
      const transactionIds = transactionCache?.cache
        ? Object.keys(transactionCache.cache.entities) as Id<"transactions">[]
        : [];
      if (transactionCache && transactionIds.length > 0) {
        void convex.query(api.transactions.listTransactionsByIds, { transactionIds })
          .then((transactions) =>
            transactionCache.reconcileTransactions(transactionIds, transactions),
          )
          .catch(() => transactionCache.invalidateAll());
      }
      onDeleted();
      onClose();
    }
  }, [
    completedDeletion,
    descendants.length,
    convex,
    onClose,
    onDeleted,
    showAlert,
    transactionCache,
  ]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const result = await startPipeDeletion({ pipeId, deleteTransactions });
      setJobId(result.jobId);
    } catch (error) {
      showAlert.error(`${error}`);
      setIsDeleting(false);
    }
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
          label="Delete orphaned transaction history"
          value={deleteTransactions}
          onChange={setDeleteTransactions}
          disabled={isDeleting}
        />
        <Text className="text-muted text-xs">
          Shared transactions are preserved for surviving pipes.
        </Text>

        {isDeleting && deletionStatus ? (
          <Text className="text-muted text-sm">
            Deleting {deletionStatus.phase === "readyToFinalize"
              ? deletionStatus.totalMembers
              : deletionStatus.completedMembers} of {deletionStatus.totalMembers} pipes...
          </Text>
        ) : null}

        <Button
          variant="error"
          title={`Delete ${descendants.length + 1} pipes`}
          disabled={isDeleting}
          loading={isDeleting}
          onPress={handleConfirm}
        />
      </View>
    </ModalShell>
  );
}
