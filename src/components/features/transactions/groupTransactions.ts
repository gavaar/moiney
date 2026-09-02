import {
  resolveTransactionKind,
  transactionGroupId,
  type TransactionKind,
} from "@domain/transactions";
import type { TransactionModel } from "@features/transactions/data/transactions";

export type TransactionGroup = {
  id: string;
  kind: TransactionKind;
  isMixed: boolean;
  transactions: TransactionModel[];
  count: number;
  title: string;
  totalValue: number;
  latestValue: number;
  from: TransactionModel["from"];
  to: TransactionModel["to"];
  paidFrom: TransactionModel["paidFrom"];
  visiblePipeIds: NonNullable<TransactionModel["from"]>[];
  oldestDate: number;
  latestDate: number;
};

type TransactionListItem = TransactionModel | TransactionGroup;

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

type PipeId = NonNullable<TransactionModel["from"]>;

function groupKey(transaction: TransactionModel): string {
  if (resolveTransactionKind(transaction) === "feed") {
    return transactionGroupId(transaction);
  }
  return JSON.stringify(["expense", transaction.title]);
}

function participatingPipeIds(
  transaction: TransactionModel,
  scope: ReadonlySet<PipeId>,
): PipeId[] {
  const kind = resolveTransactionKind(transaction);
  const candidates =
    kind === "feed"
      ? [transaction.to]
      : kind === "transfer"
        ? [transaction.from, transaction.to]
        : [transaction.from, transaction.paidFrom];
  return candidates.filter(
    (pipeId): pipeId is PipeId => pipeId !== undefined && scope.has(pipeId),
  );
}

function transactionValueInScope(
  transaction: TransactionModel,
  scope: ReadonlySet<PipeId>,
): number {
  if (resolveTransactionKind(transaction) === "transfer") return 0;
  return participatingPipeIds(transaction, scope).length > 0
    ? transaction.value
    : 0;
}

function defaultScope(transactions: TransactionModel[]): Set<PipeId> {
  const scope = new Set<PipeId>();
  for (const transaction of transactions) {
    for (const pipeId of [transaction.from, transaction.to, transaction.paidFrom]) {
      if (pipeId !== undefined) scope.add(pipeId);
    }
  }
  return scope;
}

export function groupTransactions(
  transactions: TransactionModel[],
  visiblePipeIds?: readonly PipeId[],
): TransactionListItem[] {
  const scope = new Set(visiblePipeIds ?? defaultScope(transactions));
  const groups = new Map<string, TransactionModel[]>();

  for (const tx of transactions) {
    if (participatingPipeIds(tx, scope).length === 0) continue;
    const key = groupKey(tx);
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
      const kinds = new Set(sortedTransactions.map(resolveTransactionKind));
      const visibleGroupPipeIds = new Set<PipeId>();
      for (const transaction of sortedTransactions) {
        for (const pipeId of participatingPipeIds(transaction, scope)) {
          visibleGroupPipeIds.add(pipeId);
        }
      }
      items.push({
        id,
        kind: resolveTransactionKind(latestTransaction),
        isMixed: kinds.size > 1,
        transactions: sortedTransactions,
        count: sortedTransactions.length,
        title: latestTransaction.title,
        totalValue: sortedTransactions.reduce(
          (sum, tx) => sum + transactionValueInScope(tx, scope),
          0,
        ),
        latestValue: latestTransaction.value,
        from: latestTransaction.from,
        to: latestTransaction.to,
        paidFrom: latestTransaction.paidFrom,
        visiblePipeIds: [...visibleGroupPipeIds].sort(),
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
