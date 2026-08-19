import {
  resolveTransactionKind,
  transactionGroupId,
  type TransactionKind,
} from "@domain/transactions";
import type { TransactionModel } from "@features/transactions/data/transactions";

export type TransactionGroup = {
  id: string;
  kind: TransactionKind;
  transactions: TransactionModel[];
  count: number;
  title: string;
  totalValue: number;
  latestValue: number;
  from: TransactionModel["from"];
  to: TransactionModel["to"];
  oldestDate: number;
  latestDate: number;
};

export type TransactionListItem = TransactionModel | TransactionGroup;

function compareTransactions(
  first: TransactionModel,
  second: TransactionModel,
): number {
  return (
    second.date - first.date ||
    second.createdAt - first.createdAt ||
    second.id.localeCompare(first.id)
  );
}

export function groupTransactions(
  transactions: TransactionModel[],
): TransactionListItem[] {
  const groups = new Map<string, TransactionModel[]>();

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
