import { describe, expect, it } from "vitest";
import { previewChildContingencyOptions } from "./contingencyEligibility";

describe("creation contingency preview", () => {
  const pipes = [
    { id: "root" },
    { id: "owner", parentId: "root", contingencyPipeId: "reserve" },
    { id: "reserve", parentId: "root" },
    { id: "former-source", parentId: "root", contingencyPipeId: "owner" },
    { id: "other-root" },
  ];
  it("uses post-creation topology after owner and incoming contingency resets", () => {
    expect(previewChildContingencyOptions(pipes, "owner")).toEqual(["former-source", "reserve"]);
  });
  it.each(["instant_settlement", "self_destruct"] as const)("has no eligible contingency for %s", rule => {
    expect(previewChildContingencyOptions(pipes, "owner", rule)).toEqual([]);
  });
  it("rejects missing or blocked owners", () => {
    expect(previewChildContingencyOptions(pipes, "missing")).toEqual([]);
    expect(previewChildContingencyOptions(pipes.map(pipe => ({ ...pipe, blocked: pipe.id === "owner" })), "owner")).toEqual([]);
  });
});
