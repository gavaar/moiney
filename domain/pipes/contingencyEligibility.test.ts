import { describe, expect, it } from "vitest";
import { prepareContingencyEligibility } from "./contingencyEligibility";
import type { PipeRule } from "./rules";

const topology = [
  { id: "root" },
  { id: "household", parentId: "root" },
  { id: "food", parentId: "household" },
  { id: "groceries", parentId: "food" },
  { id: "coffee", parentId: "food" },
  { id: "household-reserve", parentId: "household" },
  { id: "root-reserve", parentId: "root" },
  { id: "other-branch", parentId: "root" },
  { id: "cousin", parentId: "other-branch" },
  { id: "other-root" },
  { id: "other-tree", parentId: "other-root" },
];

describe("contingency target eligibility", () => {
  it("returns only leaf siblings of the source or its ancestors, in stable ID order", () => {
    const eligible = prepareContingencyEligibility(topology);
    expect(eligible("groceries")).toEqual(["coffee", "household-reserve", "root-reserve"]);
    expect(prepareContingencyEligibility([...topology].reverse())("groceries")).toEqual(eligible("groceries"));
    expect(eligible("food")).toEqual([]);
    expect(eligible("root")).toEqual([]);
    expect(eligible("missing")).toEqual([]);
  });

  it("prevents chains in either direction while allowing several sources to share a donor", () => {
    const outgoing = prepareContingencyEligibility(topology.map(pipe => pipe.id === "coffee"
      ? { ...pipe, contingencyPipeId: "root-reserve" } : pipe));
    expect(outgoing("groceries")).toEqual(["household-reserve", "root-reserve"]);

    const incoming = prepareContingencyEligibility(topology.map(pipe => pipe.id === "coffee"
      ? { ...pipe, contingencyPipeId: "groceries" } : pipe));
    expect(incoming("groceries")).toEqual([]);

    const shared = prepareContingencyEligibility(topology.map(pipe => ["groceries", "coffee"].includes(pipe.id)
      ? { ...pipe, contingencyPipeId: "root-reserve" } : pipe));
    expect(shared("groceries")).toContain("root-reserve");
    expect(shared("coffee")).toContain("root-reserve");
    expect(shared("root-reserve")).toEqual([]);
  });

  it.each(["instant_settlement", "self_destruct"] satisfies PipeRule[])("does not offer coverage for %s sources", rule => {
    const eligible = prepareContingencyEligibility(topology.map(pipe => pipe.id === "groceries" ? { ...pipe, rule } : pipe));
    expect(eligible("groceries")).toEqual([]);
  });

  it("excludes blocked sources, donors, and ancestry without excluding an instant-settlement donor", () => {
    for (const id of ["groceries", "household", "root"]) {
      const eligible = prepareContingencyEligibility(topology.map(pipe => pipe.id === id ? { ...pipe, blocked: true } : pipe));
      expect(eligible("groceries")).toEqual([]);
    }
    const eligible = prepareContingencyEligibility(topology.map(pipe => pipe.id === "coffee"
      ? { ...pipe, blocked: true } : pipe.id === "root-reserve" ? { ...pipe, rule: "instant_settlement" as const } : pipe));
    expect(eligible("groceries")).toEqual(["household-reserve", "root-reserve"]);
  });

  it("fails closed for orphaned or cyclic ancestry", () => {
    const malformed = [
      { id: "orphan", parentId: "missing" }, { id: "orphan-sibling", parentId: "missing" },
      { id: "cycle-a", parentId: "cycle-b" }, { id: "cycle-b", parentId: "cycle-a" },
      { id: "cycle-child", parentId: "cycle-a" }, { id: "self-cycle", parentId: "self-cycle" },
    ];
    for (const pipes of [[...topology, ...malformed], [...topology, ...malformed].reverse()]) {
      const eligible = prepareContingencyEligibility(pipes);
      for (const pipe of malformed) expect(eligible(pipe.id)).toEqual([]);
      expect(eligible("groceries")).toEqual(["coffee", "household-reserve", "root-reserve"]);
    }
  });
});
