import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type {
  PipeModel,
} from "@features/pipes/data/pipes";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useOptionalEventHistoryCache } from "@features/transactions/cache/EventHistoryCacheContext";
import { buildPipeTree, PipeTreeItem } from "@features/pipes/PipeTree";
import { getSubtreePipeIds } from "@features/pipes/data/subtree";
import { TreeList, useTreeCollapse } from "@ui/TreeList";

type Props = {
  visible: boolean;
  onClose: () => void;
  pipeId: PipeModel["id"];
  onDeleted: () => void;
};

export function DeletePipeConfirmation({ visible, onClose, pipeId, onDeleted }: Props) {
  const { pipesById, childrenByParent } = usePipeCatalog();
  const collapse = useTreeCollapse();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [jobId, setJobId] = useState<NonNullable<PipeModel["deletionJobId"]> | null>(null);
  const [completedDeletion, setCompletedDeletion] = useState<{
    jobId: NonNullable<PipeModel["deletionJobId"]>;
    deleteTransactions: boolean;
  } | null>(null);
  const notifiedJobId = useRef<typeof jobId>(null);
  const showAlert = useAlert();
  const historyCache = useOptionalEventHistoryCache();
  const startPipeDeletion = useMutation(api.pipes.startPipeDeletion);
  const deletionStatus = useQuery(
    api.pipes.getPipeDeletionStatus,
    jobId ? { jobId } : "skip",
  );
  const pipe = pipeId ? pipesById?.[pipeId] ?? null : null;

  const subtreeIds = useMemo(
    () => getSubtreePipeIds(childrenByParent, pipeId) ?? [],
    [pipeId, childrenByParent],
  );
  const subtree = buildPipeTree(Object.values(pipesById ?? {}), subtreeIds, { rootId: pipeId });

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
        `Deleted ${subtreeIds.length > 1 ? "pipe subtree." : "pipe."}${
          completedDeletion.deleteTransactions ? " Orphaned history was deleted" : ""
        }`,
      );
      void historyCache?.invalidateHistory().catch(() => undefined);
      onDeleted();
      onClose();
    }
  }, [
    completedDeletion,
    subtreeIds.length,
    onClose,
    onDeleted,
    showAlert,
    historyCache,
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
      <View className="gap-4 min-w-[300px]" style={{ flexShrink: 1 }}>
        <View className="flex-row items-center gap-2">
          {pipe && <Icon name={safeIconName(pipe.icon)} size={24} color={colors.text} />}
          <Text className="text-text font-bold text-lg">{pipe?.name ?? "Unknown"}</Text>
        </View>

        <TreeList
          {...subtree}
          collapse={collapse}
          ListHeaderComponent={
            <View className="gap-4">
              <Text className="text-text text-sm">This will delete the following pipes:</Text>
            </View>
          }
          renderItem={(item, state) => <PipeTreeItem pipe={item} state={state}>
            {item.id === pipeId ? <Text className="text-muted text-xs">(selected)</Text> : null}
          </PipeTreeItem>}
          ListFooterComponent={
            <View className="gap-4">
              <View className="bg-error/10 border border-error rounded-lg p-3">
                <Text className="text-error text-sm">
                  Warning: You are about to delete this pipe and all its child pipes. This action cannot be undone.
                </Text>
              </View>
              <Input
                type="checkbox"
                checkboxLabel="Delete orphaned transaction history"
                value={deleteTransactions}
                onChange={setDeleteTransactions}
                disabled={isDeleting}
              />
              <Text className="text-muted text-xs">Shared transactions are preserved for surviving pipes.</Text>
              {isDeleting && deletionStatus ? (
                <Text className="text-muted text-sm">
                  Deleting {deletionStatus.phase === "readyToFinalize"
                    ? deletionStatus.totalMembers
                    : deletionStatus.completedMembers} of {deletionStatus.totalMembers} pipes...
                </Text>
              ) : null}
            </View>
          }
        />

        <Button
          variant="error"
          title={`Delete ${subtreeIds.length} pipes`}
          disabled={isDeleting}
          loading={isDeleting}
          onPress={handleConfirm}
        />
      </View>
    </ModalShell>
  );
}
