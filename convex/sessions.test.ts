import { describe, expect, it, vi } from "vitest";
import { create, revokeSessionFamily, rotateRefreshToken } from "./sessions";

describe("create", () => {
  it("revokes the oldest active session before creating an eleventh", async () => {
    const activeSessions = Array.from({ length: 10 }, (_, index) => ({
      _id: `session-${index + 1}`,
    }));
    const ctx = {
      db: {
        insert: vi.fn().mockResolvedValue("session-11"),
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            order: vi.fn(() => ({
              take: vi.fn().mockResolvedValue(activeSessions),
            })),
          })),
        })),
      },
    };

    const result = await (create as any)._handler(ctx, {
      userId: "user-1",
      familyId: "family-11",
      refreshTokenHash: "hash-11",
      expiresAt: 999,
    });

    expect(result).toBe("session-11");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "sessions",
      "session-1",
      expect.objectContaining({ active: false, revokedAt: expect.any(Number) }),
    );
  });
});

describe("rotateRefreshToken", () => {
  it("atomically consumes an active token and creates its replacement", async () => {
    const session = {
      _id: "session-1",
      userId: "user-1",
      familyId: "family-1",
      active: true,
      refreshTokenHash: "old-hash",
      expiresAt: Date.now() + 60_000,
      createdAt: 100,
    };
    const unique = vi.fn().mockResolvedValue(session);
    const ctx = {
      db: {
        insert: vi.fn().mockResolvedValue("session-2"),
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ unique })),
        })),
      },
    };

    const result = await (rotateRefreshToken as any)._handler(ctx, {
      refreshTokenHash: "old-hash",
      replacementTokenHash: "new-hash",
      replacementExpiresAt: 999,
    });

    expect(result).toEqual({
      status: "rotated",
      userId: "user-1",
      sessionId: "session-2",
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "sessions",
      "session-1",
      expect.objectContaining({ active: false, rotatedAt: expect.any(Number) }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "sessions",
      expect.objectContaining({
        userId: "user-1",
        familyId: "family-1",
        active: true,
        refreshTokenHash: "new-hash",
        expiresAt: 999,
      }),
    );
  });

  it("revokes the token family when a rotated token is replayed", async () => {
    const replayedSession = {
      _id: "session-1",
      userId: "user-1",
      familyId: "family-1",
      active: false,
      refreshTokenHash: "old-hash",
      expiresAt: Date.now() + 60_000,
      createdAt: 100,
      rotatedAt: 200,
    };
    const currentSession = {
      ...replayedSession,
      _id: "session-2",
      active: true,
      refreshTokenHash: "current-hash",
      rotatedAt: undefined,
    };
    const ctx = {
      db: {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn((index: string) =>
            index === "by_refreshTokenHash"
              ? { unique: vi.fn().mockResolvedValue(replayedSession) }
              : { unique: vi.fn().mockResolvedValue(currentSession) },
          ),
        })),
      },
    };

    const result = await (rotateRefreshToken as any)._handler(ctx, {
      refreshTokenHash: "old-hash",
      replacementTokenHash: "attacker-hash",
      replacementExpiresAt: 999,
    });

    expect(result).toEqual({ status: "replayed" });
    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "sessions",
      "session-2",
      expect.objectContaining({ active: false, revokedAt: expect.any(Number) }),
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});

describe("revokeSessionFamily", () => {
  it("revokes the active head related to the presented refresh token", async () => {
    const currentSession = {
      _id: "session-2",
      userId: "user-1",
      familyId: "family-1",
      active: true,
      refreshTokenHash: "current-hash",
      expiresAt: Date.now() + 60_000,
      createdAt: 200,
    };
    const ctx = {
      db: {
        delete: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn((index: string) =>
            index === "by_refreshTokenHash"
              ? { unique: vi.fn().mockResolvedValue(currentSession) }
              : { unique: vi.fn().mockResolvedValue(currentSession) },
          ),
        })),
      },
    };

    await (revokeSessionFamily as any)._handler(ctx, {
      refreshTokenHash: "current-hash",
    });

    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "sessions",
      "session-2",
      expect.objectContaining({ active: false, revokedAt: expect.any(Number) }),
    );
    expect(ctx.db.delete).not.toHaveBeenCalled();
  });
});
