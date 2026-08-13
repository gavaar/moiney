import { describe, expect, it } from "vitest";
import { recalculatePipes, splitEvenly } from "./pipes";

describe("splitEvenly", () => {
  it("allocates indivisible positive cents deterministically", () => {
    expect(
      splitEvenly(
        [
          { id: "a", capacity: 10, fed: 0 },
          { id: "b", capacity: 10, fed: 0 },
          { id: "c", capacity: 10, fed: 0 },
        ],
        1,
      ),
    ).toEqual([{ childId: "a", amount: 1 }]);
  });

  it("allocates indivisible negative cents without losing the budget", () => {
    expect(
      splitEvenly(
        [
          { id: "a", capacity: 10, fed: 0 },
          { id: "b", capacity: 10, fed: 0 },
        ],
        -3,
      ),
    ).toEqual([
      { childId: "a", amount: -2 },
      { childId: "b", amount: -1 },
    ]);
  });

  it("does not assign a remainder cent beyond a child capacity", () => {
    expect(
      splitEvenly(
        [
          { id: "a", capacity: 2, fed: 0 },
          { id: "b", capacity: 3, fed: 0 },
        ],
        5,
      ),
    ).toEqual([
      { childId: "a", amount: 2 },
      { childId: "b", amount: 3 },
    ]);
  });
});

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
