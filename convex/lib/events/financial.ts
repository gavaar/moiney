import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { TransactionStructure } from "../../../domain/transactions";
import { insertHistoryOperation, replaceHistoryOperation, type OperationDraft } from "./persistence";

type FinancialOperationInput = {
  userId: Id<"users">;
  occurredAt: number;
  title: string;
  value: number;
  structure: TransactionStructure<Id<"pipes">>;
};

/** Persists history perspectives only; the authorized caller applies accounting once. */
export async function insertFinancialOperation(
  ctx: MutationCtx,
  input: FinancialOperationInput,
): Promise<Id<"events">> {
  const operation = await insertHistoryOperation(ctx, financialOperationDraft(input));
  return operation.canonicalEvent.id;
}

export async function replaceFinancialOperation(
  ctx: MutationCtx,
  operationId: Id<"events">,
  input: FinancialOperationInput,
): Promise<void> {
  await replaceHistoryOperation(ctx, input.userId, operationId, financialOperationDraft(input));
}

function financialOperationDraft(input: FinancialOperationInput): OperationDraft {
  const { structure, ...fields } = input;
  if (structure.type === "feed" || structure.type === "expense") {
    return {
      canonicalEvent: structure.type === "feed"
        ? { ...fields, type: "feed", pipeId: structure.to }
        : { ...fields, type: "transaction", pipeId: structure.from },
    };
  }

  const targetPipeId = structure.type === "transfer" ? structure.to : structure.paidFrom;
  return {
    canonicalEvent: {
      ...fields,
      type: structure.type === "transfer" ? "transfer" : "third_party_transaction",
      pipeId: structure.from,
      targetPipeId,
    },
    counterpart: {
      ...fields,
      type: structure.type === "transfer" ? "transfer" : "transaction",
      pipeId: targetPipeId,
      targetPipeId: structure.from,
      value: -fields.value,
    },
  };
}
