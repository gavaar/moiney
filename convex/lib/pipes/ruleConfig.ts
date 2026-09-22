import { ConvexError, v } from "convex/values";
import { buildPipeRulePatch, RuleConfigurationError } from "../../../domain/pipes/rules";

export const pipeRuleValidator = v.union(
  v.literal("spend_overflow"), v.literal("instant_settlement"),
  v.literal("cron"), v.literal("self_destruct"),
);
export const ruleConfigurationFields = {
  rule: v.optional(v.union(v.null(), pipeRuleValidator)),
  interval: v.optional(v.number()),
  unit: v.optional(v.union(v.literal("days"), v.literal("months"), v.literal("years"))),
  starting: v.optional(v.number()),
  capUpdateValue: v.optional(v.number()),
};

export function rulePatch(...args: Parameters<typeof buildPipeRulePatch>) {
  try {
    return buildPipeRulePatch(...args);
  } catch (error) {
    if (error instanceof RuleConfigurationError) throw new ConvexError({ code: error.message });
    throw error;
  }
}
