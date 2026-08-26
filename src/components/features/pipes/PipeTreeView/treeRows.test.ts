import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { buildTreeRows } from "./treeRows";

const pipeId = (value: string) => value as Id<"pipes">;

function pipe(
  name: string,
  overrides: Partial<Pick<PipeModel, "capacity" | "fed" | "spent" | "priority">> = {},
): PipeModel {
  return {
    id: pipeId(name),
    name,
    icon: "pipe",
    priority: 0,
    capacity: 0,
    fed: 0,
    spent: 0,
    ...overrides,
  };
}

describe("buildTreeRows", () => {
  it("orders leaves before branches and keeps nested paths and group maxima", () => {
    const feed = pipe("feed", { capacity: 1000, fed: 800, spent: 300 });
    const gifts = pipe("gifts", { capacity: 500, fed: 200, spent: 50 });
    const rent = pipe("rent", { capacity: 600, fed: 500, spent: 500 });
    const food = pipe("food", { capacity: 400, fed: 300, spent: 150 });
    const electricity = pipe("electricity", { capacity: 200, fed: 150, spent: 100 });
    const water = pipe("water", { capacity: 100, fed: 80, spent: 40 });
    const childrenByParent = new Map<Id<"pipes">, PipeModel[]>([
      [feed.id, [rent, food]],
      [gifts.id, []],
      [rent.id, [electricity, water]],
    ]);

    const rows = buildTreeRows([feed, gifts], childrenByParent);

    expect(rows.map((row) => row.id)).toEqual([
      gifts.id,
      feed.id,
      food.id,
      rent.id,
      electricity.id,
      water.id,
    ]);
    expect(rows.find((row) => row.id === rent.id)).toMatchObject({
      path: [feed.id, rent.id],
      isLeaf: false,
      groupMax: 400,
    });
    expect(rows.find((row) => row.id === electricity.id)?.groupMax).toBe(200);
    expect(rows.find((row) => row.id === food.id)).toMatchObject({
      path: [feed.id, food.id],
      isLeaf: true,
      groupMax: 400,
    });
    expect(rows.find((row) => row.id === feed.id)).toMatchObject({
      depth: 0,
      isLeaf: false,
      groupMax: 500,
    });
  });
});
