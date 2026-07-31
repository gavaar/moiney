import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    title: v.string(),
    value: v.number(),
    date: v.number(),
    from: v.optional(v.id("pipes")),
    to: v.optional(v.id("pipes")),
    userId: v.id("users"),
  })
    .index("by_from", ["from"])
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),
  users: defineTable({
    username: v.string(),
    email: v.string(),
    password: v.string(),
  }).index("by_username", ["username"]),
  sessions: defineTable({
    userId: v.id("users"),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_refreshTokenHash", ["refreshTokenHash"]),
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
    ]),
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
    rule: v.optional(v.union(v.literal("spend_overflow"), v.literal("any_spend"), v.literal("cron"))),
    // rule options
    capUpdateValue: v.optional(v.number()),
    cronNextDate: v.optional(v.number()),
    cronInterval: v.optional(v.object({
      interval: v.number(),
      unit: v.union(v.literal("days"), v.literal("months"), v.literal("years")),
    })),
  })
    .index("by_userId", ["userId"])
    .index("by_rule_cronNextDate", ["rule", "cronNextDate"]),
});
