import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { historyOperationFromEvents } from "../../../domain/events";
import { historyEventFromDocument } from "./persistence";

export type CorrectionLink =
  | { status: "ready" | "linked"; operationId: Id<"events"> }
  | { status: "missing_transaction" | "foreign_transaction" | "missing_operation_link" |
      "conflicting_operation_link" | "missing_or_foreign_operation" | "invalid_operation" };

/** Exact linkage only. Audit and backfill share the same acceptance boundary. */
export async function inspectCorrectionOperationLink(
  ctx: QueryCtx,
  correction: Doc<"transactionCorrections">,
): Promise<CorrectionLink> {
  const transaction = await ctx.db.get("transactions", correction.transactionId);
  if (!transaction) return { status: "missing_transaction" };
  if (transaction.userId !== correction.userId) return { status: "foreign_transaction" };
  const operationId = transaction.operationId;
  if (!operationId) return { status: "missing_operation_link" };
  if (correction.operationId && correction.operationId !== operationId) {
    return { status: "conflicting_operation_link" };
  }
  const entries = await ctx.db.query("events")
    .withIndex("by_operationId", q => q.eq("operationId", operationId)).take(3);
  if (entries.length > 2) return { status: "invalid_operation" };
  const canonical = entries.find(entry => entry._id === operationId);
  if (!canonical || canonical.userId !== correction.userId) return { status: "missing_or_foreign_operation" };
  if (canonical.operationId !== operationId || canonical.type === "pipe_creation" || canonical.type === "pipe_deletion") {
    return { status: "invalid_operation" };
  }
  try {
    historyOperationFromEvents(entries.map(historyEventFromDocument));
  } catch {
    return { status: "invalid_operation" };
  }
  return { status: correction.operationId ? "linked" : "ready", operationId };
}
