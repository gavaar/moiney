import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Id } from "@convex/_generated/dataModel";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { colors } from "@/lib/styles";
import { StackedTransactionItem } from "../components/StackedTransactionItem";
import { TransactionCorrectionHistoryModal } from "../components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";
import type { HistoryFilters } from "./history-filters";
import { groupMonthlyEventHistory, type DeletedPipeEntry, type MonthlyEventArchive } from "./event-archives";
import type { EventHistoryRow, HistoryEntry } from "./event-groups";
import { EventTransactionItem, eventTransactionPresentation } from "./event-transaction-item";
import { PipeHistoryRow } from "./pipe-history-row";

type Row = { key: string; depth: number } & (
  { kind: "month"; month: string } |
  { kind: "archive"; archive: MonthlyEventArchive } |
  { kind: "event"; row: EventHistoryRow }
);
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const rowDate = (row: EventHistoryRow | MonthlyEventArchive) => row.kind === "group" || row.kind === "archive" ? row.latestDate : row.kind === "operation" ? row.operation.occurredAt : row.event.occurredAt;
export type HistoryListProps = {
  entries: HistoryEntry[]; deletedPipes: DeletedPipeEntry[]; filters: HistoryFilters;
  isLoading: boolean; error: string | null; hasMore: boolean; isRefreshing: boolean;
  loadMore: () => void; refresh: () => void;
};

export function HistoryList({ entries, deletedPipes: catalog, filters, isLoading, isRefreshing, error, hasMore, loadMore, refresh }: HistoryListProps) {
  const router = useRouter();
  const { pipesById } = usePipeCatalog();
  const deletedPipes = useMemo(() => [...new Map([
    ...catalog, ...entries.filter((entry): entry is DeletedPipeEntry => entry.type === "pipe_deletion"),
  ].map(entry => [entry.pipeId, entry])).values()], [catalog, entries]);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [selected, setSelected] = useState<{ id: Id<"transactions">; title: string } | null>(null);
  const rows = useMemo(() => {
    const top = groupMonthlyEventHistory(entries, deletedPipes, filters.pipeIds?.length ? filters.pipeIds : undefined);
    const result: Row[] = [];
    const addEvent = (row: EventHistoryRow, prefix: string, depth: number) => {
      const key = `${prefix}${row.id}`;
      result.push({ kind: "event", key, depth, row });
      if (row.kind === "group" && expanded.has(key)) for (const operation of row.operations) {
        result.push({ kind: "event", key: `${key}:${operation.id}`, depth: depth + 1, row: { kind: "operation", id: operation.id, operation } });
      }
    };
    let currentMonth: string | undefined;
    for (const row of top) {
      const month = new Date(rowDate(row)).toISOString().slice(0, 7);
      if (month !== currentMonth) { result.push({ key: `month:${month}`, kind: "month", month, depth: 0 }); currentMonth = month; }
      if (row.kind === "archive") {
        result.push({ kind: "archive", key: row.id, depth: 0, archive: row });
        if (expanded.has(row.id) && row.loadedSummary.count > 0) for (const child of row.rows) addEvent(child, `${row.id}:`, 1);
      } else addEvent(row, "", 0);
    }
    return result;
  }, [entries, deletedPipes, filters.pipeIds, expanded]);
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  return <View className="flex-1">
    <FlatList data={rows} keyExtractor={row => row.key} className="flex-1 px-4" contentContainerClassName="gap-1 pb-4"
      onRefresh={refresh} refreshing={isRefreshing}
      onEndReached={() => { if (hasMore && !isLoading && !error) loadMore(); }} onEndReachedThreshold={0.5}
      ListHeaderComponent={error ? <Text accessibilityRole="alert" className="text-error text-center py-2">{error}</Text> : null}
      ListEmptyComponent={!isLoading && !error ? <Text className="text-muted text-center pt-16">No history yet</Text> : null}
      ListFooterComponent={isLoading ? <ActivityIndicator accessibilityLabel="Loading history" color={colors.primary} /> : null}
      renderItem={({ item }) => {
        if (item.kind === "month") return <Text className="text-sm text-muted mt-3 mb-1">{monthFormatter.format(new Date(`${item.month}-01T00:00:00Z`))}</Text>;
        if (item.kind === "archive") return <PipeHistoryRow event={item.archive.event} expanded={expanded.has(item.key)}
          summary={item.archive.loadedSummary} date={item.archive.latestDate} onPress={() => toggle(item.key)} />;
        const row = item.row;
        if (row.kind === "lifecycle") {
          const pipe = pipesById?.[row.event.pipeId];
          const parent = pipe?.parentId ? pipesById?.[pipe.parentId] : undefined;
          const event = pipe ? { ...row.event, name: pipe.name, icon: pipe.icon, parentName: parent?.name, parentIcon: parent?.icon } : row.event;
          return <View style={{ marginLeft: item.depth * 16 }}><PipeHistoryRow event={event} expanded={false}
            archived={deletedPipes.some(deleted => deleted.pipeId === event.pipeId)}
            onPress={() => router.navigate({ pathname: "/(main)/(tabs)/pipes", params: { pipeId: event.pipeId } })} /></View>;
        }
        return <View style={{ marginLeft: item.depth * 16 }}>
          {row.kind === "group" ? <StackedTransactionItem group={{ ...row, transactions: row.operations.map(operation => eventTransactionPresentation(operation, deletedPipes)) }}
            expanded={expanded.has(item.key)} onToggle={() => toggle(item.key)} /> :
            <EventTransactionItem operation={row.operation} deletedPipes={deletedPipes}
              onShowEditHistory={id => setSelected({ id, title: row.operation.title })} />}
        </View>;
      }} />
    {selected ? <TransactionCorrectionHistoryModal visible transactionId={selected.id} transactionTitle={selected.title} onClose={() => setSelected(null)} /> : null}
  </View>;
}
