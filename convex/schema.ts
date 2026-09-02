import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    title: v.string(),
    value: v.number(),
    date: v.number(),
    kind: v.union(
      v.literal("feed"),
      v.literal("expense"),
      v.literal("transfer"),
    ),
    from: v.optional(v.id("pipes")),
    to: v.optional(v.id("pipes")),
    paidFrom: v.optional(v.id("pipes")),
    fromIcon: v.optional(v.string()),
    toIcon: v.optional(v.string()),
    paidFromIcon: v.optional(v.string()),
    editedAt: v.optional(v.number()),
    userId: v.id("users"),
  })
    .index("by_from", ["from"])
    .index("by_to", ["to"])
    .index("by_paidFrom", ["paidFrom"])
    .index("by_userId_from_date", ["userId", "from", "date"])
    .index("by_userId_to_date", ["userId", "to", "date"])
    .index("by_userId_paidFrom_date", ["userId", "paidFrom", "date"])
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),
  transactionCorrections: defineTable({
    transactionId: v.id("transactions"),
    userId: v.id("users"),
    editedAt: v.number(),
    previous: v.object({
      title: v.string(),
      value: v.number(),
      date: v.number(),
      kind: v.optional(
        v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer")),
      ),
      from: v.optional(v.id("pipes")),
      to: v.optional(v.id("pipes")),
      paidFrom: v.optional(v.id("pipes")),
    }),
    current: v.object({
      title: v.string(),
      value: v.number(),
      date: v.number(),
      kind: v.optional(
        v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer")),
      ),
      from: v.optional(v.id("pipes")),
      to: v.optional(v.id("pipes")),
      paidFrom: v.optional(v.id("pipes")),
    }),
  }).index("by_transactionId", ["transactionId", "editedAt"]),
  monthlySpendingStats: defineTable({
    userId: v.id("users"),
    periodStart: v.number(),
    grossSpendingCents: v.number(),
    refundCents: v.number(),
    spendingTransactionCount: v.number(),
    refundTransactionCount: v.number(),
    largestSpendingTransactionCents: v.number(),
    totalIncomeCents: v.optional(v.number()),
    volumeCents: v.optional(v.number()),
    producedCents: v.optional(v.number()),
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
    rule: v.optional(
      v.union(
        v.literal("spend_overflow"),
        v.literal("instant_settlement"),
        v.literal("cron"),
      ),
    ),
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
