import type { Doc, Id } from "@convex/_generated/dataModel";

export type TransactionGroup = {
  transactions: Doc<"transactions">[];
  count: number;
  title: string;
  value: number;
  from: Id<"pipes"> | undefined;
  to: Id<"pipes"> | undefined;
  oldestDate: number;
  latestDate: number;
};

export type TransactionListItem = Doc<"transactions"> | TransactionGroup;

function compositeKey(tx: Doc<"transactions">): string {
  return `${tx.title}|${tx.value}|${tx.from ?? ""}|${tx.to ?? ""}`;
}

export function groupTransactions(
  transactions: Doc<"transactions">[],
): TransactionListItem[] {
  const groups = new Map<string, Doc<"transactions">[]>();

  for (const tx of transactions) {
    const key = compositeKey(tx);
    const list = groups.get(key);
    if (list) {
      list.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  const items: TransactionListItem[] = [];

  for (const [, txs] of groups) {
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
