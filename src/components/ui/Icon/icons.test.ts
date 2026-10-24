import { describe, expect, it } from "vitest";
import { safeIconName } from ".";

describe("safeIconName", () => {
  it("preserves supported names", () => {
    expect(safeIconName("wallet-outline")).toBe("wallet-outline");
  });

  it.each([null, undefined, "", "unknown-icon", "constructor", "toString", "__proto__"])(
    "falls back for unsupported name %s",
    name => {
      expect(safeIconName(name)).toBe("pipe");
      expect(safeIconName(name, "wallet-outline")).toBe("wallet-outline");
    },
  );
});
