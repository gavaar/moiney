import type { Id, Doc } from "@convex/_generated/dataModel";
import type { TransactionKind } from "@domain/transactions";

export type TransactionModel = {
  id: Id<"transactions">;
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

export function normalizeTransaction(
  transaction: Doc<"transactions">,
): TransactionModel {
  const normalized: TransactionModel = {
    id: transaction._id,
    createdAt: transaction._creationTime,
    title: transaction.title,
    value: transaction.value,
    date: transaction.date,
    kind: transaction.kind,
  };

  if (transaction.from !== undefined) normalized.from = transaction.from;
  if (transaction.to !== undefined) normalized.to = transaction.to;
  if (transaction.paidFrom !== undefined) normalized.paidFrom = transaction.paidFrom;
  if (transaction.fromIcon !== undefined) normalized.fromIcon = transaction.fromIcon;
  if (transaction.toIcon !== undefined) normalized.toIcon = transaction.toIcon;
  if (transaction.paidFromIcon !== undefined) {
    normalized.paidFromIcon = transaction.paidFromIcon;
  }
  if (transaction.editedAt !== undefined) normalized.editedAt = transaction.editedAt;

  return normalized;
}
