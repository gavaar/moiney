import { groupTransactions } from "@features/transactions/groupTransactions";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { Doc } from "@convex/_generated/dataModel";

type FlatListItem =
  | { key: string; kind: "single"; transaction: Doc<"transactions"> }
  | { key: string; kind: "group"; group: TransactionGroup; expanded: boolean }
  | { key: string; kind: "child"; transaction: Doc<"transactions"> };

export function buildFlatItems(
  items: ReturnType<typeof groupTransactions>,
  expandedKeys: Set<string>,
): FlatListItem[] {
  const result: FlatListItem[] = [];

  for (const item of items) {
    if ("count" in item) {
      const isExpanded = expandedKeys.has(item.title + item.value + item.from + item.to);
      result.push({
        key: `group-${item.oldestDate}-${item.latestDate}`,
        kind: "group",
        group: item,
        expanded: isExpanded,
      });
      if (isExpanded) {
        for (const tx of item.transactions) {
          result.push({
            key: `child-${tx._id}`,
            kind: "child",
            transaction: tx,
          });
        }
      }
    } else {
      result.push({
        key: `single-${item._id}`,
        kind: "single",
        transaction: item,
      });
    }
  }

  return result;
}
