// Temporary synthetic CPU baseline. This does not measure React, Hermes, or native frames.
import type { Id } from "../convex/_generated/dataModel";
import type { DeletedPipeEntry } from "../src/components/features/pipes/data/deletedPipes";
import { groupMonthlyEventHistory } from "../src/components/features/transactions/history/events/event-archives";
import type { HistoryEntry } from "../src/components/features/transactions/history/events/event-groups";

const sizes = [100, 300, 1000, 3000, 10000];
const epoch = Date.UTC(2026, 9, 1);

function fixture(size: number, growingGroups: boolean, archiveCount: number) {
  const entries: HistoryEntry[] = Array.from({ length: size }, (_, index) => ({
    id: `event-${index}` as Id<"events">,
    operationId: `event-${index}` as Id<"events">,
    createdAt: epoch + index,
    occurredAt: epoch + index * 60_000,
    type: "transaction",
    title: growingGroups ? `title-${index % 10}` : `title-${Math.floor(index / 10)}`,
    pipeId: `pipe-${index % 30}` as Id<"pipes">,
    value: -100,
  }));
  const deletedPipes: DeletedPipeEntry[] = Array.from({ length: archiveCount }, (_, index) => ({
    id: `deleted-${index}` as Id<"events">,
    operationId: `deleted-${index}` as Id<"events">,
    type: "pipe_deletion",
    pipeId: `pipe-${index}` as Id<"pipes">,
    ancestorIds: [],
    occurredAt: epoch,
    createdAt: epoch,
    name: `Archive ${index}`,
    icon: "pipe",
    pipeType: "pipe",
  }));
  return { entries, deletedPipes };
}

for (const growingGroups of [false, true]) {
  for (const archiveCount of [0, 15]) {
    for (const size of sizes) {
      const { entries, deletedPipes } = fixture(size, growingGroups, archiveCount);
      const run = () => groupMonthlyEventHistory(entries, deletedPipes);
      for (let index = 0; index < 10; index++) run();
      const durations: number[] = [];
      let topLevelRows = 0;
      for (let index = 0; index < 50; index++) {
        const startedAt = performance.now();
        topLevelRows = run().length;
        durations.push(performance.now() - startedAt);
      }
      durations.sort((a, b) => a - b);
      console.log(JSON.stringify({
        runtime: "Bun desktop, not Android Hermes",
        operation: "groupMonthlyEventHistory",
        entries: size,
        groupShape: growingGroups ? "10 growing titles" : "10 entries per title",
        archiveCount,
        topLevelRows,
        p50Ms: Number(durations[24].toFixed(3)),
        p95Ms: Number(durations[46].toFixed(3)),
      }));
    }
  }
}
