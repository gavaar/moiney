import { v } from "convex/values";

const identity = {
  userId: v.id("users"),
  pipeId: v.id("pipes"),
  occurredAt: v.number(),
  // Filled with the canonical insert's ID before the mutation commits.
  operationId: v.optional(v.id("events")),
};
const financial = { ...identity, title: v.string(), value: v.number() };
const lifecycle = {
  ...identity,
  name: v.string(),
  icon: v.string(),
  pipeType: v.union(v.literal("feed"), v.literal("boiler"), v.literal("pipe")),
  ancestorIds: v.array(v.id("pipes")),
  parentName: v.optional(v.string()),
  parentIcon: v.optional(v.string()),
};

export const historyEventValidator = v.union(
  v.object({ ...financial, type: v.literal("feed") }),
  v.object({ ...financial, type: v.literal("transaction"), targetPipeId: v.optional(v.id("pipes")) }),
  v.object({ ...financial, type: v.literal("third_party_transaction"), targetPipeId: v.id("pipes") }),
  v.object({ ...financial, type: v.literal("transfer"), targetPipeId: v.id("pipes") }),
  v.object({ ...lifecycle, type: v.literal("pipe_creation") }),
  v.object({ ...lifecycle, type: v.literal("pipe_deletion") }),
);
