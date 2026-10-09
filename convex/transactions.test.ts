import { expect, it, vi } from "vitest";
import { cleanupStaleTitleUsage } from "./transactions";

it("deletes one bounded stale-title batch and schedules the next batch", async () => {
  const staleRows = Array.from({ length: 100 }, (_, index) => ({ _id: `usage-${index}` }));
  const take = vi.fn().mockResolvedValue(staleRows);
  const lt = vi.fn();
  const withIndex = vi.fn((_name, range) => { range({ lt }); return { take }; });
  const ctx = { db: { query: vi.fn(() => ({ withIndex })), delete: vi.fn() }, scheduler: { runAfter: vi.fn() } };
  await (cleanupStaleTitleUsage as any)._handler(ctx, { now: 1_000_000 });
  expect(withIndex).toHaveBeenCalledWith("by_lastUsedAt", expect.any(Function));
  expect(lt).toHaveBeenCalledWith("lastUsedAt", 1_000_000 - 365 * 24 * 60 * 60 * 1000);
  expect(take).toHaveBeenCalledWith(100);
  expect(ctx.db.delete).toHaveBeenCalledTimes(100);
  expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), { now: 1_000_000 });
});
