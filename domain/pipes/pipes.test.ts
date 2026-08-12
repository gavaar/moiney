import { describe, expect, it } from "vitest";
import { recalculatePipes } from "./pipes";

describe("recalculatePipes", () => {
  it("allocates parent fed to a child up to its capacity", () => {
    const result = recalculatePipes([
      { _id: "root", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "child", parentId: "root", priority: 0, capacity: 400, fed: 0 },
    ]);

    expect(result).toEqual([
      { _id: "root", fed: 600 },
      { _id: "child", fed: 400 },
    ]);
  });
});
