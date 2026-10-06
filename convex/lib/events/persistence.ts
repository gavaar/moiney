import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { historyOperationFromEvents, type HistoryEvent, type HistoryOperation } from "../../../domain/events";

type EventDraft<Event = Doc<"events">> = Event extends Doc<"events">
  ? Omit<Event, "_id" | "_creationTime" | "operationId"> : never;
type OperationDraft = { canonicalEvent: EventDraft; counterpart?: EventDraft };
type PersistedOperation = HistoryOperation<Id<"pipes">, Id<"events">>;

/** Called inside an authorized mutation; eligibility/accounting remain with the caller. */
export async function insertHistoryOperation(
  ctx: MutationCtx,
  draft: OperationDraft,
): Promise<PersistedOperation> {
  const entries = [
    { ...draft.canonicalEvent, id: "canonical", operationId: "canonical" },
    ...(draft.counterpart ? [{ ...draft.counterpart, id: "counterpart", operationId: "canonical" }] : []),
  ];
  historyOperationFromEvents(entries);

  const operationId = await ctx.db.insert("events", draft.canonicalEvent);
  await ctx.db.patch("events", operationId, { operationId });
  const canonicalEvent = { ...draft.canonicalEvent, id: operationId, operationId };
  if (!draft.counterpart) return historyOperationFromEvents<Id<"pipes">, Id<"events">>([canonicalEvent]);
  const counterpartId = await ctx.db.insert("events", { ...draft.counterpart, operationId });
  return historyOperationFromEvents<Id<"pipes">, Id<"events">>([
    canonicalEvent,
    { ...draft.counterpart, id: counterpartId, operationId },
  ]);
}

function eventFromDocument(document: Doc<"events">): HistoryEvent<Id<"pipes">, Id<"events">> {
  const { _id, _creationTime, operationId, ...fields } = document;
  if (!operationId) throw new Error("History event is missing its operation ID");
  return { ...fields, id: _id, operationId };
}

/** A complete write model, not a partial page of history entries. */
export async function readHistoryOperation(
  ctx: QueryCtx,
  userId: Id<"users">,
  eventId: Id<"events">,
): Promise<PersistedOperation | null> {
  const entry = await ctx.db.get("events", eventId);
  if (!entry || entry.userId !== userId) return null;
  if (!entry.operationId) throw new Error("History event is missing its operation ID");
  const entries = await ctx.db.query("events")
    .withIndex("by_operationId", (q) => q.eq("operationId", entry.operationId))
    .take(3);
  return historyOperationFromEvents(entries.map(eventFromDocument));
}
