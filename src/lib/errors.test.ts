import { describe, expect, it } from "vitest";
import { toUserFriendly } from "./errors";

describe("toUserFriendly", () => {
  it("maps Invalid credentials", () => {
    expect(() => toUserFriendly(new Error("Invalid credentials"))).toThrow(
      "Invalid username or password",
    );
  });

  it("maps Account already exists", () => {
    expect(() => toUserFriendly(new Error("Account already exists"))).toThrow(
      "This username is already taken",
    );
  });

  it("falls through for unknown messages", () => {
    expect(() => toUserFriendly(new Error("Server error"))).toThrow(
      "Something went wrong. Please try again.",
    );
  });

  it("handles non-Error input", () => {
    expect(() => toUserFriendly("string")).toThrow(
      "Something went wrong. Please try again.",
    );
  });

  it("handles null input", () => {
    expect(() => toUserFriendly(null)).toThrow(
      "Something went wrong. Please try again.",
    );
  });

  it("matches wrapped messages (e.g. from Convex)", () => {
    expect(() =>
      toUserFriendly(new Error("A(auth:signIn): Invalid credentials")),
    ).toThrow("Invalid username or password");
  });

  it("matches objects with a message property", () => {
    expect(() =>
      toUserFriendly({ message: "Account already exists" }),
    ).toThrow("This username is already taken");
  });
});