import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  type MutationCtx,
} from "./_generated/server";

const rotationResultValidator = v.union(
  v.object({ status: v.literal("invalid") }),
  v.object({ status: v.literal("expired") }),
  v.object({ status: v.literal("replayed") }),
  v.object({
    status: v.literal("rotated"),
    userId: v.id("users"),
    sessionId: v.id("sessions"),
  }),
);

const MAX_ACTIVE_SESSIONS = 10;
const SESSION_CLEANUP_PAGE_SIZE = 100;

type SessionCleanupContinuation = {
  now: number;
  cursor?: string;
};

function scheduleSessionCleanup(
  ctx: MutationCtx,
  args: SessionCleanupContinuation,
): Promise<unknown> {
  return ctx.scheduler.runAfter(0, internal.sessions.cleanupExpired, args);
}

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    familyId: v.string(),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId_active", (q) =>
        q.eq("userId", args.userId).eq("active", true),
      )
      .order("asc")
      .take(MAX_ACTIVE_SESSIONS);
    if (activeSessions.length === MAX_ACTIVE_SESSIONS) {
      await ctx.db.patch("sessions", activeSessions[0]._id, {
        active: false,
        revokedAt: Date.now(),
      });
    }

    return await ctx.db.insert("sessions", {
      ...args,
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const rotateRefreshToken = internalMutation({
  args: {
    refreshTokenHash: v.string(),
    replacementTokenHash: v.string(),
    replacementExpiresAt: v.number(),
  },
  returns: rotationResultValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refreshTokenHash", (q) =>
        q.eq("refreshTokenHash", args.refreshTokenHash),
      )
      .unique();

    if (!session?.familyId) return { status: "invalid" } as const;
    if (
      session.active !== true ||
      session.revokedAt !== undefined ||
      session.rotatedAt !== undefined
    ) {
      if (session.rotatedAt === undefined && session.revokedAt === undefined) {
        return { status: "invalid" } as const;
      }
      const activeSession = await ctx.db
        .query("sessions")
        .withIndex("by_familyId_active", (q) =>
          q.eq("familyId", session.familyId).eq("active", true),
        )
        .unique();
      if (activeSession) {
        await ctx.db.patch("sessions", activeSession._id, {
          active: false,
          revokedAt: Date.now(),
        });
      }
      return { status: "replayed" } as const;
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      await ctx.db.patch("sessions", session._id, {
        active: false,
        revokedAt: now,
      });
      return { status: "expired" } as const;
    }

    await ctx.db.patch("sessions", session._id, {
      active: false,
      rotatedAt: now,
    });
    const sessionId = await ctx.db.insert("sessions", {
      userId: session.userId,
      familyId: session.familyId,
      active: true,
      refreshTokenHash: args.replacementTokenHash,
      expiresAt: args.replacementExpiresAt,
      createdAt: now,
    });

    return {
      status: "rotated",
      userId: session.userId,
      sessionId,
    } as const;
  },
});

export const revokeSessionFamily = internalMutation({
  args: { refreshTokenHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refreshTokenHash", (q) =>
        q.eq("refreshTokenHash", args.refreshTokenHash),
      )
      .unique();
    if (!session) return null;

    if (!session.familyId) {
      await ctx.db.delete("sessions", session._id);
      return null;
    }

    const activeSession = await ctx.db
      .query("sessions")
      .withIndex("by_familyId_active", (q) =>
        q.eq("familyId", session.familyId).eq("active", true),
      )
      .unique();
    if (activeSession) {
      await ctx.db.patch("sessions", activeSession._id, {
        active: false,
        revokedAt: Date.now(),
      });
    }
    return null;
  },
});

export const cleanupExpired = internalMutation({
  args: {
    now: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = args.now ?? Date.now();
    const page = await ctx.db.query("sessions").paginate({
      numItems: SESSION_CLEANUP_PAGE_SIZE,
      cursor: args.cursor ?? null,
    });

    await Promise.all(
      page.page
        .filter((session) => session.expiresAt < now)
        .map((session) => ctx.db.delete("sessions", session._id)),
    );

    if (!page.isDone) {
      await scheduleSessionCleanup(ctx, {
        now,
        cursor: page.continueCursor,
      });
    }

    return null;
  },
});
