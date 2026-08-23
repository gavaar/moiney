import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";
import { useTransactionHistory } from "@features/transactions/cache/useTransactionHistory";

export function HistoryScreen() {
  const {
    transactions,
    isLoading,
    isRefreshing,
    loadMore,
    loadMoreStatus,
    refresh,
  } = useTransactionHistory();

  return (
    <PipeCatalogProvider>
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
        <ScreenHeader title="History" />

        <TransactionListWithHistory
          transactions={transactions}
          isLoading={isLoading}
          onLoadMore={loadMore}
          onRefresh={refresh}
          refreshing={isRefreshing}
          loadMoreStatus={loadMoreStatus}
        />
      </SafeAreaView>
    </PipeCatalogProvider>
  );
}
