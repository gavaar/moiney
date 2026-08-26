import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { TransactionItem } from "@features/transactions/components/TransactionItem";
import { StackedTransactionItem } from "./components";
import { groupTransactions } from "@features/transactions/groupTransactions";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { colors } from "@/lib/styles";
import { buildFlatItems } from './helpers';

export type TransactionListProps = {
  transactions: TransactionModel[] | undefined;
  error?: string | null;
  isLoading?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  loadMoreStatus?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onShowEditHistory?: (transactionId: TransactionModel["id"]) => void;
  visiblePipeIds?: readonly NonNullable<TransactionModel["from"]>[];
};

export function TransactionList({
  transactions,
  error,
  isLoading,
  onLoadMore,
  onRefresh,
  refreshing = false,
  loadMoreStatus,
  onShowEditHistory,
  visiblePipeIds,
}: TransactionListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const grouped = useMemo(
    () => (transactions ? groupTransactions(transactions, visiblePipeIds) : []),
    [transactions, visiblePipeIds],
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
            accessibilityLabel="Loading transactions"
            size="small"
          color={colors.primary}
        />
      </View>
    );
  }

  if (error && (!transactions || transactions.length === 0)) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text
          accessibilityRole="alert"
          accessibilityLabel={error}
          className="text-error text-center"
        >
          {error}
        </Text>
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
    <View className="flex-1">
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLabel={error}
          className="text-error px-4 py-2 text-center"
        >
          {error}
        </Text>
      ) : null}
      <FlatList
        className="flex-1 px-4"
        data={flatItems}
        keyExtractor={(item) => item.key}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        refreshing={refreshing}
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
          return (
            <View className={item.kind === "child" ? "ml-4" : ""}>
              <TransactionItem
                transaction={item.transaction}
                onShowEditHistory={onShowEditHistory}
              />
            </View>
          );
        }}
        ListFooterComponent={() =>
          loadMoreStatus === "LoadingMore" ? (
            <View className="flex-1 items-center justify-center py-4">
              <ActivityIndicator
                testID="loading-indicator"
                accessibilityLabel="Loading more transactions"
                size="small"
                color={colors.primary}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}
