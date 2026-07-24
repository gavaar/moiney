export function toTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isValidAmount(input: string): boolean {
  if (input === "") return false;
  const n = parseFloat(input);
  return !Number.isNaN(n) && n > 0;
}