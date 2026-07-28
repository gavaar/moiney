import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { TransactionList } from "@ui/TransactionList";

export default function History() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listTransactionsPaginated,
    {},
    { initialNumItems: 12 },
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="History" />

      <TransactionList
        transactions={results}
        isLoading={status === "LoadingFirstPage"}
        onLoadMore={() => loadMore(12)}
        loadMoreStatus={status}
      />
    </SafeAreaView>
  );
}
