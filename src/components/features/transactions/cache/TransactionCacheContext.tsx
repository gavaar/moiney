import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  TransactionCacheStore,
  type TransactionCacheStorage,
} from "./TransactionCacheStore";
import {
  readSnapshot,
  type TransactionCache,
  type TransactionSnapshotRead,
} from "./transactionSnapshot";
import { transactionCacheStorage } from "./storage";

type TransactionCacheContextValue = {
  accountKey: string | null;
  isHydrating: boolean;
  cache: TransactionCache | null;
  read: (scope: string) => TransactionSnapshotRead;
  replace: (
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
  ) => Promise<void>;
  append: (
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
  ) => Promise<void>;
  addTransaction: (transaction: TransactionModel) => Promise<void>;
  updateTransaction: (transaction: TransactionModel) => Promise<void>;
  reconcileTransactions: (
    knownIds: readonly string[],
    transactions: TransactionModel[],
  ) => Promise<void>;
  mergeHead: (
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
  ) => Promise<void>;
  invalidateAll: () => Promise<void>;
  clear: () => Promise<void>;
};

const TransactionCacheContext = createContext<TransactionCacheContextValue | null>(null);

export function useTransactionCache(): TransactionCacheContextValue {
  const value = useContext(TransactionCacheContext);
  if (!value) {
    throw new Error("useTransactionCache must be used within TransactionCacheProvider");
  }
  return value;
}

export function useOptionalTransactionCache(): TransactionCacheContextValue | null {
  return useContext(TransactionCacheContext);
}

type Props = {
  children: ReactNode;
  storage?: TransactionCacheStorage;
};

export function TransactionCacheProvider({ children, storage = transactionCacheStorage }: Props) {
  const { accountKey } = useAuth();
  const previousStore = useRef<TransactionCacheStore | null>(null);
  const previousAccountKey = useRef<string | null>(null);
  const [state, setState] = useState<{
    accountKey: string | null;
    store: TransactionCacheStore | null;
    cache: TransactionCache | null;
    isHydrating: boolean;
  }>({ accountKey: null, store: null, cache: null, isHydrating: false });

  useEffect(() => {
    const oldStore = previousStore.current;
    if (oldStore && previousAccountKey.current !== accountKey) {
      void oldStore.clear();
    }
    previousAccountKey.current = accountKey;

    if (!accountKey) {
      previousStore.current = null;
      setState({ accountKey: null, store: null, cache: null, isHydrating: false });
      return;
    }

    const store = new TransactionCacheStore(accountKey, storage);
    let active = true;
    previousStore.current = store;
    setState({ accountKey, store, cache: null, isHydrating: true });

    void store.hydrate().then((cache) => {
      if (!active || previousStore.current !== store) return;
      setState({ accountKey, store, cache, isHydrating: false });
    });

    return () => {
      active = false;
    };
  }, [accountKey, storage]);

  const read = useCallback(
    (scope: string) =>
      state.cache
        ? readSnapshot(state.cache, scope)
        : { transactions: [], complete: false, hasMore: false, updatedAt: 0 },
    [state.cache],
  );

  const replace = useCallback(
    async (scope: string, transactions: TransactionModel[], hasMore: boolean) => {
      if (!state.store) return;
      const cache = await state.store.replace(scope, transactions, hasMore);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const append = useCallback(
    async (scope: string, transactions: TransactionModel[], hasMore: boolean) => {
      if (!state.store) return;
      const cache = await state.store.append(scope, transactions, hasMore);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const addTransaction = useCallback(
    async (transaction: TransactionModel) => {
      if (!state.store) return;
      const cache = await state.store.addTransaction(transaction);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const updateTransaction = useCallback(
    async (transaction: TransactionModel) => {
      if (!state.store) return;
      const cache = await state.store.updateTransaction(transaction);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const reconcileTransactions = useCallback(
    async (knownIds: readonly string[], transactions: TransactionModel[]) => {
      if (!state.store) return;
      const cache = await state.store.reconcileTransactions(knownIds, transactions);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const mergeHead = useCallback(
    async (scope: string, transactions: TransactionModel[], hasMore: boolean) => {
      if (!state.store) return;
      const cache = await state.store.mergeHead(scope, transactions, hasMore);
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const clear = useCallback(async () => {
    if (!state.store) return;
    await state.store.clear();
    setState((current) => ({ ...current, cache: state.store?.cache ?? null }));
  }, [state.store]);

  const invalidateAll = useCallback(async () => {
    if (!state.store) return;
    const cache = await state.store.invalidateAll();
    setState((current) => ({ ...current, cache }));
  }, [state.store]);

  const value = useMemo(
    () => ({
      accountKey: state.accountKey,
      isHydrating: state.isHydrating,
      cache: state.cache,
      read,
      replace,
      append,
      addTransaction,
      updateTransaction,
      reconcileTransactions,
      mergeHead,
      invalidateAll,
      clear,
    }),
    [
      state.accountKey,
      state.isHydrating,
      state.cache,
      read,
      replace,
      append,
      addTransaction,
      updateTransaction,
      reconcileTransactions,
      mergeHead,
      invalidateAll,
      clear,
    ],
  );

  return (
    <TransactionCacheContext.Provider value={value}>
      {children}
    </TransactionCacheContext.Provider>
  );
}
