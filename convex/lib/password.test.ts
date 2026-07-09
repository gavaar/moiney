import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hash and verify match", () => {
    const stored = hashPassword("my-password");
    expect(verifyPassword("my-password", stored)).toBe(true);
  });

  it("rejects wrong password", () => {
    const stored = hashPassword("correct");
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
  });
});