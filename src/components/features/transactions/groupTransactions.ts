import type { Id } from "@convex/_generated/dataModel";
import type { TransactionWithPipeIcons } from "@/lib/transactions/types";
import {
  resolveTransactionKind,
  transactionGroupId,
  type TransactionKind,
} from "@/lib/transactions/identity";

export type TransactionGroup = {
  id: string;
  kind: TransactionKind;
  transactions: TransactionWithPipeIcons[];
  count: number;
  title: string;
  value: number;
  from: Id<"pipes"> | undefined;
  to: Id<"pipes"> | undefined;
  oldestDate: number;
  latestDate: number;
};

export type TransactionListItem = TransactionWithPipeIcons | TransactionGroup;

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
      let oldestDate = txs[0].date;
      let latestDate = txs[0].date;
      for (const tx of txs) {
        if (tx.date < oldestDate) oldestDate = tx.date;
        if (tx.date > latestDate) latestDate = tx.date;
      }
      const first = txs[0];
      items.push({
        id,
        kind: resolveTransactionKind(first),
        transactions: txs,
        count: txs.length,
        title: first.title,
        value: first.value,
        from: first.from,
        to: first.to,
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
