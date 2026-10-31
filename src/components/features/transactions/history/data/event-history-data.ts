import type { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import type { HistoryFilters } from "./history-filters";
import type { HistoryEntry } from "../events/event-groups";
import type { DeletedPipeEntry } from "@features/pipes/data/deletedPipes";
import { recognizedHistoryEntries } from "../events/event-types";
import { preservedPipeScope } from "@domain/pipes/preservedScope";

/** One indexed window per unique pipe; grouping sees only the newest 30 overall. */
export async function readLatestEvents(client: ConvexReactClient, filters: HistoryFilters, deleted: readonly DeletedPipeEntry[], isActive: () => boolean) {
  const scope = filters.pipeIds?.length ? preservedPipeScope(filters.pipeIds, deleted) : undefined;
  const pipeIds = scope ? [...scope] : [undefined];
  let entries: HistoryEntry[] = [];
  for (let offset = 0; offset < pipeIds.length; offset += 8) {
    if (!isActive()) throw new Error("History read cancelled");
    const pages = await Promise.all(pipeIds.slice(offset, offset + 8).map(pipeId =>
      client.query(api.events.latest, pipeId ? { pipeId } : {})));
    if (!isActive()) throw new Error("History read cancelled");
    entries = mergeStoredEntries(entries, pages.flat()).slice(0, 30);
  }
  return recognizedHistoryEntries(entries);
}

/** Only the main stream supplies visible members; the catalog supplies scope metadata. */
export function createEventHistoryReader(client: ConvexReactClient, filters: HistoryFilters, deleted: readonly DeletedPipeEntry[]) {
  const scope = filters.pipeIds?.length ? preservedPipeScope(filters.pipeIds, deleted) : undefined;
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
          limit,
          ...(cursor ? { cursor } : {}),
          ...(pipeId ? { pipeId } : {}),
          ...(filters.fromDate === undefined ? {} : { fromDate: filters.fromDate }),
          ...(filters.toDate === undefined ? {} : { toDate: filters.toDate }),
          ...(title ? { title } : {}),
        });
        if (cancelled) throw new Error("History read cancelled");
        done = page.isDone || !page.cursor || visited.has(page.cursor);
        if (page.cursor) visited.add(page.cursor);
        cursor = page.cursor ?? undefined;
        const recognized = recognizedHistoryEntries(page.events);
        const entries = scope ? recognized.filter(entry => scope.has(entry.pipeId)) : recognized;
        if (entries.length || done) return { entries, isDone: done };
      }
      return { entries: [], isDone: true };
    },
  };
}

export function mergeHistoryEntries(current: readonly HistoryEntry[], incoming: readonly HistoryEntry[]) {
  return recognizedHistoryEntries(mergeStoredEntries(current, incoming));
}

function mergeStoredEntries(current: readonly HistoryEntry[], incoming: readonly HistoryEntry[]) {
  return [...new Map([...current, ...incoming].map(entry => [entry.id, entry])).values()]
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
