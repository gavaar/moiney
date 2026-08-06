import { describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { getFunctionName } from "convex/server";

vi.mock("./lib/jwt", () => ({
  generateSessionFamilyId: () => "family-1",
  generateRefreshToken: () => "refresh-token",
  getRefreshExpiry: () => 123,
  hashToken: (token: string) => `${token}-hash`,
  signAccessToken: () => "access-token",
}));

vi.mock("./lib/password", () => ({
  hashPassword: () => "password-hash",
  verifyPassword: () => true,
}));

import { refreshAccess, signIn, signOut, signUp } from "./auth";

describe("signUp", () => {
  it("rejects an oversized email before sign-up backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signUp as any)._handler(ctx, {
        username: "alice",
        email: `${"a".repeat(243)}@example.com`,
        password: "password123",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("rejects an oversized username before sign-up backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signUp as any)._handler(ctx, {
        username: ` ${"a".repeat(65)} `,
        email: "alice@example.com",
        password: "password123",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("rejects an oversized password before sign-up backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signUp as any)._handler(ctx, {
        username: "alice",
        email: "alice@example.com",
        password: "a".repeat(129),
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("rejects a rate-limited attempt before creating an account", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn().mockResolvedValue({
      ok: false,
      retryAfter: 2_000,
    });
    const ctx = { runQuery, runMutation };

    await expect(
      (signUp as any)._handler(ctx, {
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_RATE_LIMITED", retryAfter: 2_000 },
    });

    expect(runMutation).toHaveBeenCalledTimes(1);
  });

  it("atomically creates the canonical account and session", async () => {
    const runQuery = vi.fn().mockResolvedValue(null);
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        userId: "user-1",
        sessionId: "session-1",
      });
    const ctx = { runQuery, runMutation };

    await (signUp as any)._handler(ctx, {
      username: " ALICE ",
      email: "alice@example.com",
      password: "password123",
    });

    expect(runQuery.mock.calls.length).toBe(0);
    expect(runMutation.mock.calls.length).toBe(2);
    expect(getFunctionName(runMutation.mock.calls[1][0])).toBe(
      "accounts:registerWithSession",
    );
    expect(runMutation.mock.calls[1][1]).toEqual({
      username: "alice",
      email: "alice@example.com",
      password: "password-hash",
      familyId: "family-1",
      refreshTokenHash: "refresh-token-hash",
      expiresAt: 123,
    });
  });
});

describe("signIn", () => {
  it("rejects an oversized username before sign-in backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signIn as any)._handler(ctx, {
        username: ` ${"a".repeat(65)} `,
        password: "password123",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("rejects an oversized password before backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signIn as any)._handler(ctx, {
        username: "alice",
        password: "a".repeat(129),
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("rejects a rate-limited attempt before loading the account", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn().mockResolvedValue({
      ok: false,
      retryAfter: 1_000,
    });
    const ctx = { runQuery, runMutation };

    await expect(
      (signIn as any)._handler(ctx, {
        username: "alice",
        password: "password123",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_RATE_LIMITED", retryAfter: 1_000 },
    });

    expect(runQuery).not.toHaveBeenCalled();
  });

  it("looks up the canonical username", async () => {
    const runQuery = vi.fn().mockResolvedValue({
      _id: "user-1",
      username: "alice",
      email: "alice@example.com",
      password: "password-hash",
    });
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce("session-1");
    const ctx = { runQuery, runMutation };

    await (signIn as any)._handler(ctx, {
      username: " ALICE ",
      password: "password123",
    });

    expect(runQuery).toHaveBeenCalledWith(internal.accounts.getUserByUsername, {
      username: "alice",
    });
    expect(typeof runMutation.mock.calls[1][0]).not.toBe("string");
    expect(getFunctionName(runMutation.mock.calls[1][0])).toBe(
      "sessions:create",
    );
  });
});

describe("refreshAccess", () => {
  it("rejects an oversized refresh token before backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (refreshAccess as any)._handler(ctx, {
        refreshToken: "a".repeat(129),
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("rejects a rate-limited refresh before rotating the token", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn().mockResolvedValue({
      ok: false,
      retryAfter: 500,
    });
    const ctx = { runQuery, runMutation };

    await expect(
      (refreshAccess as any)._handler(ctx, {
        refreshToken: "refresh-token",
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_RATE_LIMITED", retryAfter: 500 },
    });

    expect(runMutation).toHaveBeenCalledTimes(1);
  });

  it("rotates the refresh token and returns its replacement", async () => {
    const runQuery = vi.fn();
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        status: "rotated",
        userId: "user-1",
        sessionId: "session-2",
      });
    const ctx = { runQuery, runMutation };

    const result = await (refreshAccess as any)._handler(ctx, {
      refreshToken: "old-token",
    });

    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(runQuery).not.toHaveBeenCalled();
    expect(getFunctionName(runMutation.mock.calls[1][0])).toBe(
      "sessions:rotateRefreshToken",
    );
    expect(runMutation.mock.calls[1][1]).toEqual({
      refreshTokenHash: "old-token-hash",
      replacementTokenHash: "refresh-token-hash",
      replacementExpiresAt: 123,
    });
  });

  it("rejects an expired refresh-token rotation", async () => {
    const runQuery = vi.fn();
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ status: "expired" });
    const ctx = { runQuery, runMutation };

    await expect(
      (refreshAccess as any)._handler(ctx, {
        refreshToken: "refresh-token",
      }),
    ).rejects.toThrow("Session expired");

    expect(getFunctionName(runMutation.mock.calls[1][0])).toBe(
      "sessions:rotateRefreshToken",
    );
    expect(runQuery).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("rejects an oversized refresh token before backend work", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    await expect(
      (signOut as any)._handler(ctx, {
        refreshToken: "a".repeat(129),
      }),
    ).rejects.toMatchObject({
      data: { code: "AUTH_INVALID_INPUT" },
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("revokes the refresh-token family through a generated internal API", async () => {
    const runQuery = vi.fn();
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation };

    const result = await (signOut as any)._handler(ctx, {
      refreshToken: "refresh-token",
    });

    expect(result).toBeNull();
    expect(runQuery).not.toHaveBeenCalled();
    expect(typeof runMutation.mock.calls[0][0]).not.toBe("string");
    expect(getFunctionName(runMutation.mock.calls[0][0])).toBe(
      "sessions:revokeSessionFamily",
    );
  });
});
