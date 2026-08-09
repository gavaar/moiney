import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { Id } from './_generated/dataModel';

export const getMyProfile = query({
  args: {},
  returns: v.object({
    username: v.string(),
    pictureUrl: v.union(v.null(), v.string()),
  }),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    let pictureUrl: string | null = null;
    if (user.picture) {
      pictureUrl = await ctx.storage.getUrl(user.picture);
    }

    return { username: user.username, pictureUrl };
  },
});

export const generateProfilePictureUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setProfilePicture = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, { picture: args.storageId });
    if (user.picture) {
      await ctx.storage.delete(user.picture);
    }
    return null;
  },
});

export const removeProfilePicture = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (user.picture) {
      await ctx.storage.delete(user.picture);
      await ctx.db.patch(userId, { picture: undefined });
    }
    return null;
  },
});

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_ORPHAN_DELETIONS_PER_RUN = 100;

export const cleanupOrphanedProfilePictures = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const referenced = new Set<Id<"_storage">>();
    for (const user of await ctx.db.query("users").collect()) {
      if (user.picture) referenced.add(user.picture);
    }

    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const orphans: Array<{ _id: Id<"_storage"> }> = [];

    for await (const file of ctx.db.system.query("_storage")) {
      if (orphans.length >= MAX_ORPHAN_DELETIONS_PER_RUN) break;
      if (referenced.has(file._id)) continue;
      if (file._creationTime >= cutoff) continue;
      orphans.push(file);
    }

    for (const file of orphans) {
      await ctx.storage.delete(file._id);
    }
    return orphans.length;
  },
});