import { transactionRoleEntries } from "../../../../domain/transactions";

export type DeletionPipeState = {
  status?: "survives" | "deleting";
};

type TransactionForDeletion = {
  kind: "feed" | "expense" | "transfer";
  from?: string;
  to?: string;
  paidFrom?: string;
};

type TransactionDisposition = {
  delete: boolean;
};

export function planTransactionDisposition(
  transaction: TransactionForDeletion,
  pipes: Partial<Record<string, DeletionPipeState>>,
  deleteTransactions: boolean,
): TransactionDisposition {
  let hasSurvivingPipe = false;

  for (const role of transactionRoleEntries(transaction)) {
    const pipe = pipes[role.pipeId];
    if (pipe?.status === "survives") {
      hasSurvivingPipe = true;
    }
  }

  const shouldDelete = deleteTransactions && !hasSurvivingPipe;
  return {
    delete: shouldDelete,
  };
}
