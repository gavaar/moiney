import type { TransactionKind } from "./identity";

export type TransactionRole = "from" | "to" | "paidFrom";

export const transactionRoleNames = [
  "from",
  "to",
  "paidFrom",
] as const satisfies readonly TransactionRole[];

export type TransactionRoleInput<PipeId extends string = string> = {
  kind?: TransactionKind;
  from?: PipeId;
  to?: PipeId;
  paidFrom?: PipeId;
};

export type TransactionRoleEntry<PipeId extends string = string> = {
  role: TransactionRole;
  pipeId: PipeId;
};

export function involvedPipeIds<PipeId extends string>(
  transaction: TransactionRoleInput<PipeId>,
): PipeId[] {
  return [transaction.from, transaction.to, transaction.paidFrom].filter(
    (pipeId): pipeId is PipeId => pipeId !== undefined,
  );
}

export function transactionRoleEntries<PipeId extends string>(
  transaction: TransactionRoleInput<PipeId>,
): TransactionRoleEntry<PipeId>[] {
  const roles: TransactionRole[] =
    transaction.kind === "feed"
      ? ["to"]
      : transaction.kind === "transfer"
        ? ["from", "to"]
        : ["from", "paidFrom"];

  return roles.flatMap((role) => {
    const pipeId = transaction[role];
    return pipeId === undefined ? [] : [{ role, pipeId }];
  });
}
