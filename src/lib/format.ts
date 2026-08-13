const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "auto",
});

export function formatAmount(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money must be a safe integer number of cents");
  }
  return MONEY_FORMATTER.format(value / 100);
}
