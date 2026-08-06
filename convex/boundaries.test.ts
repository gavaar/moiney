// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("Convex boundaries", () => {
  it("rejects creating a pipe beneath another user's parent without writes", async () => {
    const t = convexTest(schema, modules);
    const { userA, parentId } = await t.run(async (ctx) => {
      const userA = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash-a",
      });
      const userB = await ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash-b",
      });
      const parentId = await ctx.db.insert("pipes", {
        userId: userB,
        name: "Bob's pipe",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 10,
      });
      return { userA, parentId };
    });
    const asUserA = t.withIdentity({ subject: userA });

    await expect(
      asUserA.mutation(api.pipes.addPipe, {
        name: "Unauthorized child",
        icon: "pipe",
        priority: 1,
        capacity: 25,
        parentId,
      }),
    ).rejects.toThrow("Parent pipe not found");

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes).toHaveLength(1);
    expect(pipes[0]).toMatchObject({
      _id: parentId,
      capacity: 100,
      fed: 50,
      spent: 10,
    });
  });

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
});
