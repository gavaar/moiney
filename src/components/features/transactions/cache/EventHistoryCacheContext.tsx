import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import {
  EMPTY_EVENT_HISTORY,
  EventHistoryStore,
  type EventHistorySnapshot,
  type EventHistoryStorage,
} from "./EventHistoryStore";
import { eventHistoryStorage } from "./storage";
import type { HistoryEntry } from "../history/event-groups";

type EventHistoryCacheContextValue = {
  accountKey: string | null;
  isHydrating: boolean;
  mutationVersion: number;
  eventHistory: EventHistorySnapshot;
  mergeEventHead: (entries: HistoryEntry[], hasMore: boolean, generation: number) => Promise<void>;
  appendEventHistory: (entries: HistoryEntry[], hasMore: boolean, generation: number) => Promise<void>;
  invalidateHistory: () => Promise<void>;
};

const EventHistoryCacheContext = createContext<EventHistoryCacheContextValue | null>(null);

export function useEventHistoryCache(): EventHistoryCacheContextValue {
  const value = useContext(EventHistoryCacheContext);
  if (!value) {
    throw new Error("useEventHistoryCache must be used within EventHistoryCacheProvider");
  }
  return value;
}

export function useOptionalEventHistoryCache(): EventHistoryCacheContextValue | null {
  return useContext(EventHistoryCacheContext);
}

type CacheState = {
  accountKey: string | null;
  storage: EventHistoryStorage;
  store: EventHistoryStore | null;
  isHydrating: boolean;
};

function createCacheState(accountKey: string | null, storage: EventHistoryStorage): CacheState {
  return {
    accountKey,
    storage,
    store: accountKey ? new EventHistoryStore(accountKey, storage) : null,
    isHydrating: accountKey !== null,
  };
}

export function EventHistoryCacheProvider({ children, storage = eventHistoryStorage }: {
  children: ReactNode;
  storage?: EventHistoryStorage;
}) {
  const { accountKey } = useAuth();
  const [mutationVersion, setMutationVersion] = useState(0);
  const [state, setState] = useState(() => createCacheState(accountKey, storage));
  if (state.accountKey !== accountKey || state.storage !== storage) {
    setState(createCacheState(accountKey, storage));
  }
  const store = state.store;
  const activeStore = useRef<EventHistoryStore | null>(null);
  const previousStore = useRef<EventHistoryStore | null>(null);
  const previousAccountKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    activeStore.current = store;
    return () => {
      if (activeStore.current === store) activeStore.current = null;
    };
  }, [store]);

  useEffect(() => {
    const oldStore = previousStore.current;
    if (oldStore && previousAccountKey.current !== accountKey) {
      void oldStore.clear();
    }
    previousAccountKey.current = accountKey;
    previousStore.current = store;
    if (!store) return;

    let active = true;
    void store.hydrate().then(() => {
      if (!active || activeStore.current !== store) return;
      setState(current => current.store === store ? { ...current, isHydrating: false } : current);
    });
    return () => {
      active = false;
    };
  }, [accountKey, store]);

  const invalidateHistory = useCallback(() => {
    if (!store || activeStore.current !== store) return Promise.resolve();
    const persisted = store.invalidate();
    // Consumers must retire in-flight reads before a device write can finish.
    setState(current => current.store === store ? { ...current } : current);
    setMutationVersion(version => version + 1);
    return persisted;
  }, [store]);

  const mergeEventHead = useCallback(async (entries: HistoryEntry[], hasMore: boolean, generation: number) => {
    if (!store || state.isHydrating || activeStore.current !== store) return;
    await store.mergeHead(entries, hasMore, Date.now(), generation);
    if (activeStore.current === store) {
      setState(current => current.store === store ? { ...current } : current);
    }
  }, [store, state.isHydrating]);

  const appendEventHistory = useCallback(async (entries: HistoryEntry[], hasMore: boolean, generation: number) => {
    if (!store || state.isHydrating || activeStore.current !== store) return;
    await store.append(entries, hasMore, Date.now(), generation);
    if (activeStore.current === store) {
      setState(current => current.store === store ? { ...current } : current);
    }
  }, [store, state.isHydrating]);

  const eventHistory = !state.isHydrating && store ? store.read() : EMPTY_EVENT_HISTORY;
  const value = useMemo(() => ({
    accountKey: state.accountKey,
    isHydrating: state.isHydrating,
    mutationVersion,
    eventHistory,
    mergeEventHead,
    appendEventHistory,
    invalidateHistory,
  }), [state.accountKey, state.isHydrating, mutationVersion, eventHistory, mergeEventHead, appendEventHistory, invalidateHistory]);

  return <EventHistoryCacheContext.Provider value={value}>{children}</EventHistoryCacheContext.Provider>;
}
