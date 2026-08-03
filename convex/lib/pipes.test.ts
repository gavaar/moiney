import { describe, expect, it, vi } from "vitest";
import {
  calculatePipeAllocations,
  collectChildSubtree,
  computeCronIntervalProgress,
  computeCronNextDate,
  computeElapsedIntervals,
  computePipeDerivedValues,
  computePipeTree,
  executePipeRule,
  recalcPipeSubtree,
  recalculatePipes,
  resolveTopMostAncestor,
  splitEvenly,
} from "./pipes";

describe("splitEvenly", () => {
  it("splits budget evenly when all shortfalls exceed fair share", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 1000, fed: 0 },
        { id: "b", capacity: 1000, fed: 0 },
        { id: "c", capacity: 1000, fed: 0 },
      ],
      600,
    );
    expect(result).toEqual([
      { childId: "a", amount: 200 },
      { childId: "b", amount: 200 },
      { childId: "c", amount: 200 },
    ]);
  });

  it("gives children with small shortfalls their full need before splitting", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 1000, fed: 0 },
        { id: "b", capacity: 600, fed: 0 },
        { id: "c", capacity: 200, fed: 0 },
      ],
      1000,
    );
    // sorted by shortfall: c(200) < b(600) < a(1000)
    // c gets full shortfall (200), b and a split remaining 800 → 400 each
    expect(result).toEqual([
      { childId: "c", amount: 200 },
      { childId: "b", amount: 400 },
      { childId: "a", amount: 400 },
    ]);
  });

  it("gives nothing when budget is zero", () => {
    const result = splitEvenly(
      [{ id: "a", capacity: 1000, fed: 0 }],
      0,
    );
    expect(result).toEqual([]);
  });

  it("splits negative budget evenly among children (no lower bound)", () => {
    const result = splitEvenly(
      [{ id: "a", capacity: 1000, fed: 0 }],
      -10,
    );
    expect(result).toEqual([{ childId: "a", amount: -10 }]);
  });

  it("splits negative budget evenly among multiple children", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 1000, fed: 0 },
        { id: "b", capacity: 500, fed: 0 },
      ],
      -300,
    );
    expect(result).toEqual([
      { childId: "a", amount: -150 },
      { childId: "b", amount: -150 },
    ]);
  });

  it("returns empty for no children", () => {
    const result = splitEvenly([], 500);
    expect(result).toEqual([]);
  });

  it("handles unlimited capacity (no capacity set)", () => {
    const result = splitEvenly(
      [
        { id: "a", fed: 0 },
        { id: "b", fed: 0 },
      ],
      500,
    );
    expect(result).toEqual([
      { childId: "a", amount: 250 },
      { childId: "b", amount: 250 },
    ]);
  });

  it("handles mix of limited and unlimited capacity", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 200, fed: 0 },
        { id: "b", fed: 0 },
        { id: "c", fed: 0 },
      ],
      1000,
    );
    // a needs 200 < 1000/3 ≈ 333 → gets 200
    // b, c split remaining 800 → 400 each
    expect(result).toEqual([
      { childId: "a", amount: 200 },
      { childId: "b", amount: 400 },
      { childId: "c", amount: 400 },
    ]);
  });

  it("accounts for existing fed when calculating shortfall", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 500, fed: 300 },
        { id: "b", capacity: 500, fed: 0 },
      ],
      400,
    );
    // a shortfall = 200, b shortfall = 500
    // fair share = 400/2 = 200
    // a shortfall (200) >= 200 → both get 200
    expect(result).toEqual([
      { childId: "a", amount: 200 },
      { childId: "b", amount: 200 },
    ]);
  });

  it("skips children already at capacity", () => {
    const result = splitEvenly(
      [
        { id: "a", capacity: 100, fed: 100 },
        { id: "b", capacity: 100, fed: 0 },
      ],
      100,
    );
    // a shortfall = 0 → skipped
    // b shortfall = 100, budget 100 → gets 100
    expect(result).toEqual([
      { childId: "b", amount: 100 },
    ]);
  });
});

describe("calculatePipeAllocations", () => {
  it("distributes fed to children ordered by priority", () => {
    const result = calculatePipeAllocations(1000, [
      { id: "a", priority: 2, capacity: 1000, fed: 400 },
      { id: "b", priority: 1, capacity: 600, fed: 0 },
    ]);
    // priority 1 (b): shortfall 600, gets 600 → remaining 400
    // priority 2 (a): shortfall 600, only 400 left → gets 400
    expect(result).toEqual([
      { childId: "b", amount: 600 },
      { childId: "a", amount: 400 },
    ]);
  });

  it("splits evenly within same priority", () => {
    const result = calculatePipeAllocations(600, [
      { id: "a", priority: 1, capacity: 1000, fed: 0 },
      { id: "b", priority: 1, capacity: 500, fed: 0 },
      { id: "c", priority: 2, capacity: 1000, fed: 0 },
    ]);
    // priority 1: a(shortfall=1000) + b(shortfall=500) split 600.
    // sorted by shortfall: b(500), a(1000)
    // fairShare = 600/2 = 300. b shortfall 500 >= 300 → both get 300
    // priority 2: nothing left (0 remaining)
    expect(result).toEqual([
      { childId: "b", amount: 300 },
      { childId: "a", amount: 300 },
    ]);
  });

  it("stops when parent fed is exhausted", () => {
    const result = calculatePipeAllocations(50, [
      { id: "a", priority: 1, capacity: 1000, fed: 0 },
      { id: "b", priority: 2, capacity: 1000, fed: 0 },
    ]);
    expect(result).toEqual([
      { childId: "a", amount: 50 },
    ]);
  });

  it("returns empty for zero parent fed", () => {
    const result = calculatePipeAllocations(0, [
      { id: "a", priority: 1, capacity: 1000, fed: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it("returns empty for no children", () => {
    const result = calculatePipeAllocations(500, []);
    expect(result).toEqual([]);
  });

  it("ignores priority 0 children", () => {
    // priority 0 is valid, just the lowest priority
    const result = calculatePipeAllocations(500, [
      { id: "a", priority: 1, capacity: 1000, fed: 0 },
      { id: "b", priority: 0, capacity: 1000, fed: 0 },
    ]);
    // priority 0 comes first (ascending), gets 500
    expect(result).toEqual([
      { childId: "b", amount: 500 },
    ]);
  });

  it("matches the user's original example", () => {
    // parent gets 1000, child A has cap=1000 fed=400, child B has cap=600 fed=0
    // same priority → split evenly
    // A shortfall = 600, B shortfall = 600, fair share = 1000/2 = 500
    // both shortfalls >= 500 → each gets 500
    // Result: A fed=900, B fed=500
    const result = calculatePipeAllocations(1000, [
      { id: "a", priority: 1, capacity: 1000, fed: 400 },
      { id: "b", priority: 1, capacity: 600, fed: 0 },
    ]);
    expect(result).toEqual([
      { childId: "a", amount: 500 },
      { childId: "b", amount: 500 },
    ]);
  });

  it("runs out of budget before filling all children", () => {
    const result = calculatePipeAllocations(300, [
      { id: "a", priority: 1, capacity: 500, fed: 0 },
      { id: "b", priority: 2, capacity: 500, fed: 0 },
    ]);
    // priority 1: a gets 300 (fair share = 300/1 = 300, shortfall 500 >= 300)
    // priority 2: nothing left
    expect(result).toEqual([
      { childId: "a", amount: 300 },
    ]);
  });

  it("distributes negative budget to highest priority number first (reversed)", () => {
    const result = calculatePipeAllocations(-300, [
      { id: "a", priority: 1, capacity: 500, fed: 0 },
      { id: "b", priority: 2, capacity: 500, fed: 0 },
    ]);
    // negative: reversed priority, highest number first
    // priority 2 (b): gets all -300
    // priority 1 (a): nothing left
    expect(result).toEqual([
      { childId: "b", amount: -300 },
    ]);
  });

  it("splits negative budget evenly within same priority group", () => {
    const result = calculatePipeAllocations(-400, [
      { id: "a", priority: 2, capacity: 500, fed: 0 },
      { id: "b", priority: 2, capacity: 500, fed: 0 },
      { id: "c", priority: 1, capacity: 500, fed: 0 },
    ]);
    // priority 2 (a, b): split -400 evenly → -200 each
    // priority 1 (c): nothing left
    expect(result).toEqual([
      { childId: "a", amount: -200 },
      { childId: "b", amount: -200 },
    ]);
  });

  it("returns empty for zero parent fed (negative test)", () => {
    const result = calculatePipeAllocations(0, [
      { id: "a", priority: 1, capacity: 500, fed: 0 },
    ]);
    expect(result).toEqual([]);
  });
});

describe("computePipeDerivedValues", () => {
  it("returns stored values for a leaf pipe (no children)", () => {
    const result = computePipeDerivedValues(
      { capacity: 100, spent: 30, fed: 50 },
      [],
    );
    expect(result).toEqual({ capacity: 100, spent: 30, fed: 50 });
  });

  it("defaults undefined spent and fed to 0 for leaf pipe", () => {
    const result = computePipeDerivedValues(
      { capacity: 100, spent: undefined, fed: undefined },
      [],
    );
    expect(result).toEqual({ capacity: 100, spent: 0, fed: 0 });
  });

  it("defaults undefined capacity to undefined for leaf pipe", () => {
    const result = computePipeDerivedValues(
      { capacity: undefined, spent: 10, fed: 20 },
      [],
    );
    expect(result).toEqual({ capacity: undefined, spent: 10, fed: 20 });
  });

  it("sums children capacities for a parent pipe (undefined → Infinity)", () => {
    const result = computePipeDerivedValues(
      { capacity: 999, spent: 10, fed: 5 },
      [
        { capacity: 500, spent: 10, fed: 100 },
        { capacity: 300, spent: 5, fed: 50 },
        { capacity: undefined, spent: 0, fed: 0 },
      ],
    );
    expect(result).toEqual({ capacity: Infinity, spent: 15, fed: 155 });
  });

  it("includes parent's own stored fed as excess in total fed", () => {
    const result = computePipeDerivedValues(
      { capacity: 999, spent: 10, fed: 100 },
      [
        { capacity: 500, spent: 10, fed: 200 },
      ],
    );
    // children fed sum = 200, parent's own fed = 100 → total fed = 300
    expect(result).toEqual({ capacity: 500, spent: 10, fed: 300 });
  });

  it("returns 0 for all values when parent has no children and no values set", () => {
    const result = computePipeDerivedValues(
      {},
      [],
    );
    expect(result).toEqual({ capacity: undefined, spent: 0, fed: 0 });
  });

  it("returns Infinity capacity for parent when all children have no capacity", () => {
    const result = computePipeDerivedValues(
      {},
      [
        {},
        {},
      ],
    );
    expect(result).toEqual({ capacity: Infinity, spent: 0, fed: 0 });
  });
});

describe("computePipeTree", () => {
  it("aggregates values bottom-up through nested pipe tree", () => {
    const pipes = [
      { _id: "a", parentId: undefined as string | undefined, capacity: undefined, spent: undefined, fed: 0 },
      { _id: "b", parentId: "a" as const, capacity: undefined, spent: undefined, fed: 0 },
      { _id: "c", parentId: "b" as const, capacity: 300, spent: 10, fed: 100 },
      { _id: "d", parentId: "b" as const, capacity: 200, spent: 5, fed: 50 },
    ];

    const computed = computePipeTree(pipes);

    // Leaves (C, D) use their own stored values
    expect(computed.get("c")).toEqual({ capacity: 300, spent: 10, fed: 100 });
    expect(computed.get("d")).toEqual({ capacity: 200, spent: 5, fed: 50 });

    // B sums its children C + D
    expect(computed.get("b")).toEqual({ capacity: 500, spent: 15, fed: 150 });

    // A uses B's computed values (not B's raw undefined values)
    expect(computed.get("a")).toEqual({ capacity: 500, spent: 15, fed: 150 });
  });

  it("handles flat list of root pipes (no nesting)", () => {
    const pipes = [
      { _id: "x", parentId: undefined, capacity: 100, spent: 10, fed: 50 },
      { _id: "y", parentId: undefined, capacity: 200, spent: 20, fed: 100 },
    ];

    const computed = computePipeTree(pipes);

    expect(computed.get("x")).toEqual({ capacity: 100, spent: 10, fed: 50 });
    expect(computed.get("y")).toEqual({ capacity: 200, spent: 20, fed: 100 });
  });

  it("includes excess fed from parent pipes", () => {
    const pipes = [
      { _id: "a", parentId: undefined as string | undefined, capacity: undefined, spent: undefined, fed: 30 },
      { _id: "b", parentId: "a" as const, capacity: 100, spent: 0, fed: 50 },
    ];

    const computed = computePipeTree(pipes);

    // B uses its own stored values (leaf)
    expect(computed.get("b")).toEqual({ capacity: 100, spent: 0, fed: 50 });

    // A adds its own fed (30) as excess on top of B's fed (50)
    expect(computed.get("a")).toEqual({ capacity: 100, spent: 0, fed: 80 });
  });
});

describe("recalculatePipes", () => {
  it("returns same fed for single root with no children", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 500 },
    ]);
    expect(result).toEqual([{ _id: "a", fed: 500 }]);
  });

  it("distributes parent fed to child capped by capacity", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "b", parentId: "a", priority: 0, capacity: 400, fed: 0 },
    ]);
    expect(new Map(result.map((r) => [r._id, r.fed]))).toEqual(
      new Map([
        ["a", 600],
        ["b", 400],
      ]),
    );
  });

  it("recollects children fed and redistributes when new child added", () => {
    // A(1000) → B(100, cap cleared) → C(900, cap 900), D(0, cap 400)
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "b", parentId: "a", priority: 0, fed: 100 },
      { _id: "c", parentId: "b", priority: 0, capacity: 900, fed: 900 },
      { _id: "d", parentId: "b", priority: 0, capacity: 400, fed: 0 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // A gives its 1000 to B; D has room (cap 400, at 0) and gets 400.
    // B keeps remaining (1100 - 400 = 700)
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(700);
    expect(map.get("c")).toBe(900);
    expect(map.get("d")).toBe(400);
    // total conserved
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(2000);
  });

  it("splits evenly among same-priority children with no caps", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 0 },
      { _id: "b", parentId: "a", priority: 0, fed: 1000 },
      { _id: "c", parentId: "b", priority: 0, fed: 0 },
      { _id: "d", parentId: "b", priority: 0, fed: 0 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(0);
    expect(map.get("c")).toBe(500);
    expect(map.get("d")).toBe(500);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(1000);
  });

  it("flows fed added to a parent pipe down to children", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 0 },
      { _id: "b", parentId: "a", priority: 0, fed: 300 },
      { _id: "c", parentId: "b", priority: 0, capacity: 1000, fed: 500 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(0);
    expect(map.get("c")).toBe(800);
  });

  it("respects priority ordering", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "b", parentId: "a", priority: 0, capacity: 500, fed: 0 },
      { _id: "c", parentId: "a", priority: 1, capacity: 500, fed: 0 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // priority 0 (b): gets 500 (cap), remaining 500
    // priority 1 (c): gets 500 (cap), a keeps 0
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(500);
    expect(map.get("c")).toBe(500);
  });

  it("handles multiple independent trees", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 300 },
      { _id: "b", parentId: "a", priority: 0, capacity: 100, fed: 0 },
      { _id: "z", parentId: undefined, priority: 0, fed: 500 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // Tree A: gives 100 to B, keeps 200
    expect(map.get("a")).toBe(200);
    expect(map.get("b")).toBe(100);
    // Tree Z: isolated root, keeps 500
    expect(map.get("z")).toBe(500);
  });

  it("returns empty for empty input", () => {
    const result = recalculatePipes([]);
    expect(result).toEqual([]);
  });

  it("cascades negative fed down to children (no lower bound)", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: -100 },
      { _id: "b", parentId: "a", priority: 0, capacity: 500, fed: 0 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(-100);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(-100);
  });

  it("preserves negative fed on leaf pipe with no children", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: -50 },
    ]);
    expect(result).toEqual([{ _id: "a", fed: -50 }]);
  });

  it("redistributes fed when a pipe's capacity is reduced (edit scenario)", () => {
    // A(fed=1000) → B(cap=300, fed=500), C(cap=200, fed=200)
    // Subtree fed total = 1000 + 500 + 200 = 1700
    // B capped at 300, C capped at 200, A keeps the rest
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "b", parentId: "a", priority: 0, capacity: 300, fed: 500 },
      { _id: "c", parentId: "a", priority: 0, capacity: 200, fed: 200 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("b")).toBe(300);
    expect(map.get("c")).toBe(200);
    expect(map.get("a")).toBe(1200);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(1700);
  });

  it("redistributes fed when a pipe's priority is changed (edit scenario)", () => {
    // A(fed=1000) → B(priority=1, cap=500, fed=500), C(priority=0, cap=500, fed=0)
    // B's priority changed to 0 (now same as C) → split evenly at same priority
    // Subtree fed total = 1000 + 500 + 0 = 1500
    // Both have cap=500, same priority → each gets 500, A keeps 500
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 1000 },
      { _id: "b", parentId: "a", priority: 0, capacity: 500, fed: 500 },
      { _id: "c", parentId: "a", priority: 0, capacity: 500, fed: 0 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("b")).toBe(500);
    expect(map.get("c")).toBe(500);
    expect(map.get("a")).toBe(500);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(1500);
  });

  // ── Debt cascade tests ──

  it("fills child deficit before keeping excess", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 50 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -100 },
      { _id: "c", parentId: "a", priority: 1, capacity: 0, fed: -300 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(-50);
    expect(map.get("c")).toBe(-300);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(-350);
  });

  it("cascades positive feed through multiple levels with deficits", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 50 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -100 },
      { _id: "c", parentId: "b", priority: 0, capacity: 0, fed: -150 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(-50);
    expect(map.get("c")).toBe(-150);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(-200);
  });

  it("cascades negative feed with reversed priority", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: -500 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -100 },
      { _id: "c", parentId: "a", priority: 1, capacity: 0, fed: -300 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // reversed priority: C (pri=1) gets debt first
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(-100);
    expect(map.get("c")).toBe(-800);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(-900);
  });

  it("splits negative feed evenly among children with same priority", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: -600 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -100 },
      { _id: "c", parentId: "a", priority: 0, capacity: 0, fed: -300 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // same priority → split evenly: -600 / 2 = -300 each
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(-400);
    expect(map.get("c")).toBe(-600);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(-1000);
  });

  it("reclaims excess from over-capacity children before positive distribution", () => {
    const result = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 500 },
      { _id: "b", parentId: "a", priority: 0, capacity: 100, fed: 200 },
    ]);
    const map = new Map(result.map((r) => [r._id, r.fed]));
    // B has excess 100 → reclaimed to A, now A has 600
    // B at cap (100), no shortfall → B gets nothing more
    expect(map.get("a")).toBe(600);
    expect(map.get("b")).toBe(100);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(700);
  });

  it("fills sequential feeds incrementally", () => {
    // Simulate: feed 50 then 250 then 100
    const feed1 = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 50 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -100 },
      { _id: "c", parentId: "a", priority: 1, capacity: 0, fed: -300 },
    ]);
    expect(new Map(feed1.map((r) => [r._id, r.fed])).get("b")).toBe(-50);

    // feed 250: use previous result as new state
    const feed2 = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 250 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: -50 },
      { _id: "c", parentId: "a", priority: 1, capacity: 0, fed: -300 },
    ]);
    expect(new Map(feed2.map((r) => [r._id, r.fed])).get("b")).toBe(0);
    expect(new Map(feed2.map((r) => [r._id, r.fed])).get("c")).toBe(-100);

    // feed 100: use previous result
    const feed3 = recalculatePipes([
      { _id: "a", parentId: undefined, priority: 0, fed: 100 },
      { _id: "b", parentId: "a", priority: 0, capacity: 0, fed: 0 },
      { _id: "c", parentId: "a", priority: 1, capacity: 0, fed: -100 },
    ]);
    expect(new Map(feed3.map((r) => [r._id, r.fed])).get("c")).toBe(0);
  });
});

function makeDb(docs: Record<string, any>) {
  const patch = vi.fn(async (id: any, p: any) => {
    docs[id] = { ...docs[id], ...p };
  });
  let field: string | undefined;
  let value: unknown;
  const db = {
    get: async (id: any) => (id in docs ? docs[id] : null),
    patch,
    query: () => {
      const builder = {
        eq: (f: string, v: unknown) => {
          field = f;
          value = v;
          return {};
        },
      };
      const queryObj = {
        withIndex: (_name: string, fn?: (q: any) => any) => {
          if (fn) fn(builder as any);
          return queryObj;
        },
        collect: async () => {
          if (field === "parentId") {
            return Object.values(docs).filter((d: any) => d.parentId === value);
          }
          return Object.values(docs);
        },
      };
      return queryObj;
    },
  };
  return { db, patch };
}

describe("resolveTopMostAncestor", () => {
  it("resolves a leaf to its top-most ancestor by walking parentId", async () => {
    const { db } = makeDb({
      a: { _id: "a", parentId: undefined },
      b: { _id: "b", parentId: "a" },
      c: { _id: "c", parentId: "b" },
    });

    expect(await resolveTopMostAncestor({ db } as any, "c" as any)).toBe("a");
    expect(await resolveTopMostAncestor({ db } as any, "b" as any)).toBe("a");
    expect(await resolveTopMostAncestor({ db } as any, "a" as any)).toBe("a");
  });

  it("returns the pipe itself when it is already a root", async () => {
    const { db } = makeDb({ a: { _id: "a", parentId: undefined } });
    expect(await resolveTopMostAncestor({ db } as any, "a" as any)).toBe("a");
  });
});

describe("collectChildSubtree", () => {
  it("returns all descendants of a root (not the root itself)", async () => {
    const { db } = makeDb({
      a: { _id: "a", parentId: undefined },
      b: { _id: "b", parentId: "a" },
      c: { _id: "c", parentId: "b" },
      d: { _id: "d", parentId: "b" },
      z: { _id: "z", parentId: undefined },
    });

    const subtree = await collectChildSubtree({ db } as any, "a" as any);
    const ids = subtree.map((p) => p._id).sort();
    expect(ids).toEqual(["b", "c", "d"]);
  });
});

describe("recalcPipeSubtree", () => {
  function pipe(id: string, parentId: any, fed: number, capacity?: number, priority = 0) {
    return { _id: id, parentId, fed, capacity, priority };
  }

  it("rebalances only the affected root's subtree and patches changed fed", async () => {
    // Two independent trees. Only the first fires and must be rebalanced.
    const docs: Record<string, any> = {
      z: pipe("z", undefined, 500, undefined), // unrelated root, must stay alone
      a: pipe("a", undefined, 2772.9),
      home: pipe("home", "a", 1913.46, 1702.65),
      health: pipe("health", "a", 402.55, 230.3),
      dumb: pipe("dumb", "a", 356.89, 400),
      smart: pipe("smart", "a", 100, 100),
    };
    const { db, patch } = makeDb(docs);

    await recalcPipeSubtree({ db } as any, "home" as any);

    const fed = new Map<string, number>();
    for (const [id, d] of Object.entries(docs)) fed.set(id, d.fed);

    // overfed children reclaimed to their caps
    expect(fed.get("home")).toBe(1702.65);
    expect(fed.get("health")).toBe(230.3);
    // smart already at cap stays at cap
    expect(fed.get("smart")).toBe(100);
    // the underfed child gets topped up from the parent surplus
    expect(fed.get("dumb")).toBe(400);

    // unrelated tree ("z") patched zero times
    const patchedIds = patch.mock.calls.map((c) => c[0]);
    expect(patchedIds).not.toContain("z");
  });

  it("does not patch pipes whose fed is unchanged", async () => {
    const docs: Record<string, any> = {
      a: pipe("a", undefined, 0),
      b: pipe("b", "a", 100, 100), // at cap, nothing to change
    };
    const { db, patch } = makeDb(docs);

    await recalcPipeSubtree({ db } as any, "b" as any);

    expect(patch).not.toHaveBeenCalled();
  });
});

describe("computeCronNextDate", () => {
  it("returns the starting date at the rule hour (5am UTC) when it is still in the future", () => {
    const starting = Date.UTC(2099, 8, 15, 8, 30);
    const now = Date.UTC(2099, 8, 1);

    expect(computeCronNextDate(starting, 1, "months", now)).toBe(
      Date.UTC(2099, 8, 15, 5),
    );
  });

  it("rolls forward to the next scheduled day when the anchor is in the past", () => {
    const starting = Date.UTC(2026, 6, 1, 0, 0);
    const now = Date.UTC(2026, 6, 10, 12, 0);

    expect(computeCronNextDate(starting, 7, "days", now)).toBe(
      Date.UTC(2026, 6, 15, 5),
    );
  });

  it("rolls forward when the anchor hour has already passed today", () => {
    const starting = Date.UTC(2026, 6, 10, 0, 0);
    const now = Date.UTC(2026, 6, 10, 15, 0);

    expect(computeCronNextDate(starting, 7, "days", now)).toBe(
      Date.UTC(2026, 6, 17, 5),
    );
  });

  it("returns the next interval when now equals the anchor hour exactly", () => {
    const starting = Date.UTC(2026, 6, 10, 12, 0);
    const now = Date.UTC(2026, 6, 10, 12, 0);

    expect(computeCronNextDate(starting, 30, "days", now)).toBe(
      Date.UTC(2026, 7, 9, 5),
    );
  });

  it("clamps to the last day of the month when adding months", () => {
    const starting = Date.UTC(2026, 0, 31, 0, 0);
    const now = Date.UTC(2026, 1, 1);

    expect(computeCronNextDate(starting, 1, "months", now)).toBe(
      Date.UTC(2026, 1, 28, 5),
    );
  });

  it("keeps the original day-of-month across clamp months", () => {
    const starting = Date.UTC(2026, 0, 31, 0, 0);
    const now = Date.UTC(2026, 2, 1);

    expect(computeCronNextDate(starting, 1, "months", now)).toBe(
      Date.UTC(2026, 2, 31, 5),
    );
  });

  it("clamps when the target month has fewer days", () => {
    const starting = Date.UTC(2026, 2, 31, 0, 0);
    const now = Date.UTC(2026, 3, 1);

    expect(computeCronNextDate(starting, 1, "months", now)).toBe(
      Date.UTC(2026, 3, 30, 5),
    );
  });

  it("clamps leap-day starting dates when adding years", () => {
    const starting = Date.UTC(2024, 1, 29, 0, 0);
    const now = Date.UTC(2024, 5, 1);

    expect(computeCronNextDate(starting, 1, "years", now)).toBe(
      Date.UTC(2025, 1, 28, 5),
    );
  });
});

describe("computeElapsedIntervals", () => {
  it("returns 0 when the starting date is in the future", () => {
    expect(
      computeElapsedIntervals(
        Date.UTC(2099, 0, 1),
        1,
        "months",
        Date.UTC(2026, 6, 1),
      ),
    ).toBe(0);
  });

  it("returns 0 for the same month as starting", () => {
    expect(
      computeElapsedIntervals(
        Date.UTC(2026, 0, 15),
        1,
        "months",
        Date.UTC(2026, 0, 20),
      ),
    ).toBe(0);
  });

  it("counts completed month intervals", () => {
    expect(
      computeElapsedIntervals(
        Date.UTC(2026, 0, 15),
        1,
        "months",
        Date.UTC(2026, 1, 1),
      ),
    ).toBe(1);
    expect(
      computeElapsedIntervals(
        Date.UTC(2026, 0, 15),
        1,
        "months",
        Date.UTC(2026, 2, 1),
      ),
    ).toBe(2);
  });

  it("counts completed day intervals", () => {
    expect(
      computeElapsedIntervals(
        Date.UTC(2026, 0, 1, 12),
        7,
        "days",
        Date.UTC(2026, 0, 10, 12),
      ),
    ).toBe(1);
  });

  it("counts completed year intervals", () => {
    expect(
      computeElapsedIntervals(
        Date.UTC(2024, 0, 1),
        1,
        "years",
        Date.UTC(2026, 2, 1),
      ),
    ).toBe(2);
  });
});

describe("computeCronIntervalProgress", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const EXECUTION_DELAY = 60 * 60 * 1000;

  it("returns 0 at the start of the effective interval", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);
    const startOfInterval = cronNextDate - 7 * DAY + EXECUTION_DELAY;

    expect(
      computeCronIntervalProgress(cronNextDate, 7, "days", startOfInterval),
    ).toBe(0);
  });

  it("returns the fraction of a day interval elapsed", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);
    const now = Date.UTC(2026, 6, 6, 12);

    expect(computeCronIntervalProgress(cronNextDate, 7, "days", now)).toBeCloseTo(
      71 / 144,
      5,
    );
  });

  it("returns 1 at cronNextDate before the rule executes an hour later", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);

    expect(computeCronIntervalProgress(cronNextDate, 7, "days", cronNextDate)).toBe(1);
  });

  it("returns 0 exactly one hour after cronNextDate when the rule executes", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);

    expect(
      computeCronIntervalProgress(cronNextDate, 7, "days", cronNextDate + EXECUTION_DELAY),
    ).toBe(0);
  });

  it("returns 1 throughout the last 24 hours before the rule executes", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);
    const startOfFullWindow = cronNextDate - DAY + EXECUTION_DELAY;

    expect(
      computeCronIntervalProgress(cronNextDate, 7, "days", startOfFullWindow),
    ).toBe(1);
    expect(computeCronIntervalProgress(cronNextDate, 7, "days", cronNextDate)).toBe(1);
  });

  it("returns the fraction elapsed in the new cycle after the rule executes", () => {
    const cronNextDate = Date.UTC(2026, 6, 10, 12);
    const now = Date.UTC(2026, 6, 11, 12);

    expect(computeCronIntervalProgress(cronNextDate, 7, "days", now)).toBeCloseTo(
      23 / 144,
      5,
    );
  });

  it("returns the fraction of a monthly interval elapsed", () => {
    const cronNextDate = Date.UTC(2026, 6, 15, 12);
    const now = Date.UTC(2026, 6, 1, 12);

    expect(
      computeCronIntervalProgress(cronNextDate, 1, "months", now),
    ).toBeCloseTo(0.55477, 4);
  });

  it("uses the calendar-accurate previous occurrence (variable month lengths)", () => {
    // next occurrence Mar 31, previous occurrence Feb 28 (Feb has 28 days)
    const cronNextDate = Date.UTC(2026, 2, 31, 12);
    const now = Date.UTC(2026, 2, 14, 12);

    expect(
      computeCronIntervalProgress(cronNextDate, 1, "months", now),
    ).toBeCloseTo(0.47043, 4);
  });

  it("returns the fraction of a yearly interval elapsed", () => {
    const cronNextDate = Date.UTC(2027, 0, 1, 12);
    const now = Date.UTC(2026, 6, 2, 12);

    expect(
      computeCronIntervalProgress(cronNextDate, 1, "years", now),
    ).toBeCloseTo(0.50029, 4);
  });

  it("clamps to 0 before the start of the interval", () => {
    const cronNextDate = Date.UTC(2026, 6, 15, 12);
    const now = Date.UTC(2026, 5, 14, 12);

    expect(computeCronIntervalProgress(cronNextDate, 1, "months", now)).toBe(0);
  });

  it("returns 0 for a non-positive interval", () => {
    expect(
      computeCronIntervalProgress(Date.UTC(2026, 6, 15, 12), 0, "months", Date.UTC(2026, 6, 1)),
    ).toBe(0);
  });
});

describe("executePipeRule", () => {
  function mockCtx(pipe: any) {
    return {
      db: {
        get: vi.fn().mockResolvedValue(pipe),
        patch: vi.fn(),
      },
    } as any;
  }

  it("throws when the pipe is not found", async () => {
    const ctx = mockCtx(null);

    await expect(executePipeRule(ctx, "pipe-1" as any)).rejects.toThrow(
      "Pipe not found",
    );
  });

  it("patches fed to leftover and resets spent when no capUpdateValue", async () => {
    const ctx = mockCtx({ _id: "pipe-1", fed: 500, spent: 200, capacity: 1000 });

    await executePipeRule(ctx, "pipe-1" as any);

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
    });
  });

  it("updates capacity when capUpdateValue is set", async () => {
    const ctx = mockCtx({
      _id: "pipe-1",
      fed: 500,
      spent: 200,
      capacity: 1000,
      capUpdateValue: 100,
    });

    await executePipeRule(ctx, "pipe-1" as any);

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
      capacity: 400,
    });
  });

  it("advances cronNextDate to the next occurrence for cron rules", async () => {
    const ctx = mockCtx({
      _id: "pipe-1",
      fed: 500,
      spent: 200,
      capacity: 1000,
      capUpdateValue: 100,
      rule: "cron",
      cronInterval: { interval: 1, unit: "months" },
      cronNextDate: Date.UTC(2099, 0, 1, 12),
    });

    await executePipeRule(ctx, "pipe-1" as any);

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
      capacity: 400,
      cronNextDate: Date.UTC(2099, 0, 1, 5),
    });
  });

  it("advances cronNextDate relative to the provided now", async () => {
    const ctx = mockCtx({
      _id: "pipe-1",
      fed: 500,
      spent: 200,
      capacity: 1000,
      rule: "cron",
      cronInterval: { interval: 1, unit: "days" },
      cronNextDate: Date.UTC(2026, 5, 15, 12),
    });

    await executePipeRule(ctx, "pipe-1" as any, {
      now: Date.UTC(2026, 5, 15, 13),
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
      cronNextDate: Date.UTC(2026, 5, 16, 5),
    });
  });
});
