export const MONEY_SCALE = 100;
export const MAX_AMOUNT = 100_000_000_000;

function assertSafeAmount(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money must be a safe integer amount");
  }
  return value;
}

export function assertAmountLimit(amount: number): number {
  if (Math.abs(amount) > MAX_AMOUNT) {
    throw new Error("Amount exceeds the maximum allowed value");
  }
  return assertSafeAmount(amount);
}

function decimalAmount(input: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw new Error("Enter an amount with at most two decimals");

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const digits = BigInt(`${match[2]}${fraction}`);
  return sign * digits * 10n ** BigInt(2 - fraction.length);
}

export function parseMoney(input: string): number {
  return assertAmountLimit(Number(decimalAmount(input.trim())));
}

export function formatMoneyInput(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new Error("Money must be a safe integer amount");
  }

  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute / MONEY_SCALE);
  const fraction = String(absolute % MONEY_SCALE).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function validateTransactionAmount(
  value: number,
  kind: "feed" | "transaction",
): number {
  const amount = assertAmountLimit(value);
  if (kind === "feed" && amount <= 0) {
    throw new Error("Feed amount must be positive");
  }
  if (kind === "transaction" && amount === 0) {
    throw new Error("Transaction amount cannot be zero");
  }
  return amount;
}

export function divideMoney(
  value: number,
  divisor: number,
): { rounded: number; remainder: number; drift: number } {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new Error("Money division requires a positive safe integer divisor");
  }
  const base = Math.trunc(value / divisor);
  const remainder = value - base * divisor;
  const adjustment = Math.abs(remainder) * 2 >= divisor ? Math.sign(value) : 0;
  const rounded = assertAmountLimit(base + adjustment);
  return { rounded, remainder, drift: rounded * divisor - value };
}
