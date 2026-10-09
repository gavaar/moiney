import { expect, it, vi } from "vitest";
import { create } from "./financialOperations";

vi.mock("./lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue("user-1") }));

function context(pipes: Record<string, object>) {
  let count = 0;
  const chain: any = { withIndex: vi.fn(() => chain), take: vi.fn().mockResolvedValue([]),
    collect: vi.fn().mockResolvedValue([]), first: vi.fn().mockResolvedValue(null) };
  return { db: { get: vi.fn(async (_table, id) => pipes[id] ?? null), query: vi.fn(() => chain),
    patch: vi.fn(), insert: vi.fn(async () => `event-${++count}`) } };
}

const source = { _id: "source", userId: "user-1", fed: 500, spent: 100 };
const payer = { _id: "payer", userId: "user-1", fed: 200, spent: 50 };

it("rereads the feed destination once for post-write reconciliation", async () => {
  const ctx = context({ source });
  await (create as any)._handler(ctx, { title: "salary", value: 1000, date: 1, to: "source" });
  expect(ctx.db.get.mock.calls).toEqual([["pipes", "source"], ["pipes", "source"]]);
});

it("rereads each pay-by-transfer root once for post-write reconciliation", async () => {
  const ctx = context({ source, payer });
  await (create as any)._handler(ctx, { title: "coffee", value: -30, date: 1, from: "source", paidFrom: "payer" });
  expect(ctx.db.get).toHaveBeenCalledTimes(4);
  expect(ctx.db.get.mock.calls.filter(([, id]) => id === "source")).toHaveLength(2);
  expect(ctx.db.get.mock.calls.filter(([, id]) => id === "payer")).toHaveLength(2);
});

it("reads a shared ancestor only once while rejecting a payer in the same tree", async () => {
  const ctx = context({ source: { ...source, parentId: "root" }, payer: { ...payer, parentId: "root" }, root: { ...source, _id: "root" } });
  await expect((create as any)._handler(ctx, { title: "coffee", value: -30, date: 1, from: "source", paidFrom: "payer" }))
    .rejects.toThrow("Paid from pipe must be outside the transaction tree");
  expect(ctx.db.get).toHaveBeenCalledTimes(3);
  expect(ctx.db.patch).not.toHaveBeenCalled();
});
