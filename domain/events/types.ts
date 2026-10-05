type EventIdentity<PipeId extends string, EventId extends string> = {
  id: EventId;
  /** The canonical entry's ID, shared by every entry in this operation. */
  operationId: EventId;
  userId: string;
  pipeId: PipeId;
  occurredAt: number;
};

type FinancialFields = {
  title: string;
  /** Signed history value in integer cents, not a per-entry accounting delta. */
  value: number;
};

export type FeedEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & FinancialFields & {
    type: "feed";
    targetPipeId?: never;
  };

export type OrdinaryTransactionEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & FinancialFields & {
    type: "transaction";
    targetPipeId?: never;
  };

export type PaymentTransactionEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & FinancialFields & {
    type: "transaction";
    targetPipeId: PipeId;
  };

export type ThirdPartyTransactionEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & FinancialFields & {
    type: "third_party_transaction";
    targetPipeId: PipeId;
  };

export type TransferEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & FinancialFields & {
    type: "transfer";
    targetPipeId: PipeId;
  };

type PipeLifecycleFields<PipeId extends string> = {
  name: string;
  icon: string;
  pipeType: "feed" | "boiler" | "pipe";
  ancestorIds: readonly PipeId[];
  parentName?: string;
  parentIcon?: string;
  title?: never;
  value?: never;
  targetPipeId?: never;
};

export type PipeLifecycleEvent<PipeId extends string = string, EventId extends string = string> =
  EventIdentity<PipeId, EventId> & PipeLifecycleFields<PipeId> & (
    | { type: "pipe_creation" }
    | { type: "pipe_deletion" }
  );

export type FinancialEvent<PipeId extends string = string, EventId extends string = string> =
  | FeedEvent<PipeId, EventId>
  | OrdinaryTransactionEvent<PipeId, EventId>
  | PaymentTransactionEvent<PipeId, EventId>
  | ThirdPartyTransactionEvent<PipeId, EventId>
  | TransferEvent<PipeId, EventId>;

export type HistoryEvent<PipeId extends string = string, EventId extends string = string> =
  | FinancialEvent<PipeId, EventId>
  | PipeLifecycleEvent<PipeId, EventId>;

/** A complete operation for writes, not a potentially partial history page. */
export type HistoryOperation<PipeId extends string = string, EventId extends string = string> =
  | {
    canonicalEvent:
      | FeedEvent<PipeId, EventId>
      | OrdinaryTransactionEvent<PipeId, EventId>
      | PipeLifecycleEvent<PipeId, EventId>;
    counterpart?: never;
  }
  | {
    canonicalEvent: TransferEvent<PipeId, EventId>;
    counterpart: TransferEvent<PipeId, EventId>;
  }
  | {
    canonicalEvent: ThirdPartyTransactionEvent<PipeId, EventId>;
    counterpart: PaymentTransactionEvent<PipeId, EventId>;
  };
