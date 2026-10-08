import type { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import type { HistoryFilters } from "./history-filters";
import type { HistoryEntry } from "./event-groups";
import type { DeletedPipeEntry } from "./event-archives";

export async function readDeletedPipes(client: ConvexReactClient, isActive: () => boolean) {
  const entries: DeletedPipeEntry[] = [];
  const visited = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    if (!isActive()) throw new Error("History read cancelled");
    const page = await client.query(api.events.deletedPipes, { limit: 100, ...(cursor ? { cursor } : {}) });
    if (!isActive()) throw new Error("History read cancelled");
    entries.push(...page.events);
    if (page.isDone) return entries;
    if (!page.cursor || visited.has(page.cursor)) throw new Error("Deletion catalog pagination stalled");
    visited.add(page.cursor);
    cursor = page.cursor;
  }
}

export function eventScopeIds(filters: HistoryFilters, deleted: readonly DeletedPipeEntry[]) {
  if (!filters.pipeIds?.length) return undefined;
  const scope = new Set(filters.pipeIds);
  return new Set([...scope, ...deleted.filter(event => event.ancestorIds.some(id => scope.has(id))).map(event => event.pipeId)]);
}

/** One indexed window per unique pipe; grouping sees only the newest 30 overall. */
export async function readLatestEvents(client: ConvexReactClient, filters: HistoryFilters, deleted: readonly DeletedPipeEntry[], isActive: () => boolean) {
  const scope = eventScopeIds(filters, deleted);
  const pipeIds = scope ? [...scope] : [undefined];
  let entries: HistoryEntry[] = [];
  for (let offset = 0; offset < pipeIds.length; offset += 8) {
    if (!isActive()) throw new Error("History read cancelled");
    const pages = await Promise.all(pipeIds.slice(offset, offset + 8).map(pipeId =>
      client.query(api.events.latest, pipeId ? { pipeId } : {})));
    if (!isActive()) throw new Error("History read cancelled");
    entries = mergeHistoryEntries(entries, pages.flat()).slice(0, 30);
  }
  return entries;
}

/** Only the main stream supplies visible members; the catalog supplies scope metadata. */
export function createEventHistoryReader(client: ConvexReactClient, filters: HistoryFilters, deleted: readonly DeletedPipeEntry[]) {
  const scope = eventScopeIds(filters, deleted);
  const pipeId = scope?.size === 1 ? [...scope][0] : undefined;
  const title = filters.title?.trim() || undefined;
  let cursor: string | undefined;
  let done = false;
  let cancelled = false;
  const visited = new Set<string>();
  return {
    cancel: () => { cancelled = true; },
    async next(limit: number): Promise<{ entries: HistoryEntry[]; isDone: boolean }> {
      while (!done) {
        if (cancelled) throw new Error("History read cancelled");
        const page = await client.query(api.events.list, {
          limit, ...(cursor ? { cursor } : {}), ...(pipeId ? { pipeId } : {}),
          ...(filters.fromDate === undefined ? {} : { fromDate: filters.fromDate }),
          ...(filters.toDate === undefined ? {} : { toDate: filters.toDate }), ...(title ? { title } : {}),
        });
        if (cancelled) throw new Error("History read cancelled");
        done = page.isDone || !page.cursor || visited.has(page.cursor) || (!title && page.events.length === 0);
        if (page.cursor) visited.add(page.cursor);
        cursor = page.cursor ?? undefined;
        const entries = scope ? page.events.filter(entry => scope.has(entry.pipeId)) : page.events;
        if (entries.length || done) return { entries, isDone: done };
      }
      return { entries: [], isDone: true };
    },
  };
}

export function mergeHistoryEntries(current: readonly HistoryEntry[], incoming: readonly HistoryEntry[]) {
  return [...new Map([...current, ...incoming].map(entry => [entry.id, entry])).values()]
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
