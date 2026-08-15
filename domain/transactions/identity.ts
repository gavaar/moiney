export type TransactionKind = "feed" | "expense" | "transfer";

type TransactionRoles = {
  from?: string;
  to?: string;
  paidFrom?: string;
};

type GroupableTransaction = TransactionRoles & {
  kind?: TransactionKind;
  title: string;
  value: number;
};

export function deriveTransactionKind({
  from,
  to,
  paidFrom,
}: TransactionRoles): TransactionKind {
  if (paidFrom && (!from || to)) throw new Error("Invalid transaction roles");
  if (from && to) return "transfer";
  if (from) return "expense";
  if (to) return "feed";
  throw new Error("Invalid transaction roles");
}

export function resolveTransactionKind(
  transaction: TransactionRoles & { kind?: TransactionKind },
): TransactionKind {
  if (!transaction.kind) throw new Error("Transaction kind is required");
  const derived = deriveTransactionKind(transaction);
  if (transaction.kind !== derived) {
    throw new Error("Transaction kind does not match roles");
  }
  return transaction.kind;
}

export function canonicalizeTransactionTitle(title: string): string {
  const canonicalTitle = title.trim().toLowerCase();
  if (!canonicalTitle) throw new Error("Transaction title cannot be empty");
  return canonicalTitle;
}

export function transactionGroupId(transaction: GroupableTransaction): string {
  return JSON.stringify([
    resolveTransactionKind(transaction),
    transaction.title,
    transaction.from ?? null,
    transaction.to ?? null,
  ]);
}
