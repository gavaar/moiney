export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export type Cursor = { year: number; month: number };

const GRID_SIZE = 42;

export function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length < GRID_SIZE) cells.push(null);

  return cells;
}

export function addMonths(cursor: Cursor, delta: number): Cursor {
  const index = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(index / 12), month: index % 12 };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}

export function getYearRange(year: number): number[] {
  const start = year - 5;
  return Array.from({ length: 10 }, (_, i) => start + i);
}

export function yearRangeLabel(year: number): string {
  const range = getYearRange(year);
  return `${range[0]} - ${range[range.length - 1]}`;
}

export function buildUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12));
}
