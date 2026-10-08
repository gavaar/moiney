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
import { EMPTY_EVENT_HISTORY, type EventHistorySnapshot } from "./EventHistoryStore";
import type { HistoryEntry } from "../history/event-groups";

type TransactionCacheContextValue = {
  accountKey: string | null;
  isHydrating: boolean;
  cache: TransactionCache | null;
  mutationVersion: number;
  eventHistory: EventHistorySnapshot;
  mergeEventHead: (entries: HistoryEntry[], hasMore: boolean, generation: number) => Promise<void>;
  appendEventHistory: (entries: HistoryEntry[], hasMore: boolean, generation: number) => Promise<void>;
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
  invalidateHistory: () => Promise<void>;
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

type CacheState = {
  accountKey: string | null;
  storage: TransactionCacheStorage;
  store: TransactionCacheStore | null;
  cache: TransactionCache | null;
  isHydrating: boolean;
};

function createCacheState(accountKey: string | null, storage: TransactionCacheStorage): CacheState {
  return {
    accountKey,
    storage,
    store: accountKey ? new TransactionCacheStore(accountKey, storage) : null,
    cache: null,
    isHydrating: accountKey !== null,
  };
}

export function TransactionCacheProvider({ children, storage = transactionCacheStorage }: Props) {
  const { accountKey } = useAuth();
  const [mutationVersion, setMutationVersion] = useState(0);
  const previousStore = useRef<TransactionCacheStore | null>(null);
  const previousAccountKey = useRef<string | null>(null);
  const [state, setState] = useState(() => createCacheState(accountKey, storage));
  if (state.accountKey !== accountKey || state.storage !== storage) {
    setState(createCacheState(accountKey, storage));
  }
  const store = state.store;

  useEffect(() => {
    const oldStore = previousStore.current;
    if (oldStore && previousAccountKey.current !== accountKey) {
      void oldStore.clear();
    }
    previousAccountKey.current = accountKey;

    if (!store) {
      previousStore.current = null;
      return;
    }

    let active = true;
    previousStore.current = store;

    void store.hydrate().then((cache) => {
      if (!active || previousStore.current !== store) return;
      setState((current) => ({ ...current, cache, isHydrating: false }));
    });

    return () => {
      active = false;
    };
  }, [accountKey, store]);

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

  const invalidateHistory = useCallback(() => {
    if (!state.store || previousStore.current !== state.store) return Promise.resolve();
    const persisted = state.store.eventHistory.invalidate();
    // Retire in-flight reads before a device write can finish.
    setState(current => ({ ...current }));
    setMutationVersion(version => version + 1);
    return persisted;
  }, [state.store]);

  const mergeEventHead = useCallback(async (entries: HistoryEntry[], hasMore: boolean, generation: number) => {
    if (!state.store || state.isHydrating) return;
    await state.store.eventHistory.mergeHead(entries, hasMore, Date.now(), generation);
    if (previousStore.current === state.store) setState(current => ({ ...current }));
  }, [state.store, state.isHydrating]);
  const appendEventHistory = useCallback(async (entries: HistoryEntry[], hasMore: boolean, generation: number) => {
    if (!state.store || state.isHydrating) return;
    await state.store.eventHistory.append(entries, hasMore, Date.now(), generation);
    if (previousStore.current === state.store) setState(current => ({ ...current }));
  }, [state.store, state.isHydrating]);
  const eventHistory = !state.isHydrating && state.store ? state.store.eventHistory.read() : EMPTY_EVENT_HISTORY;

  const value = useMemo(
    () => ({
      accountKey: state.accountKey,
      isHydrating: state.isHydrating,
      cache: state.cache,
      mutationVersion,
      eventHistory, mergeEventHead, appendEventHistory,
      read,
      replace,
      append,
      addTransaction,
      updateTransaction,
      reconcileTransactions,
      mergeHead,
      invalidateAll,
      invalidateHistory,
      clear,
    }),
    [
      state.accountKey,
      state.isHydrating,
      state.cache,
      mutationVersion, eventHistory, mergeEventHead, appendEventHistory,
      read,
      replace,
      append,
      addTransaction,
      updateTransaction,
      reconcileTransactions,
      mergeHead,
      invalidateAll,
      invalidateHistory,
      clear,
    ],
  );

  return (
    <TransactionCacheContext.Provider value={value}>
      {children}
    </TransactionCacheContext.Provider>
  );
}
