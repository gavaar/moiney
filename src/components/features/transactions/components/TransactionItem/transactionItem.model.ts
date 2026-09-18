import { resolveTransactionKind, type TransactionKind, transactionStructureFromRoles } from "@domain/transactions";
import type { TransactionModel } from "../../data/transactions";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { safeIconName } from "@ui/Icon/icons";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { PipeCatalogContextValue } from "@features/pipes/context/PipeCatalogContext";

const getBackgroundClass = (kind: TransactionKind, transaction: Pick<TransactionModel, "value" | "paidFrom">) => {
  switch (kind) {
    case "feed":
      return "bg-secondary/30";
    case "transfer":
      return "bg-accent/30";
    default:
      if (transaction.value < 0) {
        return "bg-error/30";
      }
      if (kind === "expense" && !!transaction.paidFrom) {
        return "bg-success/30";
      }
      return "bg-primary/30";
  }
};

const getTransactionIcons = (
  kind: TransactionKind,
  transaction: TransactionModel,
  fromPipe: PipeModel | undefined,
  toPipe: PipeModel | undefined,
  paidFromPipe: PipeModel | undefined,
): { name: string; size: number; color: string }[] => {
  const uiIcons = [];

  const fromIcon = {
    name: safeIconName(fromPipe?.icon ?? transaction.fromIcon ?? "pipe-disconnected"),
    color: fromPipe || transaction.fromIcon ? colors.muted : colors.surface,
    size: 16,
  };
  const toIcon = {
    name: safeIconName(toPipe?.icon ?? transaction.toIcon ?? "pipe-disconnected"),
    color: toPipe || transaction.toIcon ? colors.muted : colors.surface,
    size: 16,
  };
  const paidFromIcon = {
    name: safeIconName(paidFromPipe?.icon ?? transaction.paidFromIcon ?? "pipe-disconnected"),
    color: paidFromPipe || transaction.paidFromIcon ? colors.muted : colors.surface,
    size: 16,
  };
  const connectorIcon = {
    name: safeIconName(transaction.value < 0 ? "ray-start-arrow" : "ray-end-arrow"),
    size: 14,
    color: colors.muted,
  };

  switch (kind) {
    case "feed":
      uiIcons.push(toIcon);
      break;
    case "expense":
      if (transaction.paidFrom) {
        uiIcons.push(paidFromIcon);
        uiIcons.push(connectorIcon);
      }
      uiIcons.push(fromIcon);
      break;
    case "transfer":
      uiIcons.push(fromIcon);
      uiIcons.push(connectorIcon);
      uiIcons.push(toIcon);
      break;
    default:
      break;
  }

  return uiIcons;
};

export const getTransactionItemModel = (
  transaction: TransactionModel,
  { pipesById, childrenByParent, isPaidFromEligible }: Pick<
    PipeCatalogContextValue,
    "pipesById" | "childrenByParent" | "isPaidFromEligible"
  >,
) => {
  const kind = resolveTransactionKind(transaction);
  const viewOnly = !!transaction.fromIcon || !!transaction.toIcon || !!transaction.paidFromIcon;

  const fromPipe = transaction.from ? pipesById?.[transaction.from] : undefined;
  const fromValid = !!fromPipe && !fromPipe.deletionJobId && (childrenByParent.get(fromPipe.id)?.length ?? 0) === 0;

  const toPipe = transaction.to ? pipesById?.[transaction.to] : undefined;
  const toValid = !!toPipe && !toPipe.deletionJobId && toPipe.parentId === undefined;

  const paidFromPipe = transaction.paidFrom ? pipesById?.[transaction.paidFrom] : undefined;
  const paidFromValid =
    !!transaction.from &&
    !!transaction.paidFrom &&
    isPaidFromEligible(
      transaction.from,
      transaction.paidFrom,
      transaction.value,
    );

  const uiIcons = getTransactionIcons(kind, transaction, fromPipe, toPipe, paidFromPipe);

  const primaryPipe = kind === "feed" ? toPipe : fromPipe;
  const formInitState = primaryPipe && !viewOnly ? {
    pipeIcon: primaryPipe.icon,
    pipeName: primaryPipe.name,
    spent: primaryPipe.spent,
    capacity: primaryPipe.capacity,
    title: transaction.title,
    value: formatAmount(transaction.value),
    structure: transactionStructureFromRoles(transaction),
    transactionId: transaction.id,
    date: transaction.date,
  } : undefined;

  return {
    viewOnly,
    formInitState,
    uiIcons,
    disabled: viewOnly || (!!transaction.from && !fromValid) || (!!transaction.to && !toValid) || (!!transaction.paidFrom && !paidFromValid),
    bgClass: getBackgroundClass(kind, transaction),
    primaryPipeId: primaryPipe?.id,
  };
};
