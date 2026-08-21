import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";
import { normalizeTransaction } from "@features/transactions/data/transactions";
import { useMemo } from 'react';

export default function History() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listTransactionsPaginated,
    {},
    { initialNumItems: 12 },
  );
  const transactions = useMemo(() => results.map(normalizeTransaction), [results]);

  return (
    <PipeCatalogProvider>
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
        <ScreenHeader title="History" />

        <TransactionListWithHistory
          transactions={transactions}
          isLoading={status === "LoadingFirstPage"}
          onLoadMore={() => loadMore(12)}
          loadMoreStatus={status}
        />
      </SafeAreaView>
    </PipeCatalogProvider>
  );
}
