import { query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { historyFilters, historyItem, historyTransaction, type HistoryItem } from "./lib/historyContracts";
import { hasArchiveTransactions, pageLimit, transactionQuery, transactionDTO, validateFilters } from "./lib/historyPaging";

async function eventDTO(ctx: QueryCtx, event: Doc<"pipeCreationEvents">) {
  const pipe = event.deletedAt === undefined ? await ctx.db.get("pipes", event.pipeId) : null;
  const parentId = event.ancestorIds.at(-1);
  const parent = parentId ? await ctx.db.get("pipes", parentId) : null;
  return {
    id: event._id,
    pipeId: event.pipeId,
    ancestorIds: event.ancestorIds,
    occurredAt: event.occurredAt,
    name: pipe?.name ?? event.name,
    icon: pipe?.icon ?? event.icon,
    pipeType: event.pipeType,
    parentName: parent?.name ?? event.parentName,
    parentIcon: parent?.icon ?? event.parentIcon,
    deletedAt: event.deletedAt,
  };
}

export const list = query({
  args: { source: v.optional(v.union(v.literal("transactions"), v.literal("events"))), cursor: v.optional(v.string()), limit: v.optional(v.number()), filters: v.optional(historyFilters) },
  returns: v.object({
    items: v.array(historyItem), cursor: v.union(v.string(), v.null()), isDone: v.boolean(),
    transactionPage: v.optional(v.object({ transactions: v.array(historyTransaction), hasMore: v.boolean() })),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const filters = args.filters ?? {};
    validateFilters(filters);
    const limit = pageLimit(args.limit);
    const pagination = { numItems: limit, cursor: args.cursor ?? null };
    const items: HistoryItem[] = [];
    const emitted = new Set<string>();
    const selected = new Set(filters.pipeIds ?? []);
    const title = filters.title?.trim().toLowerCase() ?? "";
    const matchesEvent = (event: Doc<"pipeCreationEvents">) => selected.size === 0 || selected.has(event.pipeId) || event.ancestorIds.some((id) => selected.has(id));
    const eventByPipe = new Map<Id<"pipes">, Doc<"pipeCreationEvents"> | null>();
    const liveByPipe = new Map<Id<"pipes">, boolean>();
    const addEvent = async (event: Doc<"pipeCreationEvents">, date: number) => {
      if (emitted.has(event._id)) return;
      emitted.add(event._id);
      items.push({ kind: "pipe", date, event: await eventDTO(ctx, event) });
    };
    if (args.source === "events") {
      const page = await ctx.db.query("pipeCreationEvents")
        .withIndex("by_userId_occurredAt", (q) => q.eq("userId", userId)
          .gte("occurredAt", filters.fromDate ?? -Number.MAX_VALUE)
          .lte("occurredAt", filters.toDate ?? Number.MAX_VALUE))
        .order("desc").paginate(pagination);
      for (const event of page.page) {
        if (!matchesEvent(event)) continue;
        // A nonempty archive is placed by matching transaction dates, never its creation date.
        if (event.deletedAt !== undefined && await hasArchiveTransactions(ctx, userId, event.pipeId)) continue;
        const display = await eventDTO(ctx, event);
        if (title && !display.name.toLowerCase().includes(title)) continue;
        items.push({ kind: "pipe", date: event.occurredAt, event: display });
      }
      return { items, isDone: page.isDone, cursor: page.isDone ? null : page.continueCursor };
    }
    const page = await transactionQuery(ctx, userId, filters).paginate(pagination);
    for (const tx of page.page) {
        if (title && !tx.title.toLowerCase().includes(title)) continue;
        const roleIds = [...new Set([tx.from, tx.to, tx.paidFrom].filter((id): id is Id<"pipes"> => id !== undefined))];
        let liveMatch = false;
        let archived = false;
        for (const pipeId of roleIds) {
          if (!eventByPipe.has(pipeId)) eventByPipe.set(pipeId, await ctx.db.query("pipeCreationEvents").withIndex("by_pipeId", (q) => q.eq("pipeId", pipeId)).unique());
          const event = eventByPipe.get(pipeId);
           if (event?.userId === userId && event.deletedAt !== undefined) {
            archived = true;
            if (matchesEvent(event)) await addEvent(event, tx.date);
          } else {
             if (!liveByPipe.has(pipeId)) liveByPipe.set(pipeId, (await ctx.db.get("pipes", pipeId))?.userId === userId);
            if (liveByPipe.get(pipeId) && (selected.size === 0 || selected.has(pipeId))) liveMatch = true;
          }
        }
        // Legacy orphan rows without recoverable creation events remain readable.
        if (liveMatch || (!archived && (selected.size === 0 || roleIds.some((id) => selected.has(id))))) {
          items.push({ kind: "transaction", date: tx.date, transaction: transactionDTO(tx) });
        }
    }
    const unfiltered = filters.fromDate === undefined && filters.toDate === undefined && selected.size === 0 && title === "";
    return {
      items, isDone: page.isDone, cursor: page.isDone ? null : page.continueCursor,
      transactionPage: unfiltered ? { transactions: page.page.map(transactionDTO), hasMore: !page.isDone } : undefined,
    };
  },
});

export const archivePage = query({
  args: {
    eventId: v.id("pipeCreationEvents"), cursor: v.optional(v.string()),
    limit: v.optional(v.number()), filters: v.optional(historyFilters),
    summaryOnly: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("from"), v.literal("to"), v.literal("paidFrom"))),
  },
  returns: v.object({
    transactions: v.array(historyTransaction), count: v.number(), spent: v.number(),
    oldestDate: v.union(v.number(), v.null()), latestDate: v.union(v.number(), v.null()),
    cursor: v.union(v.string(), v.null()), isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const event = await ctx.db.get("pipeCreationEvents", args.eventId);
    if (!event || event.userId !== userId || event.deletedAt === undefined) {
      throw new ConvexError({ code: "PIPE_ARCHIVE_NOT_FOUND" });
    }
    const filters = args.filters ?? {};
    validateFilters(filters);
    const limit = pageLimit(args.limit);
    const role = args.role ?? "from";
    const page = await transactionQuery(ctx, userId, filters, role, event.pipeId)
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    const title = filters.title?.trim().toLowerCase() ?? "";
    // Partition overlapping roles so cross-stream counts and sums are exact.
    const matches = page.page.filter((tx) =>
      (role === "from" || tx.from !== event.pipeId) &&
      (role !== "paidFrom" || tx.to !== event.pipeId) &&
      (!title || tx.title.toLowerCase().includes(title)));
    return {
      transactions: args.summaryOnly ? [] : matches.map(transactionDTO),
      count: matches.length,
      spent: matches.reduce((total, tx) => total + (tx.kind === "expense" &&
        (tx.from === event.pipeId || tx.paidFrom === event.pipeId) ? -tx.value : 0), 0),
      oldestDate: matches.at(-1)?.date ?? null,
      latestDate: matches[0]?.date ?? null,
      isDone: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
