import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { isUsernameAvailable, registerWithSession } from "./accounts";

if (false) {
  // @ts-expect-error Account records must not be available through the public API.
  api.accounts.getUserByUsername;
  // @ts-expect-error Account insertion must not be available through the public API.
  api.accounts.insertUser;
}

describe("isUsernameAvailable", () => {
  it("keeps account persistence operations out of the public API", () => {
    expectTypeOf(internal.accounts.getUserByUsername).not.toEqualTypeOf<never>();
    expectTypeOf(internal.accounts.registerWithSession).not.toEqualTypeOf<never>();
  });

  it("returns false for an existing username without exposing account data", async () => {
    const unique = vi.fn().mockResolvedValue({
      _id: "user-1",
      username: "alice",
      email: "alice@example.com",
      password: "salt:password-hash",
    });
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ unique })),
        })),
      },
    };

    const result = await (isUsernameAvailable as any)._handler(ctx, {
      username: "alice",
    });

    expect(result).toBe(false);
  });

  it("returns true when the username does not exist", async () => {
    const unique = vi.fn().mockResolvedValue(null);
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ unique })),
        })),
      },
    };

    const result = await (isUsernameAvailable as any)._handler(ctx, {
      username: "alice",
    });

    expect(result).toBe(true);
  });

  it("checks the trimmed lowercase username", async () => {
    const eq = vi.fn();
    const unique = vi.fn().mockResolvedValue(null);
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn((_index, configure) => {
            configure({ eq });
            return { unique };
          }),
        })),
      },
    };

    await (isUsernameAvailable as any)._handler(ctx, {
      username: " ALICE ",
    });

    expect(eq).toHaveBeenCalledWith("username", "alice");
  });

  it("does not report a whitespace-only username as available", async () => {
    const unique = vi.fn().mockResolvedValue(null);
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ unique })),
        })),
      },
    };

    const result = await (isUsernameAvailable as any)._handler(ctx, {
      username: "   ",
    });

    expect(result).toBe(false);
  });
});

describe("registerWithSession", () => {
  it("creates the account and session in one mutation", async () => {
    const unique = vi.fn().mockResolvedValue(null);
    const insert = vi
      .fn()
      .mockResolvedValueOnce("user-1")
      .mockResolvedValueOnce("session-1");
    const ctx = {
      db: {
        insert,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ unique })),
        })),
      },
    };

    const result = await (registerWithSession as any)._handler(ctx, {
      username: "alice",
      email: "alice@example.com",
      password: "password-hash",
      refreshTokenHash: "refresh-token-hash",
      expiresAt: 123,
    });

    expect(result).toEqual({ userId: "user-1", sessionId: "session-1" });
    expect(insert).toHaveBeenNthCalledWith(1, "users", {
      username: "alice",
      email: "alice@example.com",
      password: "password-hash",
      moneyMigrationVersion: 1,
    });
    expect(insert).toHaveBeenNthCalledWith(
      2,
      "sessions",
      expect.objectContaining({
        userId: "user-1",
        refreshTokenHash: "refresh-token-hash",
        expiresAt: 123,
      }),
    );
  });

  it("does not write when the canonical username already exists", async () => {
    const insert = vi.fn();
    const ctx = {
      db: {
        insert,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique: vi.fn().mockResolvedValue({ _id: "user-1" }),
          })),
        })),
      },
    };

    await expect(
      (registerWithSession as any)._handler(ctx, {
        username: " ALICE ",
        email: "alice@example.com",
        password: "password-hash",
        refreshTokenHash: "refresh-token-hash",
        expiresAt: 123,
      }),
    ).rejects.toThrow("Account already exists");

    expect(insert).not.toHaveBeenCalled();
  });
});
