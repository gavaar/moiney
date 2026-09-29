// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { pipeViewStorage } from "./storage.web";

describe("pipe view preferences", () => {
  beforeEach(() => localStorage.clear());

  it("persists per account across reads without sharing preferences with another account", async () => {
    await pipeViewStorage.write("deployment:alice", JSON.stringify(["pipe-1"]));

    expect(await pipeViewStorage.read("deployment:alice")).toBe('["pipe-1"]');
    expect(await pipeViewStorage.read("deployment:bob")).toBeNull();
  });
});
