import { v } from "convex/values";
import type { Infer } from "convex/values";

export const historyFilters = v.object({
  fromDate: v.optional(v.number()),
  toDate: v.optional(v.number()),
  pipeIds: v.optional(v.array(v.id("pipes"))),
  title: v.optional(v.string()),
});
export type HistoryFilters = Infer<typeof historyFilters>;
export const historyTransaction = v.object({
  id: v.id("transactions"),
  createdAt: v.number(),
  title: v.string(),
  value: v.number(),
  date: v.number(),
  kind: v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer")),
  from: v.optional(v.id("pipes")),
  to: v.optional(v.id("pipes")),
  paidFrom: v.optional(v.id("pipes")),
  fromIcon: v.optional(v.string()),
  toIcon: v.optional(v.string()),
  paidFromIcon: v.optional(v.string()),
  editedAt: v.optional(v.number()),
});
export const historyEvent = v.object({
  id: v.id("pipeCreationEvents"),
  pipeId: v.id("pipes"),
  ancestorIds: v.array(v.id("pipes")),
  occurredAt: v.number(),
  name: v.string(),
  icon: v.string(),
  pipeType: v.union(v.literal("feed"), v.literal("boiler"), v.literal("pipe")),
  parentName: v.optional(v.string()),
  parentIcon: v.optional(v.string()),
  deletedAt: v.optional(v.number()),
});
export const historyItem = v.union(
  v.object({ kind: v.literal("transaction"), date: v.number(), transaction: historyTransaction }),
  v.object({ kind: v.literal("pipe"), date: v.number(), event: historyEvent }),
);
export type HistoryItem = Infer<typeof historyItem>;
