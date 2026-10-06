import { ConvexError } from "convex/values";

export function validateDateRange(dates: { fromDate?: number; toDate?: number }) {
  if ([dates.fromDate, dates.toDate].some(date => date !== undefined && !Number.isFinite(date)) ||
    (dates.fromDate !== undefined && dates.toDate !== undefined && dates.fromDate > dates.toDate)) {
    throw new ConvexError({ code: "INVALID_TRANSACTION_DATE_RANGE" });
  }
}

export function pageLimit(limit = 30) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ConvexError({ code: "INVALID_HISTORY_LIMIT" });
  return limit;
}
