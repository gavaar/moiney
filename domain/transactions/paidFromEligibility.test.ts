import { describe, expect, it } from "vitest";
import { isPaidFromEligible } from "./paidFromEligibility";

const id = (value: string) => value;
const logicalRoot = { id: id("logical-root") };
const logicalLeaf = { id: id("logical-leaf"), parentId: logicalRoot.id };
const payerRoot = { id: id("payer-root") };
const payerLeaf = { id: id("payer-leaf"), parentId: payerRoot.id };
const pipes = [logicalRoot, logicalLeaf, payerRoot, payerLeaf];

describe("isPaidFromEligible", () => {
  it("accepts an external leaf payer for a negative expense", () => {
    expect(isPaidFromEligible(pipes, logicalLeaf.id, payerLeaf.id, -500)).toBe(true);
  });

  it("rejects an external root payer for a negative expense", () => {
    expect(isPaidFromEligible(pipes, logicalLeaf.id, payerRoot.id, -500)).toBe(false);
  });

  it("accepts an external root for a positive refund", () => {
    expect(isPaidFromEligible(pipes, logicalLeaf.id, payerRoot.id, 500)).toBe(true);
  });

  it("rejects an external leaf for a positive refund", () => {
    expect(isPaidFromEligible(pipes, logicalLeaf.id, payerLeaf.id, 500)).toBe(false);
  });

  it("rejects a payer from the logical pipe's tree", () => {
    expect(isPaidFromEligible(pipes, logicalLeaf.id, logicalRoot.id, 500)).toBe(false);
  });

  it("rejects missing, deleting, and zero-value payer configurations", () => {
    const deletingPayer = {
      id: id("deleting-payer"),
      blocked: true,
    };
    const withDeletingPayer = [...pipes, deletingPayer];

    expect(isPaidFromEligible(pipes, logicalLeaf.id, id("missing"), -500)).toBe(false);
    expect(isPaidFromEligible(pipes, id("missing-logical"), payerLeaf.id, -500)).toBe(false);
    expect(isPaidFromEligible(withDeletingPayer, logicalLeaf.id, deletingPayer.id, -500)).toBe(false);
    expect(isPaidFromEligible(pipes, logicalLeaf.id, payerLeaf.id, 0)).toBe(false);
  });

  it("rejects missing ancestors and topology cycles", () => {
    const missingAncestor = {
      id: id("orphan"),
      parentId: id("missing-parent"),
    };
    const cycleA = { id: id("cycle-a"), parentId: id("cycle-b") };
    const cycleB = { id: id("cycle-b"), parentId: id("cycle-a") };

    expect(isPaidFromEligible([...pipes, missingAncestor], missingAncestor.id, payerLeaf.id, -500)).toBe(false);
    expect(isPaidFromEligible([...pipes, cycleA, cycleB], cycleA.id, payerLeaf.id, -500)).toBe(false);
  });
});
