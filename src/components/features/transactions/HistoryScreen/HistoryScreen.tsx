import { SafeAreaView } from "react-native-safe-area-context";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";
import { useTransactionHistory } from "@features/transactions/cache/useTransactionHistory";

export function HistoryScreen() {
  const {
    transactions,
    error,
    isLoading,
    isRefreshing,
    loadMore,
    loadMoreStatus,
    refresh,
  } = useTransactionHistory();

  return (
    <PipeCatalogProvider>
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
        <AppScreenHeader title="History" />

        <TransactionListWithHistory
          transactions={transactions}
          error={error}
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
