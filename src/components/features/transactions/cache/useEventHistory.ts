import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTransactionCache } from "./TransactionCacheContext";

/** Unfiltered raw-entry snapshot for usage ranking; never a mutation model. */
export function useEventHistory(options: { enabled?: boolean; minimumCachedRows?: number } = {}) {
  const client = useConvex();
  const { accountKey, isHydrating, mutationVersion, eventHistory, mergeEventHead, appendEventHistory } = useTransactionCache();
  const enabled = options.enabled ?? true;
  const minimumCachedRows = options.minimumCachedRows ?? 100;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([accountKey, isHydrating, mutationVersion, enabled, minimumCachedRows, revision]);
  const currentKey = useRef(key);
  const [state, setState] = useState({ key, isLoading: true, isRefreshing: false, error: null as string | null });
  if (state.key !== key) setState({ key, isLoading: enabled, isRefreshing: revision > 0, error: null });
  const controller = useRef<{ more: () => void; cancel: () => void } | null>(null);
  const snapshot = useRef(eventHistory);
  useLayoutEffect(() => { currentKey.current = key; snapshot.current = eventHistory; }, [key, eventHistory]);

  useEffect(() => {
    if (isHydrating) return;
    let active = true;
    let busy = false;
    let cursor: string | null = null;
    let failed = false;
    const generation = snapshot.current.generation;
    const isCurrent = () => active && currentKey.current === key;
    const load = async (head: boolean) => {
      if (!isCurrent() || busy || !enabled || !accountKey || (!head && (!snapshot.current.hasMore || failed))) return;
      busy = true;
      setState({ key, isLoading: true, isRefreshing: head && revision > 0, error: null });
      try {
        // Hydrated snapshots intentionally do not persist Convex cursors. Reseed
        // the head before continuing and deduplicate overlaps in the store.
        if (head || cursor === null) {
          const page = await client.query(api.events.list, { limit: 100 });
          if (!isCurrent()) return;
          const done = page.isDone || !page.cursor || page.events.length === 0;
          cursor = done ? null : page.cursor;
          if (head) await mergeEventHead(page.events, !done, generation);
          else await appendEventHistory(page.events, !done, generation);
          if (!isCurrent() || head || done) return;
        }
        const page = await client.query(api.events.list, { limit: 30, cursor: cursor ?? undefined });
        if (!isCurrent()) return;
        const done = page.isDone || !page.cursor || page.cursor === cursor || page.events.length === 0;
        cursor = done ? null : page.cursor;
        await appendEventHistory(page.events, !done, generation);
      } catch {
        if (isCurrent()) {
          failed = true;
          setState({ key, isLoading: false, isRefreshing: false, error: "Unable to load event history. Pull to refresh." });
        }
      } finally {
        if (isCurrent()) {
          busy = false;
          setState(current => ({ ...current, isLoading: false, isRefreshing: false }));
        }
      }
    };
    const scope = { more: () => { void load(false); }, cancel: () => { active = false; } };
    controller.current = scope;
    const enough = snapshot.current.complete && (!snapshot.current.hasMore || snapshot.current.entries.length >= minimumCachedRows);
    if (enabled && accountKey && (!enough || revision > 0)) void load(true);
    else setState({ key, isLoading: false, isRefreshing: false, error: null });
    return () => { scope.cancel(); if (controller.current === scope) controller.current = null; };
  }, [client, accountKey, isHydrating, mutationVersion, enabled, minimumCachedRows, revision, key, mergeEventHead, appendEventHistory]);

  return {
    entries: eventHistory.entries,
    isLoading: state.key !== key ? enabled : state.isLoading,
    isRefreshing: state.key === key && state.isRefreshing,
    hasMore: eventHistory.hasMore,
    error: state.key === key ? state.error : null,
    loadMore: () => controller.current?.more(),
    refresh: () => { if (enabled && !isHydrating) setRevision(value => value + 1); },
  };
}
