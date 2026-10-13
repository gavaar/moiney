import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type HistoryEntry = FunctionReturnType<typeof api.events.list>["events"][number];

const supportedTypes: Record<HistoryEntry["type"], true> = {
  feed: true,
  transaction: true,
  third_party_transaction: true,
  transfer: true,
  pipe_creation: true,
  pipe_deletion: true,
};

/** New server event types are not financial fallbacks in an older app. */
export function isKnownHistoryEventType(type: unknown): type is HistoryEntry["type"] {
  return typeof type === "string" && Object.hasOwn(supportedTypes, type);
}

export function recognizedHistoryEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries.filter(entry => isKnownHistoryEventType(entry.type));
}
