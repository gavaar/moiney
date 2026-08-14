import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";

export default function History() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listTransactionsPaginated,
    {},
    { initialNumItems: 12 },
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <ScreenHeader title="History" />

      <TransactionListWithHistory
        transactions={results}
        isLoading={status === "LoadingFirstPage"}
        onLoadMore={() => loadMore(12)}
        loadMoreStatus={status}
      />
    </SafeAreaView>
  );
}
