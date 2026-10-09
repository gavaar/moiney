import type { Id } from "@convex/_generated/dataModel";
import type { TransactionKind } from "@domain/transactions";

export type TransactionModel = {
  id: Id<"events">;
  createdAt: number;
  title: string;
  value: number;
  date: number;
  kind: TransactionKind;
  from?: Id<"pipes">;
  to?: Id<"pipes">;
  paidFrom?: Id<"pipes">;
  fromIcon?: string;
  toIcon?: string;
  paidFromIcon?: string;
  editedAt?: number;
};

/** Loaded perspectives are display-only until the complete operation is read. */
export type TransactionPresentation = Omit<TransactionModel, "id">;
