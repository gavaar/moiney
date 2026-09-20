import { describe, expect, it, vi } from "vitest";
import { OrderedPages } from "./ordered-pages";

describe("ordered history pagination", () => {
  it("retains unconsumed source rows, crosses empty filtered pages, and deduplicates archives at their latest date", async () => {
    const pages = {
      transactions: [
        { items: [{ id: "trip", date: 9 }, { id: "expense", date: 7 }], cursor: "t1", isDone: false },
        { items: [{ id: "trip", date: 6 }], cursor: "t2", isDone: false },
        { items: [{ id: "old", date: 1 }], cursor: null, isDone: true },
      ],
      events: [
        { items: [], cursor: "e1", isDone: false },
        { items: [{ id: "creation", date: 8 }, { id: "older-creation", date: 5 }], cursor: null, isDone: true },
      ],
    };
    const reader = new OrderedPages(Object.keys(pages) as Array<keyof typeof pages>,
      async (source) => pages[source].shift()!, (item) => item.id);
    expect((await reader.next(2)).items.map((item) => item.id)).toEqual(["trip", "creation"]);
    const remaining: string[] = [];
    for (let i = 0; i < 5; i++) {
      const page = await reader.next(2);
      remaining.push(...page.items.map((item) => item.id));
      if (page.isDone) break;
    }
    expect(remaining).toEqual(["expense", "older-creation", "old"]);
  });
  it("shows a newly found archive without scanning its entire transaction lifetime first", async () => {
    const fetchPage = vi.fn(async () => ({
      items: [{ id: "trip", date: 100 }], cursor: String(fetchPage.mock.calls.length),
      isDone: fetchPage.mock.calls.length >= 100,
    }));
    const reader = new OrderedPages(["transactions"], fetchPage, (item) => item.id);
    expect(await reader.next(100)).toEqual({ items: [{ id: "trip", date: 100 }], isDone: false });
    expect(fetchPage).toHaveBeenCalledOnce();
  });
  it("does not loop on a stuck cursor and stops further reads when cancelled", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [], cursor: "stuck", isDone: false });
    const reader = new OrderedPages(["one"], fetchPage, (item: { id: string; date: number }) => item.id);
    expect(await reader.next(10)).toEqual({ items: [], isDone: true });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    reader.cancel();
    await expect(reader.next(10)).rejects.toThrow("cancelled");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
