import { describe, expect, it } from "vitest";
import { safeIconName } from "./icons";

describe("safeIconName", () => {
  it("returns repeat-once for repeat-once", () => {
    expect(safeIconName("repeat-once")).toBe("repeat-once");
  });

  it("returns card-multiple for card-multiple", () => {
    expect(safeIconName("card-multiple")).toBe("card-multiple");
  });
});
