import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { useIsFocused } from "expo-router/react-navigation";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useTransactionCache } from "../cache/TransactionCacheContext";
import type { HistoryFilters } from "./history-filters";
import type { HistoryEntry } from "./event-groups";
import type { DeletedPipeEntry } from "./event-archives";
import { createEventHistoryReader, mergeHistoryEntries, readDeletedPipes, readLatestEvents } from "./event-history-data";

export function useMixedHistory(filters: HistoryFilters = {}, options: { enabled?: boolean; recent?: boolean } = {}) {
  const client = useConvex();
  const focused = useIsFocused();
  const { accountKey, isHydrating, mutationVersion, eventHistory, mergeEventHead, appendEventHistory } = useTransactionCache();
  const { allPipes } = usePipeCatalog();
  const catalogKey = allPipes?.map(pipe => [pipe.id, pipe.name, pipe.icon, pipe.deletionJobId].join(":" )).join("|");
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filterKey) as HistoryFilters, [filterKey]);
  const unfiltered = filters.fromDate === undefined && filters.toDate === undefined && !filters.title?.trim() && !filters.pipeIds?.length;
  const cache = useRef(eventHistory);
  useEffect(() => { cache.current = eventHistory; }, [eventHistory]);
  const [revision, setRevision] = useState(0);
  const deletionCatalog = useRef<{ key: string; entries: DeletedPipeEntry[] } | null>(null);
  const deletionCatalogKey = JSON.stringify([accountKey, catalogKey, mutationVersion, revision]);
  const enabled = focused && !isHydrating && (options.enabled ?? true) && accountKey !== null;
  const generation = `${accountKey}:${filterKey}:${catalogKey}:${revision}:${mutationVersion}`;
  const requestKey = JSON.stringify([generation, enabled, options.recent ?? false]);
  const request = useRef<{ cancel: () => void; more: () => void } | null>(null);
  const [state, setState] = useState({ requestKey, accountKey, filterKey, revision, entries: [] as HistoryEntry[], deletedPipes: [] as DeletedPipeEntry[], isLoading: true, isRefreshing: false, hasMore: false, error: null as string | null });
  if (state.requestKey !== requestKey) {
    const sameScope = state.accountKey === accountKey && state.filterKey === filterKey;
    setState({ ...state, requestKey, accountKey, filterKey, revision,
      entries: sameScope ? state.entries : [], deletedPipes: sameScope ? state.deletedPipes : [],
      isLoading: enabled, isRefreshing: enabled && sameScope && state.revision !== revision, hasMore: false, error: null });
  }

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let busy = true;
    let reader: ReturnType<typeof createEventHistoryReader> | undefined;
    let seeded = false;
    let failed = false;
    let loaded: HistoryEntry[] = [];
    const cached = cache.current;
    const patch = (update: Partial<typeof state>) => setState(current => current.requestKey === requestKey ? { ...current, ...update } : current);
    const publishCache = (entries: HistoryEntry[], isDone: boolean, head: boolean) => {
      if (unfiltered && !options.recent) void (head ? mergeEventHead : appendEventHistory)(entries, !isDone, cached.generation);
    };
    const scope = {
      cancel: () => { active = false; reader?.cancel(); },
      more: () => {
        if (!active || busy || failed || !reader || options.recent) return;
        busy = true;
        patch({ isLoading: true });
        const load = async () => {
          if (!seeded) {
            const head = await reader!.next(100);
            if (!active) return;
            seeded = true;
            publishCache(head.entries, head.isDone, false);
            loaded = mergeHistoryEntries(loaded, head.entries);
            patch({ entries: loaded, hasMore: !head.isDone });
            if (head.isDone) return;
          }
          while (active) {
            const known = new Set(loaded.map(entry => entry.id));
            const page = await reader!.next(30);
            if (!active) return;
            const unseen = page.entries.some(entry => !known.has(entry.id));
            publishCache(page.entries, page.isDone, false);
            loaded = mergeHistoryEntries(loaded, page.entries);
            patch({ entries: loaded, hasMore: !page.isDone });
            if (unseen || page.isDone) return;
          }
        };
        void load().catch(() => {
          if (active) { failed = true; patch({ error: "Unable to load more history. Pull to refresh." }); }
        }).finally(() => { if (active) { busy = false; patch({ isLoading: false }); } });
      },
    };
    request.current = scope;
    const load = async () => {
      const deletedPipes = deletionCatalog.current?.key === deletionCatalogKey
        ? deletionCatalog.current.entries : await readDeletedPipes(client, () => active);
      if (!active) return;
      deletionCatalog.current = { key: deletionCatalogKey, entries: deletedPipes };
      reader = createEventHistoryReader(client, stableFilters, deletedPipes);
      let entries: HistoryEntry[];
      let hasMore = false;
      if (options.recent) {
        if (!stableFilters.title?.trim() && stableFilters.fromDate === undefined && stableFilters.toDate === undefined) {
          entries = await readLatestEvents(client, stableFilters, deletedPipes, () => active);
        } else {
          entries = [];
          while (entries.length < 30) {
            const page = await reader.next(30 - entries.length);
            if (!active) return;
            entries = mergeHistoryEntries(entries, page.entries);
            if (page.isDone) break;
          }
        }
      } else if (unfiltered && revision === 0 && cached.complete && (!cached.hasMore || cached.entries.length >= 100)) {
        entries = cached.entries;
        hasMore = cached.hasMore;
      } else {
        const page = await reader.next(100);
        if (!active) return;
        entries = page.entries;
        hasMore = !page.isDone;
        seeded = true;
        publishCache(entries, page.isDone, true);
      }
      if (active) {
        loaded = entries;
        patch({ requestKey, accountKey, filterKey, revision, entries, deletedPipes, hasMore, isLoading: false, isRefreshing: false, error: null });
      }
    };
    void load().catch(() => { if (active) { failed = true; patch({ isLoading: false, isRefreshing: false, error: "Unable to load history." }); } })
      .finally(() => { if (active) busy = false; });
    return () => { scope.cancel(); if (request.current === scope) request.current = null; };
  }, [client, enabled, accountKey, stableFilters, filterKey, catalogKey, mutationVersion, revision, options.recent, requestKey, unfiltered, mergeEventHead, appendEventHistory, deletionCatalogKey]);

  const loadMore = useCallback(() => { if (state.hasMore && !state.error) request.current?.more(); }, [state.hasMore, state.error]);
  const refresh = useCallback(() => setRevision(value => value + 1), [setRevision]);
  const belongsToScope = state.accountKey === accountKey && state.filterKey === filterKey;
  return {
    entries: belongsToScope ? state.entries : [], deletedPipes: belongsToScope ? state.deletedPipes : [],
    error: belongsToScope ? state.error : null, isLoading: !belongsToScope || state.isLoading,
    isRefreshing: belongsToScope && state.isRefreshing, hasMore: !options.recent && state.hasMore,
    loadMore, refresh, generation,
  };
}
