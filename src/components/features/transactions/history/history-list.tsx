import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/styles";
import { TransactionItem } from "../components/TransactionItem";
import { StackedTransactionItem } from "../components/TransactionList/components";
import { TransactionCorrectionHistoryModal } from "../components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";
import { buildFlatItems } from "../components/TransactionList/helpers";
import { groupTransactions } from "../groupTransactions";
import type { TransactionModel } from "../data/transactions";
import type { TransactionHistoryFilters } from "../cache/useTransactionHistory";
import { type HistoryItem, type PipeHistoryEvent } from "./history-data";
import { PipeHistoryRow } from "./pipe-history-row";
import { useArchiveHistory } from "./use-archive-history";

type FlatTransaction = ReturnType<typeof buildFlatItems>[number];
type Row =
  | { key: string; kind: "month"; month: string; depth: number }
  | { key: string; kind: "pipe"; event: PipeHistoryEvent }
  | { key: string; kind: "archiveMore"; event: PipeHistoryEvent }
  | { key: string; kind: "transaction"; row: FlatTransaction; depth: number; archive?: string };

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const monthKey = (date: number) => new Date(date).toISOString().slice(0, 7);
const itemDate = (item: ReturnType<typeof groupTransactions>[number]) => "count" in item ? item.latestDate : item.date;

export type HistoryListProps = {
  items: HistoryItem[]; filters: TransactionHistoryFilters;
  isLoading: boolean; error: string | null; hasMore: boolean;
  isRefreshing: boolean;
  loadMore: () => void; refresh: () => void;
};

export function HistoryList({ items, filters, isLoading, isRefreshing, error, hasMore, loadMore, refresh }: HistoryListProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(new Set<string>());
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionModel | null>(null);
  const { archives, loadSummary, loadPage } = useArchiveHistory(filters);
  const rows = useMemo(() => {
    const transactions = items.flatMap((item) => item.kind === "transaction" ? [item.transaction] : []);
    const groups = groupTransactions(transactions, filters.pipeIds);
    const top = [
      ...groups.map((group) => ({ kind: "transaction" as const, group, date: "count" in group ? group.latestDate : group.date })),
      ...items.flatMap((item) => item.kind === "pipe" ? [item] : []),
    ].sort((a, b) => b.date - a.date);
    const result: Row[] = [];
    let currentMonth: string | undefined;
    for (const item of top) {
      const month = monthKey(item.date);
      if (month !== currentMonth) {
        result.push({ key: `month:${month}`, kind: "month", month, depth: 0 });
        currentMonth = month;
      }
      if (item.kind === "transaction") {
        for (const row of buildFlatItems([item.group], expanded)) result.push({ kind: "transaction", key: row.key, row, depth: row.kind === "child" ? 1 : 0 });
        continue;
      }
      result.push({ key: `pipe:${item.event.id}`, kind: "pipe", event: item.event });
      if (!expanded.has(item.event.id) || archives[item.event.id]?.summary?.count === 0) continue;
      const archive = archives[item.event.id];
      const nested = groupTransactions(archive?.transactions ?? [], [item.event.pipeId]);
      const nestedExpanded = new Set([...expanded].filter((key) => key.startsWith(`${item.event.id}:`)).map((key) => key.slice(item.event.id.length + 1)));
      let archiveMonth: string | undefined;
      for (const group of nested) {
        const month = monthKey(itemDate(group));
        if (month !== archiveMonth) {
          result.push({ key: `${item.event.id}:month:${month}`, kind: "month", month, depth: 1 });
          archiveMonth = month;
        }
        for (const row of buildFlatItems([group], nestedExpanded)) {
          result.push({ kind: "transaction", key: `${item.event.id}:${row.key}`, row, archive: item.event.id, depth: row.kind === "child" ? 2 : 1 });
        }
      }
      if (!archive || archive.hasMore || archive.loading || archive.error) result.push({ key: `more:${item.event.id}`, kind: "archiveMore", event: item.event });
    }
    return result;
  }, [items, filters.pipeIds, expanded, archives]);

  const toggle = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <View className="flex-1">
      <FlatList data={rows} keyExtractor={(row) => row.key}
        className="flex-1 px-4" contentContainerClassName="gap-1 pb-4"
        onRefresh={refresh} refreshing={isRefreshing}
        onEndReached={() => { if (hasMore && !isLoading && !error) loadMore(); }} onEndReachedThreshold={0.5}
        ListHeaderComponent={error ? <Text accessibilityRole="alert" className="text-error text-center py-2">{error}</Text> : null}
        ListEmptyComponent={!isLoading && !error ? <Text className="text-muted text-center pt-16">No history yet</Text> : null}
        ListFooterComponent={isLoading ? <ActivityIndicator accessibilityLabel="Loading history" color={colors.primary} /> : null}
        renderItem={({ item }) => {
          if (item.kind === "month") return <Text className="text-sm text-muted mt-3 mb-1" style={{ marginLeft: item.depth * 16 }}>
            {monthFormatter.format(new Date(`${item.month}-01T00:00:00Z`))}
          </Text>;
          if (item.kind === "pipe") return <PipeHistoryRow event={item.event} expanded={expanded.has(item.event.id)}
            summary={archives[item.event.id]?.summary} summaryError={archives[item.event.id]?.summaryError}
            onLoadSummary={loadSummary}
            onPress={() => {
              if (item.event.deletedAt === undefined) {
                router.navigate({ pathname: "/(main)/(tabs)/pipes", params: { pipeId: item.event.pipeId } });
              } else {
                toggle(item.event.id);
                if (!archives[item.event.id]?.transactions.length && !archives[item.event.id]?.error) loadPage(item.event);
              }
            }} />;
          if (item.kind === "archiveMore") {
            const archive = archives[item.event.id];
            if (archive?.error) return <Text accessibilityRole="alert" className="text-error ml-4">{archive.error}</Text>;
            if (archive?.loading) return <ActivityIndicator accessibilityLabel={`Loading ${item.event.name} history`} color={colors.primary} />;
            return <Pressable accessibilityRole="button" accessibilityLabel={`Load more ${item.event.name} history`}
              className="ml-4 p-3" onPress={() => loadPage(item.event)}><Text className="text-primary">Load more</Text></Pressable>;
          }
          const row = item.row;
          return <View style={{ marginLeft: item.depth * 16 }}>
            {row.kind === "group" ? <StackedTransactionItem group={row.group} expanded={row.expanded}
              onToggle={() => toggle(item.archive ? `${item.archive}:${row.group.id}` : row.group.id)} /> :
              <TransactionItem transaction={row.transaction} onShowEditHistory={() => setSelectedTransaction(row.transaction)} />}
          </View>;
        }} />
      {selectedTransaction ? <TransactionCorrectionHistoryModal visible transactionId={selectedTransaction.id}
        transactionTitle={selectedTransaction.title} onClose={() => setSelectedTransaction(null)} /> : null}
    </View>
  );
}
