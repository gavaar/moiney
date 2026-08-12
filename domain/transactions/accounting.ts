import { deriveTransactionKind } from "./identity";
import type { TransactionRoleInput } from "./roles";

export type AccountingEffect<PipeId extends string = string> = {
  pipeId: PipeId;
  fedDelta: number;
  spentDelta: number;
};

type FeedAccountingEffects<PipeId extends string> = {
  from?: never;
  to: AccountingEffect<PipeId>;
  paidFrom?: never;
};

type TransferAccountingEffects<PipeId extends string> = {
  from: AccountingEffect<PipeId>;
  to: AccountingEffect<PipeId>;
  paidFrom?: never;
};

type ExpenseAccountingEffects<PipeId extends string> = {
  from: AccountingEffect<PipeId>;
  to?: never;
  paidFrom?: never;
};

type PayByTransferAccountingEffects<PipeId extends string> = {
  from: AccountingEffect<PipeId>;
  to?: never;
  paidFrom: AccountingEffect<PipeId>;
};

export type TransactionAccountingEffects<PipeId extends string = string> =
  | FeedAccountingEffects<PipeId>
  | TransferAccountingEffects<PipeId>
  | ExpenseAccountingEffects<PipeId>
  | PayByTransferAccountingEffects<PipeId>;

type FeedTransactionInput<PipeId extends string> = {
  kind?: "feed";
  from?: undefined;
  to: PipeId;
  paidFrom?: undefined;
};

type TransferTransactionInput<PipeId extends string> = {
  kind?: "transfer";
  from: PipeId;
  to: PipeId;
  paidFrom?: undefined;
};

type ExpenseTransactionInput<PipeId extends string> = {
  kind?: "expense";
  from: PipeId;
  to?: undefined;
  paidFrom?: undefined;
};

type PayByTransferTransactionInput<PipeId extends string> = {
  kind?: "expense";
  from: PipeId;
  to?: undefined;
  paidFrom: PipeId;
};

export function transactionAccountingEffects<PipeId extends string>(
  transaction: FeedTransactionInput<PipeId>,
  value: number,
): FeedAccountingEffects<PipeId>;
export function transactionAccountingEffects<PipeId extends string>(
  transaction: TransferTransactionInput<PipeId>,
  value: number,
): TransferAccountingEffects<PipeId>;
export function transactionAccountingEffects<PipeId extends string>(
  transaction: PayByTransferTransactionInput<PipeId>,
  value: number,
): PayByTransferAccountingEffects<PipeId>;
export function transactionAccountingEffects<PipeId extends string>(
  transaction: ExpenseTransactionInput<PipeId>,
  value: number,
): ExpenseAccountingEffects<PipeId>;
export function transactionAccountingEffects<PipeId extends string>(
  transaction: TransactionRoleInput<PipeId>,
  value: number,
): TransactionAccountingEffects<PipeId>;

export function transactionAccountingEffects<PipeId extends string>(
  transaction: TransactionRoleInput<PipeId>,
  value: number,
): TransactionAccountingEffects<PipeId> {
  const kind = transaction.kind ?? deriveTransactionKind(transaction);

  if (kind === "feed") {
    return {
      to: {
        pipeId: transaction.to!,
        fedDelta: value,
        spentDelta: 0,
      },
    };
  }

  if (kind === "transfer") {
    return {
      from: {
        pipeId: transaction.from!,
        fedDelta: value,
        spentDelta: 0,
      },
      to: {
        pipeId: transaction.to!,
        fedDelta: -value,
        spentDelta: 0,
      },
    };
  }

  if (transaction.paidFrom) {
    return {
      from: {
        pipeId: transaction.from!,
        fedDelta: -value,
        spentDelta: -value,
      },
      paidFrom: {
        pipeId: transaction.paidFrom,
        fedDelta: value,
        spentDelta: 0,
      },
    };
  }

  return {
    from: {
      pipeId: transaction.from!,
      fedDelta: 0,
      spentDelta: -value,
    },
  };
}
