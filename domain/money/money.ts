export const MAX_MAJOR_UNITS = 1_000_000_000;
export const CENTS_PER_UNIT = 100;
export const MAX_CENTS = MAX_MAJOR_UNITS * CENTS_PER_UNIT;

export type Cents = number & { readonly __brand: "cents" };

function asCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money must be a safe integer number of cents");
  }
  return value as Cents;
}

function assertInputLimit(cents: number): Cents {
  if (Math.abs(cents) > MAX_CENTS) {
    throw new Error("Amount exceeds the maximum allowed value");
  }
  return asCents(cents);
}

function decimalCents(input: string, allowExponent: boolean): bigint {
  const pattern = allowExponent
    ? /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i
    : /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
  const match = pattern.exec(input);
  if (!match) throw new Error("Enter an amount with at most two decimals");

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? 0);
  const digits = BigInt(`${whole}${fraction}`);
  const decimalPlaces = fraction.length - exponent;

  if (decimalPlaces <= 2) {
    return sign * digits * 10n ** BigInt(2 - decimalPlaces);
  }

  const divisor = 10n ** BigInt(decimalPlaces - 2);
  const absolute = digits / divisor;
  const remainder = digits % divisor;
  const rounded = remainder * 2n >= divisor ? absolute + 1n : absolute;
  return sign * rounded;
}

function scaledRational(input: string): { numerator: bigint; denominator: bigint } {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(input);
  if (!match) throw new Error("Money must be a decimal number");

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const shift = 2 + Number(match[4] ?? 0) - fraction.length;
  const digits = sign * BigInt(`${match[2]}${fraction}`);

  return shift >= 0
    ? { numerator: digits * 10n ** BigInt(shift), denominator: 1n }
    : { numerator: digits, denominator: 10n ** BigInt(-shift) };
}

export function parseCents(input: string): Cents {
  const value = input.trim();
  return assertInputLimit(Number(decimalCents(value, false)));
}

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Money must be a safe integer number of cents");
  }

  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / CENTS_PER_UNIT);
  const fraction = String(absolute % CENTS_PER_UNIT).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function migrateNumberToCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new Error("Money must be finite");
  }

  if (Math.abs(value) > MAX_MAJOR_UNITS + 0.01) {
    throw new Error("Amount exceeds the maximum allowed value");
  }

  return assertInputLimit(Number(decimalCents(value.toString(), true)));
}

export function resolveCents(
  cents: number | undefined,
  legacyMajorUnits: number | undefined,
): Cents {
  if (cents !== undefined) return asCents(cents);
  if (legacyMajorUnits === undefined) {
    throw new Error("Missing monetary value");
  }
  return migrateNumberToCents(legacyMajorUnits);
}

export function validateTransactionCents(
  value: number,
  kind: "feed" | "transaction",
): Cents {
  const cents = asCents(value);
  if (Math.abs(cents) > MAX_CENTS) {
    throw new Error("Amount exceeds the maximum allowed value");
  }
  if (kind === "feed" && cents <= 0) {
    throw new Error("Feed amount must be positive");
  }
  if (kind === "transaction" && cents === 0) {
    throw new Error("Transaction amount cannot be zero");
  }
  return cents;
}

export function validateCents(value: number): Cents {
  if (Math.abs(value) > MAX_CENTS) {
    throw new Error("Amount exceeds the maximum allowed value");
  }
  return asCents(value);
}

export function divideCents(
  value: number,
  divisor: number,
): { rounded: Cents; remainder: number; drift: number } {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new Error("Cents division requires a positive safe integer divisor");
  }
  const base = Math.trunc(value / divisor);
  const remainder = value - base * divisor;
  const adjustment = Math.abs(remainder) * 2 >= divisor ? Math.sign(value) : 0;
  const rounded = validateCents(base + adjustment);
  return { rounded, remainder, drift: rounded * divisor - value };
}

export function allocateRoundedCents<TId extends string>(
  values: Array<{ id: TId } & ({ value: number } | { cents: number })>,
): Array<{ id: TId; cents: Cents }> {
  const rationals = values.map((entry) => ({
    ...entry,
    ...("cents" in entry
      ? { numerator: BigInt(entry.cents), denominator: 1n }
      : scaledRational(entry.value.toString())),
  }));
  const denominator = rationals.reduce(
    (max, entry) => (entry.denominator > max ? entry.denominator : max),
    1n,
  );
  const exact = rationals.map((entry) => {
    const numerator = entry.numerator * (denominator / entry.denominator);
    const base = numerator >= 0n
      ? numerator / denominator
      : -((-numerator) / denominator);
    return {
      ...entry,
      base,
      remainder: numerator - base * denominator,
    };
  });
  const totalNumerator = exact.reduce((sum, entry) => sum + entry.numerator * (denominator / entry.denominator), 0n);
  const absoluteTotal = totalNumerator < 0n ? -totalNumerator : totalNumerator;
  let target = absoluteTotal / denominator;
  if (absoluteTotal % denominator * 2n >= denominator) target += 1n;
  if (totalNumerator < 0n) target = -target;
  const baseTotal = exact.reduce((sum, entry) => sum + entry.base, 0n);
  let remaining = Number(target - baseTotal);
  const direction = remaining < 0 ? -1 : 1;
  const ordered = [...exact].sort((a, b) =>
    a.remainder === b.remainder
      ? a.id.localeCompare(b.id)
      : direction > 0
        ? a.remainder > b.remainder ? -1 : 1
        : a.remainder < b.remainder ? -1 : 1,
  );
  const adjustments = new Map<TId, number>();
  remaining = Math.abs(remaining);
  for (const entry of ordered) {
    if (remaining === 0) break;
    adjustments.set(entry.id, direction);
    remaining -= 1;
  }
  return exact.map((entry) => ({
    id: entry.id,
    cents: asCents(Number(entry.base) + (adjustments.get(entry.id) ?? 0)),
  }));
}

export function migratePipeForest<TId extends string>(
  pipes: Array<{
    id: TId;
    parentId?: TId;
    fed: number;
    capacity: number;
    spent: number;
    capUpdateValue?: number;
    alreadyCents?: boolean;
  }>,
  ): Array<{
  id: TId;
  parentId?: TId;
  fedCents: Cents;
  capacityCents: Cents;
  spentCents: Cents;
  capUpdateValueCents?: Cents;
}> {
  const byId = new Map(pipes.map((pipe) => [pipe.id, pipe]));
  for (const pipe of pipes) {
    if (pipe.parentId !== undefined && !byId.has(pipe.parentId)) {
      throw new Error("Pipe parent not found");
    }
  }

  const children = new Map<TId, TId[]>();
  for (const pipe of pipes) {
    if (pipe.parentId !== undefined) {
      children.set(pipe.parentId, [...(children.get(pipe.parentId) ?? []), pipe.id]);
    }
  }

  const roots = pipes.filter((pipe) => pipe.parentId === undefined);
  const result = new Map<TId, { fedCents: Cents; capacityCents: Cents; spentCents: Cents; capUpdateValueCents?: Cents }>();
  for (const root of roots) {
    const members: typeof pipes = [];
    const visit = (id: TId, path: Set<TId>) => {
      if (path.has(id)) throw new Error("Pipe topology contains a cycle");
      const pipe = byId.get(id)!;
      members.push(pipe);
      const nextPath = new Set(path).add(id);
      for (const childId of children.get(id) ?? []) visit(childId, nextPath);
    };
    visit(root.id, new Set());
    const fed = allocateRoundedCents(
      members.map((pipe) =>
        pipe.alreadyCents
          ? { id: pipe.id, cents: pipe.fed }
          : { id: pipe.id, value: pipe.fed },
      ),
    );
    const fedById = new Map(fed.map((entry) => [entry.id, entry.cents]));
    for (const pipe of members) {
      result.set(pipe.id, {
        fedCents: fedById.get(pipe.id)!,
        capacityCents: pipe.alreadyCents
          ? validateCents(pipe.capacity)
          : migrateNumberToCents(pipe.capacity),
        spentCents: pipe.alreadyCents
          ? validateCents(pipe.spent)
          : migrateNumberToCents(pipe.spent),
        ...(pipe.capUpdateValue !== undefined
          ? {
              capUpdateValueCents: pipe.alreadyCents
                ? validateCents(pipe.capUpdateValue)
                : migrateNumberToCents(pipe.capUpdateValue),
            }
          : {}),
      });
    }
  }

  if (result.size !== pipes.length) throw new Error("Pipe topology contains a cycle");
  return pipes.map((pipe) => ({
    id: pipe.id,
    parentId: pipe.parentId,
    ...result.get(pipe.id)!,
  }));
}

export function assertCents(value: number): asserts value is Cents {
  asCents(value);
}
