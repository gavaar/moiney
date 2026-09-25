import { resolveTransactionKind } from "@domain/transactions";
import { formatAmount } from "@/lib/format";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "../../data/transactions";

type PipeNamesById = Partial<
  Record<
    PipeModel["id"],
    Pick<PipeModel, "id" | "name" | "pendingFedAdjustment">
  >
>;

export function getTransactionDeletionWarning(
  transaction: TransactionModel,
  pipesById: PipeNamesById,
): { historyOnly: boolean; message: string } {
  const kind = resolveTransactionKind(transaction);
  const roleIds = [transaction.from, transaction.to, transaction.paidFrom].filter(
    (pipeId): pipeId is PipeModel["id"] => pipeId !== undefined,
  );
  const amount = formatAmount(Math.abs(transaction.value));

  if (roleIds.some((pipeId) => !pipesById[pipeId])) {
    const noun = kind === "feed"
      ? "feed"
      : kind === "transfer"
        ? "transfer"
        : transaction.value < 0
          ? "expenditure"
          : "refund";
    return {
      historyOnly: true,
      message: `This transaction belonged to a pipe that does not exist anymore, so deleting it will not roll back any ${noun}.`,
    };
  }

  if (kind === "feed") {
    return {
      historyOnly: false,
      message: `Deleting this transaction will take ${amount} of feed from ${pipesById[transaction.to!]?.name} pipe.`,
    };
  }

  if (kind === "transfer") {
    const fromName = pipesById[transaction.from!]?.name;
    const toName = pipesById[transaction.to!]?.name;
    return {
      historyOnly: false,
      message: transaction.value < 0
        ? `Deleting this transaction will refund ${amount} to ${fromName} pipe and take ${amount} from ${toName} pipe.`
        : `Deleting this transaction will take ${amount} from ${fromName} pipe and refund ${amount} to ${toName} pipe.`,
    };
  }

  const fromName = pipesById[transaction.from!]?.name;
  if (transaction.paidFrom) {
    const paidFromName = pipesById[transaction.paidFrom]?.name;
    return {
      historyOnly: false,
      message: transaction.value < 0
        ? `Deleting this transaction will roll back ${amount} of expenditure from ${fromName} pipe and refund ${amount} to ${paidFromName} pipe.`
        : `Deleting this transaction will take back a ${amount} refund from ${fromName} pipe and take ${amount} from ${paidFromName} pipe.`,
    };
  }

  return {
    historyOnly: false,
    message: transaction.value < 0
      ? `Deleting this transaction will refund ${amount} of expenditure to ${fromName} pipe.`
      : `Deleting this transaction will take back a ${amount} refund from ${fromName} pipe.`,
  };
}
