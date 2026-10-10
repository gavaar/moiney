import { describe, expect, it } from "vitest";
import { getUpdateKind, parseAppVersion } from "./version";

describe("app release versions", () => {
  it.each([
    ["0.5.0", "0.5.1", "optional"],
    ["0.5.1", "0.6.0", "mandatory"],
    ["0.9.9", "1.0.0", "mandatory"],
    ["0.5.9", "0.5.10", "optional"],
    ["1.0.0", "0.9.9", "none"],
    ["0.6.0", "0.5.99", "none"],
    ["0.5.1", "0.5.1", "none"],
    ["0.5.1", "invalid", "none"],
    ["invalid", "0.6.0", "none"],
  ] as const)("classifies %s → %s as %s", (installed, latest, expected) => {
    expect(getUpdateKind(installed, latest)).toBe(expected);
  });

  it.each(["", "v0.5.1", "0.5", "0.5.1-beta", "-1.0.0", "0.01.0", "9007199254740992.0.0"])(
    "rejects unsupported version %s", (version) => {
      expect(parseAppVersion(version)).toBeNull();
    },
  );

  it("parses whole numeric version components", () => {
    expect(parseAppVersion("0.5.10")).toEqual([0, 5, 10]);
  });
});
