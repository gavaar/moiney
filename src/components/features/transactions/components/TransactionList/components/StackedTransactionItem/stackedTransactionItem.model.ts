import type { TransactionGroup } from "@features/transactions/groupTransactions";
import type { PipeCatalogContextValue } from "@features/pipes/context/PipeCatalogContext";
import { colors } from "@/lib/styles";
import { safeIconName } from "@ui/Icon/icons";

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function formatDateRange(oldestDate: number, latestDate: number): string {
  const oldest = new Date(oldestDate);
  const latest = new Date(latestDate);

  const sameYear = oldest.getFullYear() === latest.getFullYear();
  const sameMonth = sameYear && oldest.getMonth() === latest.getMonth();

  if (sameMonth) {
    const oldestLabel = oldest.toLocaleDateString("en-US", MONTH_DAY);
    return `${oldestLabel} - ${latest.getDate()}, ${latest.getFullYear()}`;
  }
  if (sameYear) {
    const oldestLabel = oldest.toLocaleDateString("en-US", MONTH_DAY);
    const latestLabel = latest.toLocaleDateString("en-US", MONTH_DAY);
    return `${oldestLabel} - ${latestLabel}, ${latest.getFullYear()}`;
  }
  const oldestLabel = oldest.toLocaleDateString("en-US", MONTH_DAY_YEAR);
  const latestLabel = latest.toLocaleDateString("en-US", MONTH_DAY_YEAR);
  return `${oldestLabel} - ${latestLabel}`;
}

function getGroupIconColor(group: TransactionGroup): string {
  if (group.visiblePipeIds.length > 1) {
    return colors.text;
  }
  return colors.muted;
}

function getGroupIconName(
  group: TransactionGroup,
  pipesById: PipeCatalogContextValue["pipesById"],
): string {
  if (group.visiblePipeIds.length > 1) return "card-multiple";

  const visiblePipeId = group.visiblePipeIds[0];
  if (!visiblePipeId) return "pipe-disconnected";
  const visiblePipe = pipesById?.[visiblePipeId];
  if (visiblePipe?.icon) {
    return safeIconName(visiblePipe.icon);
  }

  for (const transaction of group.transactions) {
    if (transaction.from === visiblePipeId && transaction.fromIcon) {
      return safeIconName(transaction.fromIcon);
    }
    if (transaction.to === visiblePipeId && transaction.toIcon) {
      return safeIconName(transaction.toIcon);
    }
    if (transaction.paidFrom === visiblePipeId && transaction.paidFromIcon) {
      return safeIconName(transaction.paidFromIcon);
    }
  }
  return "pipe-disconnected";
}

function getBgClass(totalValue: number): string {
  if (totalValue === 0) {
    return "bg-surface";
  }
  return totalValue < 0 ? "bg-error/30" : "bg-success/30";
}

export function getStackedTransactionItemModel(
  group: TransactionGroup,
  { pipesById }: Pick<PipeCatalogContextValue, "pipesById">,
) {
  return {
    groupIconName: getGroupIconName(group, pipesById),
    groupIconColor: getGroupIconColor(group),
    bgClass: getBgClass(group.totalValue),
    dateRange: formatDateRange(group.oldestDate, group.latestDate),
  };
}
