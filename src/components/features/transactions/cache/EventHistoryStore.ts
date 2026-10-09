import type { HistoryEntry } from "../history/event-groups";
import { validateTransactionAmount } from "@domain/money/money";

export type EventHistorySnapshot = { entries: HistoryEntry[]; complete: boolean; hasMore: boolean; updatedAt: number; generation: number };
export const EMPTY_EVENT_HISTORY: EventHistorySnapshot = { entries: [], complete: false, hasMore: false, updatedAt: 0, generation: 0 };

export type EventHistoryStorage = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export class EventHistoryStore {
  private entries: { entry: HistoryEntry; refreshedAt: number }[] = [];
  private snapshot = EMPTY_EVENT_HISTORY;
  private writes: Promise<void> = Promise.resolve();
  private readonly storageKey: string;

  constructor(private readonly accountKey: string, private readonly storage: EventHistoryStorage) {
    this.storageKey = `event-history:${accountKey}`;
  }

  async hydrate() {
    const generation = this.snapshot.generation;
    // This account's transaction-only snapshot is no longer read or written.
    await this.enqueue(() => this.storage.remove(this.accountKey));
    try {
      const serialized = await this.storage.read(this.storageKey);
      if (generation !== this.snapshot.generation) return;
      const value: unknown = serialized ? JSON.parse(serialized) : null;
      if (!isRecord(value) || value.version !== 1 || value.accountKey !== this.accountKey ||
        !Array.isArray(value.entries) || value.entries.length > 300 ||
        !value.entries.every(isCachedEntry) || new Set(value.entries.map(item => item.entry.id)).size !== value.entries.length ||
        typeof value.hasMore !== "boolean" || typeof value.complete !== "boolean" || !finite(value.updatedAt)) return;
      this.entries = value.entries;
      this.snapshot = { entries: this.entries.map(item => item.entry).sort(compareEntries), complete: value.complete, hasMore: value.hasMore, updatedAt: value.updatedAt, generation: this.snapshot.generation };
    } catch {
      // Device cache failures are cache misses, not server-data failures.
    }
  }

  read(): EventHistorySnapshot { return this.snapshot; }

  mergeHead(entries: HistoryEntry[], hasMore: boolean, now = Date.now(), generation = this.snapshot.generation) {
    if (generation !== this.snapshot.generation) return Promise.resolve();
    return this.write(entries, hasMore && (!this.snapshot.complete || this.snapshot.hasMore), now, hasMore && this.snapshot.complete);
  }

  append(entries: HistoryEntry[], hasMore: boolean, now = Date.now(), generation = this.snapshot.generation) {
    if (generation !== this.snapshot.generation) return Promise.resolve();
    return this.write(entries, hasMore || (this.entries.length === 300 && this.snapshot.hasMore), now, true);
  }

  invalidate() {
    this.entries = [];
    this.snapshot = { ...EMPTY_EVENT_HISTORY, updatedAt: this.snapshot.updatedAt, generation: this.snapshot.generation + 1 };
    return this.persist();
  }

  clear() {
    this.entries = [];
    this.snapshot = { ...EMPTY_EVENT_HISTORY, generation: this.snapshot.generation + 1 };
    return this.enqueue(() => this.storage.remove(this.storageKey));
  }

  private write(entries: HistoryEntry[], hasMore: boolean, now: number, preserve: boolean) {
    const byId = new Map((preserve ? this.entries : []).map(item => [item.entry.id, item]));
    for (const entry of entries) byId.set(entry.id, { entry, refreshedAt: now });
    const ordered = [...byId.values()].sort((a, b) => b.refreshedAt - a.refreshedAt || compareEntries(a.entry, b.entry));
    this.entries = ordered.slice(0, 300);
    this.snapshot = {
      entries: this.entries.map(item => item.entry).sort(compareEntries), complete: ordered.length <= 300 && (!preserve || this.snapshot.complete),
      hasMore: hasMore || ordered.length > 300, updatedAt: now,
      generation: this.snapshot.generation,
    };
    return this.persist();
  }

  private persist() {
    const value = JSON.stringify({ version: 1, accountKey: this.accountKey, entries: this.entries,
      complete: this.snapshot.complete, hasMore: this.snapshot.hasMore, updatedAt: this.snapshot.updatedAt });
    return this.enqueue(() => this.storage.write(this.storageKey, value));
  }

  private enqueue(write: () => Promise<void>) {
    this.writes = this.writes.then(write).catch(() => undefined);
    return this.writes;
  }
}

function compareEntries(a: HistoryEntry, b: HistoryEntry) {
  return b.occurredAt - a.occurredAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function isCachedEntry(value: unknown): value is { entry: HistoryEntry; refreshedAt: number } {
  if (!isRecord(value) || !finite(value.refreshedAt) || !isRecord(value.entry)) return false;
  const entry = value.entry;
  if (![entry.id, entry.operationId, entry.pipeId].every(id => typeof id === "string" && id.length > 0) || !finite(entry.createdAt) || !finite(entry.occurredAt)) return false;
  if (entry.type === "pipe_creation" || entry.type === "pipe_deletion") {
    return typeof entry.name === "string" && typeof entry.icon === "string" &&
      ["feed", "boiler", "pipe"].includes(String(entry.pipeType)) &&
      Array.isArray(entry.ancestorIds) && entry.ancestorIds.every(id => typeof id === "string") &&
      (entry.parentName === undefined || typeof entry.parentName === "string") &&
      (entry.parentIcon === undefined || typeof entry.parentIcon === "string");
  }
  if (typeof entry.title !== "string" || !finite(entry.value) || (entry.editedAt !== undefined && !finite(entry.editedAt))) return false;
  try { validateTransactionAmount(entry.value, entry.type === "feed" ? "feed" : "transaction"); } catch { return false; }
  if (entry.type === "feed") return entry.targetPipeId === undefined;
  if (entry.type === "transaction") return entry.targetPipeId === undefined || typeof entry.targetPipeId === "string";
  return (entry.type === "third_party_transaction" || entry.type === "transfer") && typeof entry.targetPipeId === "string";
}
