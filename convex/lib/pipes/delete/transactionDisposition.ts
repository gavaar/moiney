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
  const roles =
    transaction.kind === "feed"
      ? [{ id: transaction.to, patch: "toIcon" as const }]
      : transaction.kind === "transfer"
        ? [
            { id: transaction.from, patch: "fromIcon" as const },
            { id: transaction.to, patch: "toIcon" as const },
          ]
        : [
            { id: transaction.from, patch: "fromIcon" as const },
            { id: transaction.paidFrom, patch: "paidFromIcon" as const },
          ];

  const patches: TransactionIconPatches = {};
  let hasSurvivingPipe = false;

  for (const role of roles) {
    if (!role.id) continue;
    const pipe = pipes[role.id];
    if (pipe?.status === "survives") {
      hasSurvivingPipe = true;
    } else if (pipe?.icon) {
      patches[role.patch] = pipe.icon;
    }
  }

  const shouldDelete = deleteTransactions && !hasSurvivingPipe;
  return {
    delete: shouldDelete,
    patches: shouldDelete ? {} : patches,
  };
}
