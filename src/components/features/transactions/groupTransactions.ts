import type { Id } from "@convex/_generated/dataModel";
import type { TransactionWithPipeIcons } from "@/lib/transactions/types";
import {
  resolveTransactionKind,
  transactionGroupId,
  type TransactionKind,
} from "@domain/transactions";

export type TransactionGroup = {
  id: string;
  kind: TransactionKind;
  transactions: TransactionWithPipeIcons[];
  count: number;
  title: string;
  totalValue: number;
  latestValue: number;
  from: Id<"pipes"> | undefined;
  to: Id<"pipes"> | undefined;
  oldestDate: number;
  latestDate: number;
};

export type TransactionListItem = TransactionWithPipeIcons | TransactionGroup;

function compareTransactions(
  first: TransactionWithPipeIcons,
  second: TransactionWithPipeIcons,
): number {
  return (
    second.date - first.date ||
    second._creationTime - first._creationTime ||
    second._id.localeCompare(first._id)
  );
}

export function groupTransactions(
  transactions: TransactionWithPipeIcons[],
): TransactionListItem[] {
  const groups = new Map<string, TransactionWithPipeIcons[]>();

  for (const tx of transactions) {
    const key = transactionGroupId(tx);
    const list = groups.get(key);
    if (list) {
      list.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  const items: TransactionListItem[] = [];

  for (const [id, txs] of groups) {
    if (txs.length === 1) {
      items.push(txs[0]);
    } else {
      const sortedTransactions = [...txs].sort(compareTransactions);
      const latestTransaction = sortedTransactions[0];
      const oldestDate = sortedTransactions[sortedTransactions.length - 1].date;
      const latestDate = latestTransaction.date;
      items.push({
        id,
        kind: resolveTransactionKind(latestTransaction),
        transactions: sortedTransactions,
        count: sortedTransactions.length,
        title: latestTransaction.title,
        totalValue: sortedTransactions.reduce((sum, tx) => sum + tx.value, 0),
        latestValue: latestTransaction.value,
        from: latestTransaction.from,
        to: latestTransaction.to,
        oldestDate,
        latestDate,
      });
    }
  }

  items.sort((a, b) => {
    const dateA = "count" in a ? a.latestDate : a.date;
    const dateB = "count" in b ? b.latestDate : b.date;
    return dateB - dateA;
  });

  return items;
}
