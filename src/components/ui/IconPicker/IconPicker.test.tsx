import { describe, expect, it } from "vitest";
import { filterIcons } from "./filter";
import { CURATED_ICONS } from "../Icon/icons";

describe("filterIcons", () => {
  it("returns all icons when search is empty", () => {
    const result = filterIcons("", CURATED_ICONS);
    expect(result).toHaveLength(CURATED_ICONS.length);
  });

  it("filters icons by name (case-insensitive)", () => {
    const result = filterIcons("WALLET", CURATED_ICONS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("wallet-outline");
  });

  it("returns empty array when no icons match", () => {
    const result = filterIcons("zzzzz", CURATED_ICONS);
    expect(result).toHaveLength(0);
  });

  it("returns multiple matches for partial names", () => {
    const result = filterIcons("outline", CURATED_ICONS);
    expect(result.length).toBeGreaterThan(1);
    result.forEach((icon) => {
      expect(icon.name).toContain("outline");
    });
  });

  it("returns single match for exact icon name", () => {
    const result = filterIcons("pipe-valve", CURATED_ICONS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("pipe-valve");
  });
});
