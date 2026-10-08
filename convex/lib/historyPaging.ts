import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { HistoryFilters } from "./historyContracts";
import { MAX_PIPES_PER_USER } from "./constants";
import { validateDateRange } from "./historyValidation";

export function validateFilters(filters: HistoryFilters) {
  validateDateRange(filters);
  if ((filters.pipeIds?.length ?? 0) > MAX_PIPES_PER_USER) throw new ConvexError({ code: "TOO_MANY_PIPE_FILTERS" });
}

export function transactionQuery(
  ctx: QueryCtx, userId: Id<"users">, filters: HistoryFilters,
  role?: "from" | "to" | "paidFrom", pipeId?: Id<"pipes">,
) {
  return ctx.db.query("transactions")
    .withIndex(role ? `by_userId_${role}_date` : "by_userId_date", (q) => {
      const account = q.eq("userId", userId);
      const scope = role ? account.eq(role, pipeId) : account;
      return scope.gte("date", filters.fromDate ?? -Number.MAX_VALUE).lte("date", filters.toDate ?? Number.MAX_VALUE);
    }).order("desc");
}

export async function hasArchiveTransactions(ctx: QueryCtx, userId: Id<"users">, pipeId: Id<"pipes">) {
  for (const role of ["from", "to", "paidFrom"] as const) {
    if (await transactionQuery(ctx, userId, {}, role, pipeId).first()) return true;
  }
  return false;
}

export function transactionDTO(tx: Doc<"transactions">) {
  const { _id, _creationTime, userId: _userId, ...fields } = tx;
  return { ...fields, id: _id, createdAt: _creationTime };
}
