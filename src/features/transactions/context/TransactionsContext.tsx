import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id, type Doc } from "@convex/_generated/dataModel";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";

type TransactionsContextValue = {
  transactions: Doc<"transactions">[] | undefined;
  isLoading: boolean;
  pipeIds: Id<"pipes">[] | undefined | null;
};

const TransactionsContext = createContext<TransactionsContextValue>({
  transactions: undefined,
  isLoading: true,
  pipeIds: undefined,
});

export function useTransactions() {
  return useContext(TransactionsContext);
}

export function getLeafDescendantIds(
  childrenByParent: Map<Id<"pipes">, Doc<"pipes">[]>,
  selectedPipeId: Id<"pipes"> | null,
): Id<"pipes">[] | null {
  if (!selectedPipeId) return null;

  const children = childrenByParent.get(selectedPipeId);
  if (!children || children.length === 0) return [selectedPipeId];

  const result: Id<"pipes">[] = [];
  function dfs(nodeId: Id<"pipes">) {
    const nodeChildren = childrenByParent.get(nodeId);
    if (!nodeChildren || nodeChildren.length === 0) {
      result.push(nodeId);
    } else {
      for (const child of nodeChildren) {
        dfs(child._id);
      }
    }
  }
  dfs(selectedPipeId);
  return result;
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { allPipes, childrenByParent, selectedPipePath } = usePipeSelection();

  const selectedPipeId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;

  const pipeIds = useMemo(() => {
    if (!allPipes) return undefined;
    if (selectedPipeId) return getLeafDescendantIds(childrenByParent, selectedPipeId);
    return null;
  }, [allPipes, childrenByParent, selectedPipeId]);

  const transactions = useQuery(
    api.transactions.listTransactions,
    pipeIds !== undefined ? { pipeIds: pipeIds ?? undefined } : "skip",
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
