import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "./pipes";
import { getSubtreePipeIds } from "./subtree";

function pipe(id: string, parentId?: string): PipeModel {
  return {
    id: id as Id<"pipes">,
    parentId: parentId as Id<"pipes"> | undefined,
    name: "",
    icon: "",
    priority: 0,
    capacity: 0,
    fed: 0,
    spent: 0,
    description: undefined,
  };
}

function buildChildrenMap(pipes: PipeModel[]): Map<Id<"pipes">, PipeModel[]> {
  const map = new Map<Id<"pipes">, PipeModel[]>();
  for (const child of pipes) {
    if (child.parentId) {
      const siblings = map.get(child.parentId) ?? [];
      siblings.push(child);
      map.set(child.parentId, siblings);
    }
  }
  return map;
}

describe("getSubtreePipeIds", () => {
  it("includes the selected pipe and every descendant", () => {
    const map = buildChildrenMap([pipe("b", "a"), pipe("c", "b"), pipe("d", "a")]);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns null when selectedPipeId is null", () => {
    expect(getSubtreePipeIds(buildChildrenMap([]), null)).toBeNull();
  });

  it("returns only the selected leaf", () => {
    expect(getSubtreePipeIds(buildChildrenMap([pipe("a")]), "a" as Id<"pipes">)).toEqual(["a"]);
  });

  it("returns the selected parent and direct children", () => {
    const map = buildChildrenMap([pipe("b", "a"), pipe("c", "a")]);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual(["a", "b", "c"]);
  });

  it("returns nested descendants in DFS order", () => {
    const map = buildChildrenMap([pipe("b", "a"), pipe("c", "b"), pipe("d", "b"), pipe("e", "a")]);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns parents and leaves", () => {
    const map = buildChildrenMap([pipe("b", "a"), pipe("c", "b"), pipe("d", "c"), pipe("e", "a")]);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns the selected pipe when it has no known children", () => {
    expect(getSubtreePipeIds(buildChildrenMap([]), "x" as Id<"pipes">)).toEqual(["x"]);
  });

  it("handles a deep chain", () => {
    const map = buildChildrenMap([pipe("b", "a"), pipe("c", "b"), pipe("d", "c"), pipe("e", "d")]);
    expect(getSubtreePipeIds(map, "a" as Id<"pipes">)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
