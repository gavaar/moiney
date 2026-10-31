import type { Id } from "@convex/_generated/dataModel";

export type HistoryFilters = {
  fromDate?: number;
  toDate?: number;
  pipeIds?: readonly Id<"pipes">[];
  title?: string;
};
