import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  normalizeTransaction,
  type TransactionModel,
} from "@features/transactions/data/transactions";
import type { PipeModel } from "@features/pipes/data/pipes";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";

type TransactionsContextValue = {
  transactions: TransactionModel[] | undefined;
  isLoading: boolean;
  pipeIds: PipeModel["id"][] | undefined | null;
};

const TransactionsContext = createContext<TransactionsContextValue>({
  transactions: undefined,
  isLoading: true,
  pipeIds: undefined,
});

export function useTransactions() {
  return useContext(TransactionsContext);
}

export function getSubtreePipeIds(
  childrenByParent: Map<PipeModel["id"], PipeModel[]>,
  selectedPipeId: PipeModel["id"] | null,
): PipeModel["id"][] | null {
  if (!selectedPipeId) return null;

  const result: PipeModel["id"][] = [];
  function dfs(nodeId: PipeModel["id"]) {
    result.push(nodeId);
    const nodeChildren = childrenByParent.get(nodeId);
    if (nodeChildren) {
      for (const child of nodeChildren) {
        dfs(child.id);
      }
    }
  }
  dfs(selectedPipeId);
  return result;
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { allPipes, childrenByParent } = usePipeCatalog();
  const { selectedPipePath } = usePipeSelection();

  const selectedPipeId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;

  const pipeIds = useMemo(() => {
    if (!allPipes) return undefined;
    if (selectedPipeId) return getSubtreePipeIds(childrenByParent, selectedPipeId);
    return null;
  }, [allPipes, childrenByParent, selectedPipeId]);

  const persistedTransactions = useQuery(
    api.transactions.listTransactions,
    pipeIds !== undefined ? { pipeIds: pipeIds ?? undefined } : "skip",
  );
  const transactions = useMemo(
    () => persistedTransactions?.map(normalizeTransaction),
    [persistedTransactions],
  );

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        isLoading: transactions === undefined,
        pipeIds,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}
