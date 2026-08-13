import { describe, expect, it } from "vitest";
import {
  MAX_CENTS,
  formatCents,
  migrateNumberToCents,
  parseCents,
  allocateRoundedCents,
  migratePipeForest,
  resolveCents,
  validateTransactionCents,
} from "./money";

describe("parseCents", () => {
  it.each([
    ["12.34", 1234],
    ["-0.05", -5],
    ["0", 0],
    ["1000000000.00", 100000000000],
  ])("parses %s as %s cents", (input, expected) => {
    expect(parseCents(input)).toBe(expected);
  });

  it.each(["", "-", "1.234", "1000000000.01", "12e2"]) (
    "rejects invalid amount %s",
    (input) => {
      expect(() => parseCents(input)).toThrow();
    },
  );
});

describe("validateTransactionCents", () => {
  it("accepts positive feed amounts and nonzero signed transaction amounts", () => {
    expect(validateTransactionCents(1, "feed")).toBe(1);
    expect(validateTransactionCents(-1, "transaction")).toBe(-1);
    expect(validateTransactionCents(1, "transaction")).toBe(1);
  });

  it.each([
    [0, "feed"],
    [0, "transaction"],
    [1.5, "transaction"],
    [MAX_CENTS + 1, "transaction"],
  ] as const)("rejects invalid amount %s for %s", (value, kind) => {
    expect(() => validateTransactionCents(value, kind)).toThrow();
  });
});

describe("migrateNumberToCents", () => {
  it.each([
    [1.005, 101],
    [-1.005, -101],
    [12.345, 1235],
    [-12.345, -1235],
    [0.004, 0],
    [-0.005, -1],
  ])("rounds %s half away from zero to %s cents", (input, expected) => {
    expect(migrateNumberToCents(input)).toBe(expected);
  });
});

describe("formatCents", () => {
  it.each([
    [1234, "12.34"],
    [-5, "-0.05"],
    [0, "0.00"],
  ])("formats %s cents as %s", (input, expected) => {
    expect(formatCents(input)).toBe(expected);
  });
});

describe("resolveCents", () => {
  it("prefers an already migrated cents value", () => {
    expect(resolveCents(1234, 99.99)).toBe(1234);
  });

  it("converts a legacy major-unit value when cents are absent", () => {
    expect(resolveCents(undefined, 12.34)).toBe(1234);
  });
});

describe("allocateRoundedCents", () => {
  it("preserves a rounded total with stable remainder assignment", () => {
    expect(
      allocateRoundedCents([
        { id: "b", value: 0.005 },
        { id: "a", value: 0.005 },
        { id: "c", value: 0 },
      ]),
    ).toEqual([
      { id: "b", cents: 0 },
      { id: "a", cents: 1 },
      { id: "c", cents: 0 },
    ]);
  });

  it("preserves a rounded negative total with stable remainder assignment", () => {
    expect(
      allocateRoundedCents([
        { id: "b", value: -0.005 },
        { id: "a", value: -0.005 },
        { id: "c", value: 0 },
      ]),
    ).toEqual([
      { id: "b", cents: 0 },
      { id: "a", cents: -1 },
      { id: "c", cents: 0 },
    ]);
  });
});

describe("migratePipeForest", () => {
  it("converts each root tree while preserving its rounded fed total", () => {
    expect(
      migratePipeForest([
        { id: "root", fed: 0.005, capacity: 1, spent: 0 },
        { id: "child", parentId: "root", fed: 0.005, capacity: 1, spent: 0 },
      ]),
    ).toEqual([
      { id: "root", parentId: undefined, fedCents: 0, capacityCents: 100, spentCents: 0 },
      { id: "child", parentId: "root", fedCents: 1, capacityCents: 100, spentCents: 0 },
    ]);
  });

  it("rejects an invalid pipe topology", () => {
    expect(() =>
      migratePipeForest([
        { id: "root", parentId: "missing", fed: 0, capacity: 1, spent: 0 },
      ]),
    ).toThrow("Pipe parent not found");
  });
});
