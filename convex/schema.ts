import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
});
