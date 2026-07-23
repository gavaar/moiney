import { describe, expect, it } from "vitest";
import {
  calculatePipeAllocations,
  computePipeDerivedValues,
  computePipeTree,
  recalculatePipes,
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
