import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import type { Id } from "@convex/_generated/dataModel";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { colors } from "@/lib/styles";
import { TreeBranch } from "@ui/TreeBranch";
import { TransactionCorrectionHistoryModal } from "@features/transactions/components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";
import type { HistoryFilters } from "@features/transactions/history/data/history-filters";
import { groupMonthlyEventHistory } from "@features/transactions/history/events/event-archives";
import type { DeletedPipeEntry } from "@features/pipes/data/deletedPipes";
import type { HistoryEntry, SettlementEntry } from "@features/transactions/history/events/event-groups";
import { SettlementDetailsModal } from "./components/SettlementDetailsModal/SettlementDetailsModal";
import { HistoryRow } from "./components/HistoryRow/HistoryRow";
import { prepareHistoryRows } from "./history-rows";
export type HistoryListProps = {
  entries: HistoryEntry[]; deletedPipes: DeletedPipeEntry[]; filters: HistoryFilters;
  isLoading: boolean; error: string | null; hasMore: boolean; isRefreshing: boolean;
  loadMore: () => void; refresh: () => void;
};

export function HistoryList({ entries, deletedPipes: catalog, filters, isLoading, isRefreshing, error, hasMore, loadMore, refresh }: HistoryListProps) {
  const { pipesById, childrenByParent } = usePipeCatalog();
  const deletedPipes = useMemo(() => [...new Map([...catalog, ...entries.filter((entry): entry is DeletedPipeEntry => entry.type === "pipe_deletion"),].map(entry => [entry.pipeId, entry])).values()], [catalog, entries]);
  const deletedPipeIcons = useMemo(() => new Map(deletedPipes.map(pipe => [pipe.pipeId, pipe.icon])), [deletedPipes]);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [selected, setSelected] = useState<{ id: Id<"events">; title: string } | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementEntry | null>(null);
  const groupedHistory = useMemo(
    () => groupMonthlyEventHistory(entries, deletedPipes, filters.pipeIds?.length ? filters.pipeIds : undefined),
    [entries, deletedPipes, filters.pipeIds],
  );
  const preparedRows = useMemo(() => prepareHistoryRows(groupedHistory), [groupedHistory]);
  const rows = useMemo(() => preparedRows.visible(expanded), [preparedRows, expanded]);
  const toggle = useCallback((key: string) => {
    setExpanded(current => {
      const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
    });
  }, []);
  const showEditHistory = useCallback((id: Id<"events">, title: string) => setSelected({ id, title }), []);
  const list = <FlatList data={rows} keyExtractor={row => row.key} className="flex-1 px-4" contentContainerClassName="gap-1 pb-4"
    onRefresh={refresh} refreshing={isRefreshing}
    onEndReached={() => { if (hasMore && !isLoading && !error) loadMore(); }} onEndReachedThreshold={0.5}
    ListHeaderComponent={error ? <Text accessibilityRole="alert" className="text-error text-center py-2">{error}</Text> : undefined}
    ListEmptyComponent={!isLoading && !error ? <Text className="text-muted text-center pt-16">No history yet</Text> : undefined}
    ListFooterComponent={isLoading ? <ActivityIndicator accessibilityLabel="Loading history" color={colors.primary} /> : undefined}
    renderItem={({ item }) => {
      const row = <HistoryRow item={item} expanded={expanded.has(item.key)} pipesById={pipesById}
        childrenByParent={childrenByParent} deletedPipeIcons={deletedPipeIcons} onToggle={toggle}
        onShowEditHistory={showEditHistory} onShowSettlement={setSelectedSettlement} />;
      return item.branch.length > 0
        ? <View className="flex-row items-center">
            <TreeBranch path={item.branch} />
            <View className="flex-1">
              {row}
            </View>
          </View>
        : row;
    }} />;
  return <View className="flex-1">
    {list}
    {selected ? <TransactionCorrectionHistoryModal visible operationId={selected.id} transactionTitle={selected.title} onClose={() => setSelected(null)} /> : null}
    {selectedSettlement ? <SettlementDetailsModal event={selectedSettlement} onClose={() => setSelectedSettlement(null)} /> : null}
  </View>;
}
