import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { useIsFocused } from "expo-router/react-navigation";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useTransactionCache } from "../cache/TransactionCacheContext";
import { HISTORY_SCOPE } from "../cache/transactionSnapshot";
import type { TransactionHistoryFilters } from "../cache/useTransactionHistory";
import { createHistoryReader, type HistoryItem } from "./history-data";

export function useMixedHistory(filters: TransactionHistoryFilters = {}, options: { enabled?: boolean; recent?: boolean } = {}) {
  const client = useConvex();
  const focused = useIsFocused();
  const { accountKey, isHydrating, mutationVersion, mergeHead, append } = useTransactionCache();
  const { allPipes } = usePipeCatalog();
  // Accounting balance changes do not change archive membership or presentation.
  const catalogKey = allPipes?.map((pipe) => [pipe.id, pipe.name, pipe.icon, pipe.deletionJobId].join(":" )).join("|");
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterKey]);
  const request = useRef<ReturnType<typeof createHistoryReader> | null>(null);
  const busy = useRef(false);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    accountKey: string | null; filterKey: string; items: HistoryItem[]; isLoading: boolean;
    hasMore: boolean; error: string | null;
  }>({ accountKey, filterKey, items: [], isLoading: true, hasMore: false, error: null });
  const enabled = focused && !isHydrating && (options.enabled ?? true) && accountKey !== null;

  useEffect(() => {
    if (!enabled) return;
    const reader = createHistoryReader(client, stableFilters, (page, isHead) => {
      if (request.current !== reader) return;
      const write = isHead ? mergeHead : append;
      void write(HISTORY_SCOPE, page.transactions, page.hasMore).catch(() => undefined);
    });
    request.current = reader;
    busy.current = true;
    setState((current) => ({
      accountKey, filterKey,
      items: current.accountKey === accountKey && current.filterKey === filterKey ? current.items : [],
       isLoading: true, hasMore: false, error: null,
    }));
    const loadInitial = async () => {
      const items: HistoryItem[] = [];
      const target = options.recent ? 30 : 100;
      while (true) {
        const page = await reader.next(target - items.length);
        if (request.current !== reader) return;
        items.push(...page.items);
        const keepFilling = Boolean(options.recent && !page.isDone && items.length < target);
         setState({ accountKey, filterKey, items: [...items], hasMore: !page.isDone, isLoading: keepFilling, error: null });
        if (!keepFilling) return;
      }
    };
    void loadInitial().catch(() => {
       if (request.current === reader) setState((current) => ({ ...current, isLoading: false, error: "Unable to load history." }));
    }).finally(() => { if (request.current === reader) busy.current = false; });
    return () => {
      reader.cancel();
      if (request.current === reader) request.current = null;
    };
  }, [client, enabled, accountKey, stableFilters, filterKey, catalogKey, mutationVersion, mergeHead, append, revision, options.recent]);

  const loadMore = useCallback(() => {
    const reader = request.current;
    if (!reader || busy.current || !state.hasMore || state.error || options.recent) return;
    busy.current = true;
    setState((current) => ({ ...current, isLoading: true }));
    void reader.next(30).then((page) => {
      if (request.current === reader) setState((current) => ({ ...current, items: [...current.items, ...page.items], hasMore: !page.isDone, isLoading: false }));
    }).catch(() => {
      if (request.current === reader) setState((current) => ({ ...current, isLoading: false, error: "Unable to load more history. Pull to refresh." }));
    }).finally(() => { if (request.current === reader) busy.current = false; });
  }, [state.hasMore, state.error, options.recent]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const belongsToScope = state.accountKey === accountKey && state.filterKey === filterKey;
  return {
    items: belongsToScope ? state.items : [],
    error: belongsToScope ? state.error : null,
    isLoading: !belongsToScope || state.isLoading,
     isRefreshing: false,
    hasMore: !options.recent && state.hasMore,
    loadMore, refresh,
    // Reset expanded archive pages and summaries when the main feed is refreshed.
    generation: `${accountKey}:${filterKey}:${catalogKey}:${revision}:${mutationVersion}`,
  };
}
