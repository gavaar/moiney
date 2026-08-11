import { describe, expect, it } from "vitest";
import { planPipeDeletion } from "./plan";

const pipes = [
  { _id: "root", priority: 0, fed: 100, spent: 0 },
  { _id: "child", parentId: "root", priority: 0, fed: 40, spent: 0 },
  { _id: "leaf", parentId: "child", priority: 0, fed: 20, spent: 5 },
  { _id: "sibling", parentId: "root", priority: 0, fed: 10, spent: 1 },
];

describe("planPipeDeletion", () => {
  it("computes a nested subtree balance and immediate parent", () => {
    expect(planPipeDeletion(pipes, "child")).toEqual({
      memberIds: ["child", "leaf"],
      parentId: "root",
      balance: 55,
    });
  });

  it.each([
    [{ _id: "pipe", priority: 0, fed: 10, spent: 30 }, -20],
    [{ _id: "pipe", priority: 0, fed: 10, spent: 10 }, 0],
  ])("preserves boundary balance %#", (pipe, balance) => {
    expect(planPipeDeletion([pipe], "pipe")).toEqual({
      memberIds: ["pipe"],
      parentId: undefined,
      balance,
    });
  });

  it("credits no parent when deleting a root", () => {
    expect(planPipeDeletion(pipes, "root").parentId).toBeUndefined();
  });
});
