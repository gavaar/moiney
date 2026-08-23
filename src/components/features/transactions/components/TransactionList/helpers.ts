import { groupTransactions } from "@features/transactions/groupTransactions";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { TransactionModel } from "@features/transactions/data/transactions";

type FlatListItem =
  | { key: string; kind: "single"; transaction: TransactionModel }
  | { key: string; kind: "group"; group: TransactionGroup; expanded: boolean }
  | { key: string; kind: "child"; transaction: TransactionModel };

export function buildFlatItems(
  items: ReturnType<typeof groupTransactions>,
  expandedKeys: Set<string>,
): FlatListItem[] {
  const result: FlatListItem[] = [];

  for (const item of items) {
    if ("count" in item) {
      const isExpanded = expandedKeys.has(item.id);
      result.push({
        key: `group-${item.id}`,
        kind: "group",
        group: item,
        expanded: isExpanded,
      });
      if (isExpanded) {
        for (const tx of item.transactions) {
          result.push({
            key: `child-${tx.id}`,
            kind: "child",
            transaction: tx,
          });
        }
      }
    } else {
      result.push({
        key: `single-${item.id}`,
        kind: "single",
        transaction: item,
      });
    }
  }

  return result;
}
