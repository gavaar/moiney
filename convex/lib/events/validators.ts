import { v, type PropertyValidators } from "convex/values";

const identity = {
  userId: v.id("users"),
  pipeId: v.id("pipes"),
  occurredAt: v.number(),
  // Filled with the canonical insert's ID before the mutation commits.
  operationId: v.optional(v.id("events")),
};
function eventValidator<Identity extends PropertyValidators>(identityFields: Identity) {
  const financial = { ...identityFields, title: v.string(), value: v.number() };
  const lifecycle = {
    ...identityFields,
    name: v.string(),
    icon: v.string(),
    pipeType: v.union(v.literal("feed"), v.literal("boiler"), v.literal("pipe")),
    ancestorIds: v.array(v.id("pipes")),
    parentName: v.optional(v.string()),
    parentIcon: v.optional(v.string()),
  };

  return v.union(
    v.object({ ...financial, type: v.literal("feed") }),
    v.object({ ...financial, type: v.literal("transaction"), targetPipeId: v.optional(v.id("pipes")) }),
    v.object({ ...financial, type: v.literal("third_party_transaction"), targetPipeId: v.id("pipes") }),
    v.object({ ...financial, type: v.literal("transfer"), targetPipeId: v.id("pipes") }),
    v.object({ ...lifecycle, type: v.literal("pipe_creation") }),
    v.object({ ...lifecycle, type: v.literal("pipe_deletion") }),
  );
}

export const historyEventValidator = eventValidator(identity);

/** Public history entries need complete identity, not database ownership metadata. */
export const historyEventResultValidator = eventValidator({
  id: v.id("events"),
  createdAt: v.number(),
  operationId: v.id("events"),
  pipeId: v.id("pipes"),
  occurredAt: v.number(),
});
