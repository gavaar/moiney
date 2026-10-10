import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { pipeRuleValidator } from "./lib/pipes/ruleConfig";
import { historyEventValidator } from "./lib/events/validators";
import { correctionSnapshot } from "./lib/events/corrections";

const correctionFields = {
  userId: v.id("users"),
  editedAt: v.number(),
  previous: correctionSnapshot,
  current: correctionSnapshot,
};

export default defineSchema({
  appMetadata: defineTable({
    latestAppVersion: v.string(),
    downloadUrl: v.string(),
  }),
  events: defineTable(historyEventValidator)
    .index("by_operationId", ["operationId"])
    .index("by_userId_pipeId_type", ["userId", "pipeId", "type"])
    .index("by_userId_type", ["userId", "type"])
    .index("by_userId_occurredAt", ["userId", "occurredAt"])
    .index("by_userId_pipeId_occurredAt", ["userId", "pipeId", "occurredAt"]),
  transactionCorrections: defineTable({ ...correctionFields, operationId: v.id("events") })
    .index("by_operationId", ["operationId", "editedAt"]),
  monthlySpendingStats: defineTable({
    userId: v.id("users"),
    periodStart: v.number(),
    grossSpendingCents: v.number(),
    refundCents: v.number(),
    spendingTransactionCount: v.number(),
    refundTransactionCount: v.number(),
    largestSpendingTransactionCents: v.number(),
    nextLargestSpendingCents: v.optional(v.array(v.number())),
    largestSpendingTransactions: v.optional(v.array(v.object({ title: v.string(), amountCents: v.number() }))),
    mostRepeatedTransaction: v.optional(v.union(v.null(), v.object({
      title: v.string(), count: v.number(), netSpendingCents: v.number(),
    }))),
    totalIncomeCents: v.optional(v.number()),
    volumeCents: v.optional(v.number()),
    producedCents: v.optional(v.number()),
    offenders: v.optional(v.array(v.object({
      pipeId: v.string(),
      name: v.string(),
      netSpendingCents: v.number(),
      capacityCents: v.number(),
      overageCents: v.number(),
    }))),
  }).index("by_userId_periodStart", ["userId", "periodStart"]),
  users: defineTable({
    username: v.string(),
    email: v.string(),
    password: v.string(),
    picture: v.optional(v.id("_storage")),
  }).index("by_username", ["username"]),
  sessions: defineTable({
    userId: v.id("users"),
    refreshTokenHash: v.string(),
    familyId: v.optional(v.string()),
    active: v.optional(v.boolean()),
    rotatedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_refreshTokenHash", ["refreshTokenHash"])
    .index("by_familyId", ["familyId"])
    .index("by_familyId_active", ["familyId", "active"])
    .index("by_userId_active", ["userId", "active"]),
  transactionTitleUsage: defineTable({
    pipeId: v.id("pipes"),
    userId: v.id("users"),
    title: v.string(),
    count: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_pipeId_userId_title", ["pipeId", "userId", "title"])
    .index("by_pipeId_userId_count_lastUsedAt", [
      "pipeId",
      "userId",
      "count",
      "lastUsedAt",
    ])
    .index("by_lastUsedAt", ["lastUsedAt"]),
  pipeDeletionJobs: defineTable({
    userId: v.id("users"),
    parentPipeId: v.optional(v.id("pipes")),
    deleteTransactions: v.boolean(),
    memberPipeIds: v.array(v.id("pipes")),
    initialBalance: v.number(),
    historySource: v.optional(v.literal("events")),
    phase: v.union(
      v.literal("processingTransactions"),
      v.literal("readyToFinalize"),
      v.literal("complete"),
    ),
    memberIndex: v.number(),
    role: v.optional(
      v.union(v.literal("from"), v.literal("to"), v.literal("paidFrom")),
    ),
    cursor: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  pipes: defineTable({
    userId: v.id("users"),
    parentId: v.optional(v.id("pipes")),
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
    priority: v.number(),
    capacity: v.number(),
    fed: v.number(),
    spent: v.number(),
    pendingFedAdjustment: v.optional(v.number()),
    sourceType: v.optional(
      v.union(v.literal("feed"), v.literal("boiler")),
    ),
    contributedFed: v.optional(v.number()),
    deletionJobId: v.optional(v.id("pipeDeletionJobs")),
    rule: v.optional(pipeRuleValidator),
    // rule options
    capUpdateValue: v.optional(v.number()),
    cronNextDate: v.optional(v.number()),
    cronInterval: v.optional(
      v.object({
        interval: v.number(),
        unit: v.union(
          v.literal("days"),
          v.literal("months"),
          v.literal("years"),
        ),
      }),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_parentId", ["parentId"])
    .index("by_rule_cronNextDate", ["rule", "cronNextDate"]),
});
