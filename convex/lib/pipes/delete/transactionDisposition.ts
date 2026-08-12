import { transactionRoleEntries } from "../../../../domain/transactions";

export type DeletionPipeState = {
  status?: "survives" | "deleting";
  icon?: string;
};

type TransactionForDeletion = {
  kind: "feed" | "expense" | "transfer";
  from?: string;
  to?: string;
  paidFrom?: string;
};

type TransactionIconPatches = {
  fromIcon?: string;
  toIcon?: string;
  paidFromIcon?: string;
};

type TransactionDisposition = {
  delete: boolean;
  patches: TransactionIconPatches;
};

export function planTransactionDisposition(
  transaction: TransactionForDeletion,
  pipes: Partial<Record<string, DeletionPipeState>>,
  deleteTransactions: boolean,
): TransactionDisposition {
  const patches: TransactionIconPatches = {};
  let hasSurvivingPipe = false;

  for (const role of transactionRoleEntries(transaction)) {
    const pipe = pipes[role.pipeId];
    if (pipe?.status === "survives") {
      hasSurvivingPipe = true;
    } else if (pipe?.icon) {
      patches[`${role.role}Icon`] = pipe.icon;
    }
  }

  const shouldDelete = deleteTransactions && !hasSurvivingPipe;
  return {
    delete: shouldDelete,
    patches: shouldDelete ? {} : patches,
  };
}
