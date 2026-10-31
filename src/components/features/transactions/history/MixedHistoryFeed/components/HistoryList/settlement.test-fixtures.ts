import type { Id } from "@convex/_generated/dataModel";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";

export const event: SettlementEntry = {
  type: "settlement",
  id: "settled" as Id<"events">,
  operationId: "settled" as Id<"events">,
  pipeId: "groceries" as Id<"pipes">,
  name: "Groceries",
  icon: "cart-outline",
  cause: "manual",
  createdAt: 1,
  occurredAt: 1,
  before: { capacity: 4000, fed: 4000, spent: 7000, pendingFedAdjustment: 500 },
  after: { capacity: 3000, fed: -500, spent: 0, pendingFedAdjustment: 0 },
};
export const coverage = {
  amountCents: 2000,
  pipeId: "donor" as Id<"pipes">,
  name: "Safety net",
  icon: "shield",
  before: { capacity: 6000, fed: 6000, spent: 4000, pendingFedAdjustment: 0 },
  after: { capacity: 6000, fed: 6000, spent: 6000, pendingFedAdjustment: 0 }
};
