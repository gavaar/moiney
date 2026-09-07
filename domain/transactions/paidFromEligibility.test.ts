import { describe, expect, it } from "vitest";
import { preparePaidFromEligibility } from "./paidFromEligibility";

const id = (value: string) => value;
const logicalRoot = { id: id("logical-root") };
const logicalLeaf = { id: id("logical-leaf"), parentId: logicalRoot.id };
const payerRoot = { id: id("payer-root") };
const payerLeaf = { id: id("payer-leaf"), parentId: payerRoot.id };
const pipes = [logicalRoot, logicalLeaf, payerRoot, payerLeaf];
const eligible = preparePaidFromEligibility(pipes);

describe("preparePaidFromEligibility", () => {
  it("reuses prepared topology across expense and refund checks", () => {
    const eligible = preparePaidFromEligibility(pipes);

    for (let repeat = 0; repeat < 3; repeat++) {
      expect(eligible(logicalLeaf.id, payerLeaf.id, -500)).toBe(true);
      expect(eligible(logicalLeaf.id, payerRoot.id, -500)).toBe(false);
      expect(eligible(logicalLeaf.id, payerRoot.id, 500)).toBe(true);
      expect(eligible(logicalLeaf.id, payerLeaf.id, 500)).toBe(false);
      expect(eligible(logicalLeaf.id, payerLeaf.id, 0)).toBe(false);
      expect(eligible(logicalLeaf.id, logicalRoot.id, 500)).toBe(false);
    }
  });

  it("accepts an external leaf payer for a negative expense", () => {
    expect(eligible(logicalLeaf.id, payerLeaf.id, -500)).toBe(true);
  });

  it("rejects an external root payer for a negative expense", () => {
    expect(eligible(logicalLeaf.id, payerRoot.id, -500)).toBe(false);
  });

  it("accepts an external root for a positive refund", () => {
    expect(eligible(logicalLeaf.id, payerRoot.id, 500)).toBe(true);
  });

  it("rejects an external leaf for a positive refund", () => {
    expect(eligible(logicalLeaf.id, payerLeaf.id, 500)).toBe(false);
  });

  it("rejects a payer from the logical pipe's tree", () => {
    expect(eligible(logicalLeaf.id, logicalRoot.id, 500)).toBe(false);
  });

  it("rejects missing, deleting, and zero-value payer configurations", () => {
    const deletingPayer = {
      id: id("deleting-payer"),
      blocked: true,
    };
    const withDeletingPayer = [...pipes, deletingPayer];

    expect(eligible(logicalLeaf.id, id("missing"), -500)).toBe(false);
    expect(eligible(id("missing-logical"), payerLeaf.id, -500)).toBe(false);
    expect(preparePaidFromEligibility(withDeletingPayer)(logicalLeaf.id, deletingPayer.id, -500)).toBe(false);
    expect(eligible(logicalLeaf.id, payerLeaf.id, 0)).toBe(false);
  });

  it("rejects missing ancestors and topology cycles", () => {
    const missingAncestor = {
      id: id("orphan"),
      parentId: id("missing-parent"),
    };
    const cycleA = { id: id("cycle-a"), parentId: id("cycle-b") };
    const cycleB = { id: id("cycle-b"), parentId: id("cycle-a") };

    const selfCycle = { id: "self-cycle", parentId: "self-cycle" };
    const cycleChild = { id: "cycle-child", parentId: cycleA.id };
    const malformed = [missingAncestor, cycleChild, cycleA, cycleB, selfCycle];

    for (const topology of [malformed, [...malformed].reverse()]) {
      const eligible = preparePaidFromEligibility([...pipes, ...topology]);
      for (const pipe of malformed) {
        for (const value of [-500, 500]) {
          expect(eligible(pipe.id, payerLeaf.id, value)).toBe(false);
          expect(eligible(logicalLeaf.id, pipe.id, value)).toBe(false);
        }
      }
    }
  });

  it("checks the payer's blocked flag without changing ancestor or logical-pipe policy", () => {
    const eligible = preparePaidFromEligibility([
      { ...logicalRoot, blocked: true },
      { ...logicalLeaf, blocked: true },
      { ...payerRoot, blocked: true },
      payerLeaf,
    ]);

    expect(eligible(logicalLeaf.id, payerLeaf.id, -500)).toBe(true);
    expect(eligible(logicalLeaf.id, payerRoot.id, 500)).toBe(false);
  });
});
