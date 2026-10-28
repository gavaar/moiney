import { describe, expect, it } from "vitest";
import { createRuleDraft, ruleDraftValues } from "./rule-draft";

describe("rule draft normalization", () => {
  it.each([
    { value: "feed" },
    { value: "boiler" },
    { value: "unknown-rule" },
    { value: "constructor" },
    { value: "toString" },
    { value: "__proto__" },
    { value: ["cron"] },
    { value: null },
    { value: undefined },
  ])("falls back to no rule for unsupported runtime values ($value)", ({ value }) => {
    const draft = createRuleDraft();
    Reflect.set(draft, "selectedRule", value);

    expect(ruleDraftValues(draft).selectedRule).toBe("none");
  });
});
