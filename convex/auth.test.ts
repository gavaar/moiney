import { describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";

vi.mock("./lib/jwt", () => ({
  generateRefreshToken: () => "refresh-token",
  getRefreshExpiry: () => 123,
  hashToken: () => "refresh-token-hash",
  signAccessToken: () => "access-token",
}));

vi.mock("./lib/password", () => ({
  hashPassword: () => "password-hash",
  verifyPassword: () => true,
}));

import { signIn, signUp } from "./auth";

describe("signUp", () => {
  it("uses the canonical username for lookup and account creation", async () => {
    const runQuery = vi.fn().mockResolvedValue(null);
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce("user-1")
      .mockResolvedValueOnce("session-1");
    const ctx = { runQuery, runMutation };

    await (signUp as any)._handler(ctx, {
      username: " ALICE ",
      email: "alice@example.com",
      password: "password123",
    });

    expect(runQuery).toHaveBeenCalledWith(internal.accounts.getUserByUsername, {
      username: "alice",
    });
    expect(runMutation).toHaveBeenNthCalledWith(
      1,
      internal.accounts.insertUser,
      expect.objectContaining({ username: "alice" }),
    );
  });
});

describe("signIn", () => {
  it("looks up the canonical username", async () => {
    const runQuery = vi.fn().mockResolvedValue({
      _id: "user-1",
      username: "alice",
      email: "alice@example.com",
      password: "password-hash",
    });
    const runMutation = vi.fn().mockResolvedValue("session-1");
    const ctx = { runQuery, runMutation };

    await (signIn as any)._handler(ctx, {
      username: " ALICE ",
      password: "password123",
    });

    expect(runQuery).toHaveBeenCalledWith(internal.accounts.getUserByUsername, {
      username: "alice",
    });
  });
});
