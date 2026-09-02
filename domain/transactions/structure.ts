import type { TransactionKind } from "./identity";

export type TransactionStructure<PipeId> =
  | { type: "feed"; to: PipeId }
  | { type: "expense"; from: PipeId }
  | { type: "transfer"; from: PipeId; to: PipeId }
  | { type: "payByTransfer"; from: PipeId; paidFrom: PipeId };

type PersistedTransactionRoles<PipeId> = {
  kind: TransactionKind;
  from?: PipeId;
  to?: PipeId;
  paidFrom?: PipeId;
};

export function transactionStructureFromRoles<PipeId>(
  roles: PersistedTransactionRoles<PipeId>,
): TransactionStructure<PipeId> {
  if (
    roles.kind === "feed" &&
    roles.to !== undefined &&
    roles.from === undefined &&
    roles.paidFrom === undefined
  ) {
    return { type: "feed", to: roles.to };
  }
  if (
    roles.kind === "expense" &&
    roles.from !== undefined &&
    roles.to === undefined
  ) {
    return roles.paidFrom === undefined
      ? { type: "expense", from: roles.from }
      : {
          type: "payByTransfer",
          from: roles.from,
          paidFrom: roles.paidFrom,
        };
  }
  if (
    roles.kind === "transfer" &&
    roles.from !== undefined &&
    roles.to !== undefined &&
    roles.paidFrom === undefined
  ) {
    return { type: "transfer", from: roles.from, to: roles.to };
  }
  throw new Error("Invalid transaction structure");
}
