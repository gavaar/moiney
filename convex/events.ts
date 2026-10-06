import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { historyEventResultValidator, pipeDeletionResultValidator } from "./lib/events/validators";
import { pageLimit, validateDateRange } from "./lib/historyValidation";

const scopeFields = {
  pipeId: v.optional(v.id("pipes")),
};

function eventQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  scope: { pipeId?: Id<"pipes">; fromDate?: number; toDate?: number },
) {
  return ctx.db.query("events")
    .withIndex(scope.pipeId ? "by_userId_pipeId_occurredAt" : "by_userId_occurredAt", q => {
      const account = q.eq("userId", userId);
      const range = scope.pipeId ? account.eq("pipeId", scope.pipeId) : account;
      return range.gte("occurredAt", scope.fromDate ?? -Number.MAX_VALUE)
        .lte("occurredAt", scope.toDate ?? Number.MAX_VALUE);
    }).order("desc");
}

function eventResult(event: Extract<Doc<"events">, { type: "pipe_deletion" }>): Infer<typeof pipeDeletionResultValidator>;
function eventResult(event: Doc<"events">): Infer<typeof historyEventResultValidator>;
function eventResult(event: Doc<"events">) {
  const { _id, _creationTime, userId: _userId, operationId, ...fields } = event;
  if (!operationId) throw new Error("History event is missing its operation ID");
  return { id: _id, createdAt: _creationTime, operationId, ...fields };
}

/** A stored-entry window, not an expanded or grouped operation list. */
export const latest = query({
  args: scopeFields,
  returns: v.array(historyEventResultValidator),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const entries = await eventQuery(ctx, userId, args).take(30);
    return entries.map(eventResult);
  },
});

export const list = query({
  args: {
    ...scopeFields,
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  returns: v.object({
    events: v.array(historyEventResultValidator),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    validateDateRange(args);
    const limit = pageLimit(args.limit);
    const page = await eventQuery(ctx, userId, args)
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    const title = args.title?.trim().toLowerCase() ?? "";
    const entries = page.page.map(eventResult);
    return {
      events: title ? entries.filter(event =>
        ("title" in event ? event.title : event.name).toLowerCase().includes(title)) : entries,
      cursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** Archive metadata must remain discoverable outside the financial date window. */
export const deletedPipes = query({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.object({ events: v.array(pipeDeletionResultValidator), cursor: v.union(v.string(), v.null()), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const page = await ctx.db.query("events")
      .withIndex("by_userId_type", q => q.eq("userId", userId).eq("type", "pipe_deletion"))
      .order("desc").paginate({ cursor: args.cursor ?? null, numItems: pageLimit(args.limit) });
    return {
      events: page.page.map(event => {
        if (event.type !== "pipe_deletion") throw new Error("Invalid deletion catalog entry");
        return eventResult(event);
      }),
      cursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
