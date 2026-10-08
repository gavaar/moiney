import { v, type PropertyValidators } from "convex/values";

const identity = {
  userId: v.id("users"),
  pipeId: v.id("pipes"),
  occurredAt: v.number(),
  // Filled with the canonical insert's ID before the mutation commits.
  operationId: v.optional(v.id("events")),
};
const lifecycleFields = {
  name: v.string(),
  icon: v.string(),
  pipeType: v.union(v.literal("feed"), v.literal("boiler"), v.literal("pipe")),
  ancestorIds: v.array(v.id("pipes")),
  parentName: v.optional(v.string()),
  parentIcon: v.optional(v.string()),
};
function eventValidator<Identity extends PropertyValidators, Financial extends PropertyValidators>(identityFields: Identity, financialFields: Financial) {
  const financial = { ...identityFields, title: v.string(), value: v.number(), ...financialFields };
  const lifecycle = { ...identityFields, ...lifecycleFields };

  return v.union(
    v.object({ ...financial, type: v.literal("feed") }),
    v.object({ ...financial, type: v.literal("transaction"), targetPipeId: v.optional(v.id("pipes")) }),
    v.object({ ...financial, type: v.literal("third_party_transaction"), targetPipeId: v.id("pipes") }),
    v.object({ ...financial, type: v.literal("transfer"), targetPipeId: v.id("pipes") }),
    v.object({ ...lifecycle, type: v.literal("pipe_creation") }),
    v.object({ ...lifecycle, type: v.literal("pipe_deletion") }),
  );
}

export const historyEventValidator = eventValidator(identity, {});

/** Public history entries need complete identity, not database ownership metadata. */
const resultIdentity = {
  id: v.id("events"),
  createdAt: v.number(),
  operationId: v.id("events"),
  pipeId: v.id("pipes"),
  occurredAt: v.number(),
};

export const historyEventResultValidator = eventValidator(resultIdentity, { editedAt: v.optional(v.number()) });
export const pipeDeletionResultValidator = v.object({ ...resultIdentity, ...lifecycleFields, type: v.literal("pipe_deletion") });
