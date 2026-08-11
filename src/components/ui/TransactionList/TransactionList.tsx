import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { TransactionItem } from "@ui/TransactionItem";
import { StackedTransactionItem } from "./components";
import { groupTransactions } from "@features/transactions/groupTransactions";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { TransactionWithPipeIcons } from "@/lib/transactions/types";
import { colors } from "@/lib/styles";
import { buildFlatItems } from './helpers';

type TransactionListProps = {
  transactions: TransactionWithPipeIcons[] | undefined;
  isLoading?: boolean;
  onLoadMore?: () => void;
  loadMoreStatus?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
};

export function TransactionList({
  transactions,
  isLoading,
  onLoadMore,
  loadMoreStatus,
}: TransactionListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const grouped = useMemo(
    () => (transactions ? groupTransactions(transactions) : []),
    [transactions],
  );

  const flatItems = useMemo(
    () => buildFlatItems(grouped, expandedKeys),
    [grouped, expandedKeys],
  );

  function toggleGroup(group: TransactionGroup) {
    const key = group.id;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
      next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleLoadMore() {
    if (loadMoreStatus === "CanLoadMore") {
      onLoadMore?.();
    }
  }

  const isInitialLoading =
    (isLoading || loadMoreStatus === "LoadingFirstPage") &&
    (!transactions || transactions.length === 0);

  if (isInitialLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator
          testID="loading-indicator"
          size="small"
          color={colors.primary}
        />
      </View>
    );
  }

  if (transactions && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center pt-32">
        <Text className="text-muted text-lg">No transactions yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 px-4"
      data={flatItems}
      keyExtractor={(item) => item.key}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      contentContainerClassName="gap-1 pb-4"
      renderItem={({ item }) => {
        if (item.kind === "group") {
          return (
            <StackedTransactionItem
              group={item.group}
              expanded={item.expanded}
              onToggle={() => toggleGroup(item.group)}
            />
          );
        }
        if (item.kind === "child") {
          return (
            <View className="ml-4">
              <TransactionItem transaction={item.transaction} />
            </View>
          );
        }
        return <TransactionItem transaction={item.transaction} />;
      }}
      ListFooterComponent={() =>
        loadMoreStatus === "LoadingMore" ? (
          <View className="flex-1 items-center justify-center py-4">
            <ActivityIndicator
              testID="loading-indicator"
              size="small"
              color={colors.primary}
            />
          </View>
        ) : null
      }
    />
  );
}
