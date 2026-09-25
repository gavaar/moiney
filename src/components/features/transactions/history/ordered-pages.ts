export type OrderedPage<T> = { items: T[]; cursor: string | null; isDone: boolean };

export class OrderedPages<S extends string, T extends { date: number }> {
  private streams: Array<{ source: S; items: T[]; cursor?: string; done: boolean; visited: Set<string> }>;
  private seen = new Set<string>();
  private cancelled = false;

  constructor(
    sources: S[],
    private fetchPage: (source: S, cursor?: string) => Promise<OrderedPage<T>>,
    private key: (item: T) => string,
  ) {
    this.streams = sources.map((source) => ({ source, items: [], done: false, visited: new Set() }));
  }

  cancel() { this.cancelled = true; }

  private assertActive() {
    if (this.cancelled) throw new Error("History read cancelled");
  }

  private async fill(stream: (typeof this.streams)[number]) {
    while (!stream.done && stream.items.length === 0) {
      this.assertActive();
      const page = await this.fetchPage(stream.source, stream.cursor);
      this.assertActive();
      stream.items = page.items;
      stream.done = page.isDone || !page.cursor || stream.visited.has(page.cursor);
      if (page.cursor) stream.visited.add(page.cursor);
      stream.cursor = page.cursor ?? undefined;
    }
  }

  async next(limit: number): Promise<{ items: T[]; isDone: boolean }> {
    this.assertActive();
    const items: T[] = [];
    while (items.length < limit) {
      // Publish useful rows at a page boundary. A single archive can represent
      // years of transactions; its first render must not wait for all of them.
      if (items.length > 0 && this.streams.some((stream) => !stream.done && stream.items.length === 0)) break;
      await Promise.all(this.streams.map((stream) => this.fill(stream)));
      this.assertActive();
      // Equal-date ties retain source order and the server's opaque cursor order.
      const next = this.streams.filter((stream) => stream.items.length > 0)
        .sort((a, b) => b.items[0].date - a.items[0].date)[0];
      if (!next) break;
      const item = next.items.shift()!;
      const key = this.key(item);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      items.push(item);
    }
    return { items, isDone: this.streams.every((stream) => stream.done && stream.items.length === 0) };
  }
}
