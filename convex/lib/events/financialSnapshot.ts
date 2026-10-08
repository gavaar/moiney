import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { historyOperationFromEvents } from "../../../domain/events";
import { historyEventFromDocument } from "./persistence";
import type { TransactionWriteResult } from "../transactions/operations";

export type FinancialSnapshot = Omit<TransactionWriteResult, "id" | "createdAt"> & {
  _creationTime: number;
  operationId?: Id<"events">;
  legacyTransactionId?: Id<"transactions">;
};

/** Validates all perspectives before exposing an authoritative action snapshot. */
export async function readFinancialSnapshot(ctx: QueryCtx, userId: Id<"users">, operationId: Id<"events">): Promise<FinancialSnapshot> {
  const entries = await ctx.db.query("events").withIndex("by_operationId", q => q.eq("operationId", operationId)).take(3);
  const canonical = entries.find(entry => entry._id === operationId);
  if (!canonical || canonical.userId !== userId) throw new ConvexError({ code: "OPERATION_NOT_FOUND" });
  const operation = historyOperationFromEvents(entries.map(historyEventFromDocument));
  const event = operation.canonicalEvent;
  if (event.type === "pipe_creation" || event.type === "pipe_deletion") throw new ConvexError({ code: "OPERATION_NOT_FOUND" });
  return {
    operationId, _creationTime: canonical._creationTime,
    title: event.title, value: event.value, date: event.occurredAt,
    ...(event.type === "feed" ? { kind: "feed" as const, to: event.pipeId }
      : event.type === "transfer" ? { kind: "transfer" as const, from: event.pipeId, to: event.targetPipeId }
      : event.type === "third_party_transaction" ? { kind: "expense" as const, from: event.pipeId, paidFrom: event.targetPipeId }
      : { kind: "expense" as const, from: event.pipeId }),
  };
}
