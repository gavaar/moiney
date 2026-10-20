export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function sanitizeDecimal(input: string): string {
  const cleaned = input.replace(/-/g, "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
}
