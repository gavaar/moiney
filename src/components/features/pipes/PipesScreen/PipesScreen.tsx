import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { SlideToggle } from "@ui/SlideToggle";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { useTransactions } from "@features/transactions/context/TransactionsContext";
import { InnerPipesScreen } from "@features/pipes/InnerPipesScreen";
import { PipeTreeView } from "@features/pipes/PipeTreeView";
import { FeedListScreen } from "@features/pipes/FeedListScreen";
import { orderFeedsByTreeUsage } from "@features/pipes/FeedListScreen/feedOrdering";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";
import { useTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import { HISTORY_SCOPE } from "@features/transactions/cache/transactionSnapshot";
import { useTransactionHistory } from "@features/transactions/cache/useTransactionHistory";

export function PipesScreen() {
  const [treeMode, setTreeMode] = useState(false);
  const [latestExpanded, setLatestExpanded] = useState(true);
  const { selectedName, selectedPipePath, selectPipe, deselectPipe } = usePipeSelection();
  const { allPipes, feeds, isLoading } = usePipeCatalog();
  const { cache, read } = useTransactionCache();
  const historySnapshot = useMemo(() => read(HISTORY_SCOPE), [cache, read]);
  const { transactions: historyTransactions } = useTransactionHistory(
    undefined,
    {
      enabled: historySnapshot.updatedAt > 0 && !treeMode && !selectedName,
      minimumCachedRows: 100,
    },
  );
  const orderedFeeds = useMemo(
    () =>
      orderFeedsByTreeUsage(
        feeds,
        allPipes ?? [],
        historyTransactions ?? historySnapshot.transactions,
      ),
    [allPipes, feeds, historySnapshot.transactions, historyTransactions],
  );
  const {
    transactions,
    error: transactionError,
    isLoading: transactionLoading,
    pipeIds,
    refresh: refreshTransactions,
  } = useTransactions();

  useEffect(() => {
    setLatestExpanded(!treeMode);
  }, [treeMode]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (selectedPipePath.length > 0) {
          selectPipe(selectedPipePath.slice(0, -1));
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [selectedPipePath, selectPipe]),
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background pb-1">
      <AppScreenHeader
        title="Pipes"
        right={
          <SlideToggle
            options={[
              { value: "bar", label: "Bar view", icon: "align-horizontal-left" },
              { value: "tree", label: "Tree view", icon: "file-tree" },
            ]}
            value={treeMode ? "tree" : "bar"}
            onChange={(v) => {
              setTreeMode(v === "tree");
              if (v === "tree") deselectPipe();
            }}
          />
        }
      />

      <View
        className="px-4"
        style={{ flex: 3 }}
      >
        {treeMode ? (
          <PipeTreeView
            onSelectPipe={(path) => {
              selectPipe(path);
              setTreeMode(false);
            }}
          />
        ) : selectedName ? (
          <InnerPipesScreen />
        ) : (
          <FeedListScreen
            isLoading={isLoading}
            pipes={orderedFeeds}
            onSelectFeed={(id) => selectPipe([id])}
          />
        )}
      </View>

      <View
        className="px-4 overflow-hidden"
        style={{ flex: latestExpanded ? 2 : 0 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            latestExpanded
              ? "Collapse latest transactions"
              : "Expand latest transactions"
          }
          accessibilityState={{ expanded: latestExpanded }}
          onPress={() => setLatestExpanded((v) => !v)}
          className="flex-row items-center justify-between bg-surface px-3 py-2 my-2 rounded-md"
        >
          <Text className="text-text font-semibold text-base">
            Latest transactions
          </Text>
          <View
            style={{
              transform: [{ rotate: latestExpanded ? "180deg" : "0deg" }],
            }}
          >
            <Icon name="chevron-up" size={18} color={colors.text} />
          </View>
        </Pressable>
        {latestExpanded ? (
          <View className="flex-1">
            <TransactionListWithHistory
              transactions={transactions}
              error={transactionError}
              isLoading={transactionLoading}
              onRefresh={refreshTransactions}
              refreshing={transactionLoading && transactions !== undefined}
              visiblePipeIds={pipeIds ?? undefined}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
