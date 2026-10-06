import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { TransactionStructure } from "../../../domain/transactions";
import { insertHistoryOperation } from "./persistence";

/** Persists history perspectives only; the authorized caller applies accounting once. */
export async function insertFinancialOperation(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    occurredAt: number;
    title: string;
    value: number;
    structure: TransactionStructure<Id<"pipes">>;
  },
): Promise<Id<"events">> {
  const { structure, ...fields } = input;
  if (structure.type === "feed" || structure.type === "expense") {
    const operation = await insertHistoryOperation(ctx, {
      canonicalEvent: structure.type === "feed"
        ? { ...fields, type: "feed", pipeId: structure.to }
        : { ...fields, type: "transaction", pipeId: structure.from },
    });
    return operation.canonicalEvent.id;
  }

  const targetPipeId = structure.type === "transfer" ? structure.to : structure.paidFrom;
  const operation = await insertHistoryOperation(ctx, {
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
  });
  return operation.canonicalEvent.id;
}
