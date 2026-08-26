// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

describe("Convex boundaries: accounts, sessions, and profile", () => {
  it("atomically registers one canonical account and linked session", async () => {
    const t = convexTest(schema, modules);
    const args = {
      username: " ALICE ",
      email: "alice@example.com",
      password: "password-hash",
      familyId: "family-1",
      refreshTokenHash: "refresh-hash-1",
      expiresAt: Date.now() + 60_000,
    };

    const result = await t.mutation(
      internal.accounts.registerWithSession,
      args,
    );

    const stateAfterRegistration = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      sessions: await ctx.db.query("sessions").collect(),
    }));
    expect(stateAfterRegistration.users).toHaveLength(1);
    expect(stateAfterRegistration.users[0]).toMatchObject({
      _id: result.userId,
      username: "alice",
    });
    expect(stateAfterRegistration.sessions).toHaveLength(1);
    expect(stateAfterRegistration.sessions[0]).toMatchObject({
      _id: result.sessionId,
      userId: result.userId,
      familyId: "family-1",
      active: true,
    });

    await expect(
      t.mutation(internal.accounts.registerWithSession, {
        ...args,
        username: "alice",
        familyId: "family-2",
        refreshTokenHash: "refresh-hash-2",
      }),
    ).rejects.toThrow("Account already exists");

    const stateAfterDuplicate = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      sessions: await ctx.db.query("sessions").collect(),
    }));
    expect(stateAfterDuplicate.users).toHaveLength(1);
    expect(stateAfterDuplicate.sessions).toHaveLength(1);
  });

  it("cleans expired sessions across bounded continuations", async () => {
    const t = convexTest(schema, modules);
    const now = 10_000;
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "cleanup-user",
        email: "cleanup@example.com",
        password: "hash",
      });
      for (let index = 0; index < 201; index += 1) {
        await ctx.db.insert("sessions", {
          userId,
          refreshTokenHash: `cleanup-hash-${index}`,
          familyId: `cleanup-family-${index}`,
          active: false,
          expiresAt: index === 150 ? now : now - 1,
          createdAt: index,
        });
      }
    });

    await t.mutation(internal.sessions.cleanupExpired, { now });

    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const sessions = await t.run((ctx) => ctx.db.query("sessions").collect());
    expect(sessions).toHaveLength(1);
    expect(sessions[0].expiresAt).toBe(now);
  });

  it("returns only the authenticated user's profile without credentials", async () => {
    const t = convexTest(schema, modules);
    const aliceId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash-a",
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash-b",
      }),
    );

    const profile = await t
      .withIdentity({ subject: aliceId })
      .query(api.profile.getMyProfile);

    expect(profile).toEqual({ username: "alice", pictureUrl: null });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("password");
  });

  it("loads sign-in credentials for a user with a profile picture", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await t.run(async (ctx) => {
      const picture = await ctx.storage.store(new Blob(["picture"]));
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
        picture: picture as Id<"_storage">,
      });
      return { userId };
    });

    const user = await t.query(internal.accounts.getUserByUsername, {
      username: "alice",
    });

    expect(user).toEqual({
      _id: userId,
      password: "hash",
    });
  });

  it("requires authentication to read the profile", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.profile.getMyProfile)).rejects.toThrow(
      "Not authenticated",
    );
  });
});
