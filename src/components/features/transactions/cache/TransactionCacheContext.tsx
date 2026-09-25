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
  mutationVersion: number;
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
  const [mutationVersion, setMutationVersion] = useState(0);
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
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const append = useCallback(
    async (scope: string, transactions: TransactionModel[], hasMore: boolean) => {
      if (!state.store) return;
      const cache = await state.store.append(scope, transactions, hasMore);
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const addTransaction = useCallback(
    async (transaction: TransactionModel) => {
      if (!state.store) return;
      const cache = await state.store.addTransaction(transaction);
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
      setMutationVersion((version) => version + 1);
    },
    [state.store],
  );

  const updateTransaction = useCallback(
    async (transaction: TransactionModel) => {
      if (!state.store) return;
      const cache = await state.store.updateTransaction(transaction);
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
      setMutationVersion((version) => version + 1);
    },
    [state.store],
  );

  const reconcileTransactions = useCallback(
    async (knownIds: readonly string[], transactions: TransactionModel[]) => {
      if (!state.store) return;
      const store = state.store;
      let cache: TransactionCache;
      try {
        cache = await store.reconcileTransactions(knownIds, transactions);
      } catch (error) {
        if (previousStore.current === store) {
          setState((current) => ({ ...current, cache: store.cache }));
          setMutationVersion((version) => version + 1);
        }
        throw error;
      }
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
      setMutationVersion((version) => version + 1);
    },
    [state.store],
  );

  const mergeHead = useCallback(
    async (scope: string, transactions: TransactionModel[], hasMore: boolean) => {
      if (!state.store) return;
      const cache = await state.store.mergeHead(scope, transactions, hasMore);
      if (previousStore.current !== state.store) return;
      setState((current) => ({ ...current, cache }));
    },
    [state.store],
  );

  const clear = useCallback(async () => {
    if (!state.store) return;
    await state.store.clear();
    if (previousStore.current !== state.store) return;
    setState((current) => ({ ...current, cache: state.store?.cache ?? null }));
    setMutationVersion((version) => version + 1);
  }, [state.store]);

  const invalidateAll = useCallback(async () => {
    if (!state.store) return;
    const cache = await state.store.invalidateAll();
    if (previousStore.current !== state.store) return;
    setState((current) => ({ ...current, cache }));
    setMutationVersion((version) => version + 1);
  }, [state.store]);

  const value = useMemo(
    () => ({
      accountKey: state.accountKey,
      isHydrating: state.isHydrating,
      cache: state.cache,
      mutationVersion,
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
      mutationVersion,
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
