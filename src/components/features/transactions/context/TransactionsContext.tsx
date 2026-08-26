import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  normalizeTransaction,
  type TransactionModel,
} from "@features/transactions/data/transactions";
import type { PipeModel } from "@features/pipes/data/pipes";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { useTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import { pipeScope, RECENT_SCOPE } from "@features/transactions/cache/transactionSnapshot";

type TransactionsContextValue = {
  transactions: TransactionModel[] | undefined;
  error: string | null;
  isLoading: boolean;
  pipeIds: PipeModel["id"][] | undefined | null;
  refresh: () => void;
};

const TRANSACTION_LOAD_ERROR = "Unable to load transactions.";

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function useTransactions(): TransactionsContextValue {
  const value = useContext(TransactionsContext);
  if (!value) {
    throw new Error("useTransactions must be used within TransactionsProvider");
  }
  return value;
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
  const convex = useConvex();
  const { allPipes, childrenByParent } = usePipeCatalog();
  const { selectedPipePath } = usePipeSelection();
  const { cache, isHydrating, read, replace } = useTransactionCache();
  const requestRef = useRef(0);
  const [transactions, setTransactions] = useState<TransactionModel[] | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedPipeId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;

  const pipeIds = useMemo(() => {
    if (!allPipes) return undefined;
    if (selectedPipeId) return getSubtreePipeIds(childrenByParent, selectedPipeId);
    return null;
  }, [allPipes, childrenByParent, selectedPipeId]);

  const scope = useMemo(
    () =>
      pipeIds === undefined
        ? null
        : selectedPipeId
          ? pipeScope(pipeIds ?? [])
          : RECENT_SCOPE,
    [pipeIds, selectedPipeId],
  );
  const cached = useMemo(
    () =>
      scope
        ? read(scope)
        : { transactions: [], complete: false, hasMore: false, updatedAt: 0 },
    [read, scope, cache],
  );

  const fetchScope = useCallback(async () => {
    if (!scope || isHydrating) return;
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const rows = await convex.query(
        api.transactions.listTransactions,
        selectedPipeId ? { pipeIds: pipeIds ?? [] } : {},
      );
      if (requestId !== requestRef.current) return;
      const normalized = rows.map(normalizeTransaction);
      setTransactions(normalized);
      setIsLoading(false);
      setError(null);
      await replace(scope, normalized, false);
    } catch {
      if (requestId === requestRef.current) {
        setIsLoading(false);
        setError(TRANSACTION_LOAD_ERROR);
      }
    }
  }, [convex, isHydrating, pipeIds, replace, scope, selectedPipeId]);

  useEffect(() => {
    if (!scope || isHydrating) {
      requestRef.current += 1;
      setTransactions(undefined);
      setError(null);
      setIsLoading(true);
      return;
    }

    setTransactions(cached.transactions.length > 0 ? cached.transactions : undefined);
    setIsLoading(cached.transactions.length === 0 && !cached.complete);

    if (!cached.complete) void fetchScope();
  }, [cached, fetchScope, isHydrating, scope]);

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        error,
        isLoading,
        pipeIds,
        refresh: () => void fetchScope(),
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}
