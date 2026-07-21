export function calculateSpentUpdate(
  currentSpent: number | undefined,
  value: number,
): number {
  return (currentSpent ?? 0) + -1 * value;
}
