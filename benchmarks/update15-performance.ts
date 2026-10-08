import type { Id } from "../convex/_generated/dataModel";
import { groupHistoryEvents, type HistoryEntry } from "../src/components/features/transactions/history/event-groups";
import { buildTreeRows } from "../src/components/features/pipes/PipeTreeView/treeRows";
import type { PipeModel } from "../src/components/features/pipes/data/pipes";

const pipeSizes = [20, 200, 500];
const historySizes = [100, 300, 500];

function percentile(values: number[], fraction: number): number {
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
}

function measure(
  operation: string,
  inputSize: number,
  run: () => readonly unknown[],
): void {
  const warmupRuns = 5;
  const measuredRuns = inputSize >= 500 ? 40 : 80;

  for (let index = 0; index < warmupRuns; index += 1) run();

  const durations: number[] = [];
  let outputCount = 0;
  for (let index = 0; index < measuredRuns; index += 1) {
    const startedAt = performance.now();
    const output = run();
    durations.push(performance.now() - startedAt);
    outputCount = output.length;
  }

  durations.sort((left, right) => left - right);
  console.log(
    JSON.stringify({
      suite: "update15-js-baseline",
      operation,
      inputSize,
      outputCount,
      p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
      p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    }),
  );
}

function makePipe(id: string, overrides: Partial<PipeModel> = {}): PipeModel {
  return {
    id: id as Id<"pipes">,
    name: id,
    icon: "pipe",
    priority: 0,
    capacity: 1000,
    fed: 500,
    spent: 200,
    ...overrides,
  };
}

function makeTree(size: number): {
  feeds: PipeModel[];
  childrenByParent: Map<PipeModel["id"], PipeModel[]>;
} {
  const root = makePipe("root", { capacity: 0, fed: 0, spent: 0 });
  const children = Array.from({ length: size - 1 }, (_, index) =>
    makePipe(`child-${index}`, {
      priority: index,
      capacity: 1000 + (index % 7) * 100,
      fed: 500 + (index % 5) * 25,
      spent: 200 + (index % 3) * 10,
    }),
  );
  return {
    feeds: [root],
    childrenByParent: new Map([[root.id, children]]),
  };
}

function makeEvents(size: number): HistoryEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `event-${index}` as Id<"events">,
    operationId: `event-${index}` as Id<"events">,
    createdAt: index,
    title: `title-${index % 10}`,
    value: index % 2 === 0 ? -100 : 100,
    occurredAt: Date.UTC(2026, 0, 1) + index * 86_400_000,
    type: "transaction" as const,
    pipeId: "pipe-1" as Id<"pipes">,
  }));
}

for (const size of pipeSizes) {
  const { feeds, childrenByParent } = makeTree(size);
  measure("build-tree-rows", size, () =>
    buildTreeRows(feeds, childrenByParent),
  );
}

for (const size of historySizes) {
  const events = makeEvents(size);
  measure("group-history-events", size, () =>
    groupHistoryEvents(events),
  );
}
