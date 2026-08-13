import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  assertAmountLimit,
  divideMoney,
  formatMoneyInput,
  parseMoney,
  validateTransactionAmount,
} from "./money";

describe("parseMoney", () => {
  it("returns a plain number", () => {
    type IsExactlyNumber<T> = [T] extends [number]
      ? [number] extends [T]
        ? true
        : false
      : false;

    const result: IsExactlyNumber<ReturnType<typeof parseMoney>> = true;
    expect(result).toBe(true);
  });

  it.each([
    ["12.34", 1234],
    ["-0.05", -5],
    ["0", 0],
    ["1000000000.00", 100000000000],
  ])("parses %s as %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "-", "1.234", "1000000000.01", "12e2"])(
    "rejects invalid amount %s",
    (input) => {
      expect(() => parseMoney(input)).toThrow();
    },
  );
});

describe("assertAmountLimit", () => {
  it("accepts safe integer amounts within the configured limit", () => {
    expect(assertAmountLimit(1234)).toBe(1234);
  });

  it.each([1.5, MAX_AMOUNT + 1])("rejects invalid amount %s", (amount) => {
    expect(() => assertAmountLimit(amount)).toThrow();
  });
});

describe("validateTransactionAmount", () => {
  it("accepts positive feeds and nonzero signed transactions", () => {
    expect(validateTransactionAmount(1, "feed")).toBe(1);
    expect(validateTransactionAmount(-1, "transaction")).toBe(-1);
    expect(validateTransactionAmount(1, "transaction")).toBe(1);
  });

  it.each([
    [0, "feed"],
    [0, "transaction"],
    [1.5, "transaction"],
    [MAX_AMOUNT + 1, "transaction"],
  ] as const)("rejects invalid amount %s for %s", (value, kind) => {
    expect(() => validateTransactionAmount(value, kind)).toThrow();
  });
});

describe("formatMoneyInput", () => {
  it.each([
    [1234, "12.34"],
    [-5, "-0.05"],
    [0, "0.00"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatMoneyInput(input)).toBe(expected);
  });
});

describe("divideMoney", () => {
  it("rounds to the nearest integer amount and reports drift", () => {
    expect(divideMoney(100, 3)).toEqual({
      rounded: 33,
      remainder: 1,
      drift: -1,
    });
  });

  it("rounds negative values away from zero at a half", () => {
    expect(divideMoney(-5, 2)).toEqual({
      rounded: -3,
      remainder: -1,
      drift: -1,
    });
  });
});
