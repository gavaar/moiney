import {
  recascadeTree,
  reconcileAffectedPipeRoots,
} from "../convex/lib/pipes/pipes";

const sizes = [20, 200, 500];

function percentile(values: number[], value: number): number {
  return values[Math.min(values.length - 1, Math.floor(values.length * value))];
}

function makePipes(size: number, changesAllocation: boolean) {
  return Array.from({ length: size }, (_, index) =>
    index === 0
      ? {
          _id: "pipe-0",
          userId: "user-1",
          priority: 0,
          capacity: 0,
          fed: changesAllocation ? (size - 1) * 100 : 0,
          spent: 0,
        }
      : {
          _id: `pipe-${index}`,
          userId: "user-1",
          parentId: "pipe-0",
          priority: index,
          capacity: 100,
          fed: changesAllocation ? 0 : 100,
          spent: 0,
        },
  );
}

for (const changesAllocation of [false, true]) {
  for (const size of sizes) {
    const durations: number[] = [];
    const measuredRuns = size === 500 ? 30 : 50;
    let patchCount = 0;

    for (let run = 0; run < measuredRuns + 5; run += 1) {
      const pipes = makePipes(size, changesAllocation);
      let patches = 0;
      const chain = { collect: async () => pipes };
      const ctx = {
        db: {
          query: () => ({ withIndex: () => chain }),
          patch: async () => {
            patches += 1;
          },
        },
      };

      const startedAt = performance.now();
      await recascadeTree(ctx as never, "user-1" as never);
      const elapsed = performance.now() - startedAt;
      if (run >= 5) durations.push(elapsed);
      patchCount = patches;
    }

    durations.sort((left, right) => left - right);
    console.log(
      JSON.stringify({
        scenario: changesAllocation
          ? "allocation-change"
          : "no-accounting-change",
        pipes: size,
        reads: size,
        patches: patchCount,
        p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
        p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
      }),
    );
  }
}

async function measureAffectedRoots(size: number, affectedRootCount: number) {
  const pipes = Array.from({ length: size }, (_, index) => ({
    _id: `pipe-${index}`,
    userId: "user-1",
    priority: index,
    capacity: 100,
    fed: 100,
    spent: 0,
  }));
  let pointReads = 0;
  let childQueries = 0;
  let childDocumentsRead = 0;
  let patches = 0;
  let parentId: string | undefined;
  const ctx = {
    db: {
      get: async (_table: string, pipeId: string) => {
        pointReads += 1;
        return pipes.find((pipe) => pipe._id === pipeId) ?? null;
      },
      query: () => ({
        withIndex: (_index: string, applyRange: (query: object) => unknown) => {
          const query = {
            eq: (_field: string, value: string) => {
              parentId = value;
              return query;
            },
          };
          applyRange(query);
          return {
            collect: async () => {
              childQueries += 1;
              const children = pipes.filter((pipe) => pipe.parentId === parentId);
              childDocumentsRead += children.length;
              return children;
            },
          };
        },
      }),
      patch: async () => {
        patches += 1;
      },
    },
  };

  await reconcileAffectedPipeRoots(
    ctx as never,
    Array.from(
      { length: affectedRootCount },
      (_, index) => `pipe-${index}` as never,
    ),
  );
  console.log(
    JSON.stringify({
      scenario:
        affectedRootCount === 1 ? "one-affected-root" : "two-affected-roots",
      totalUserPipes: size,
      pointReads,
      childQueries,
      childDocumentsRead,
      patches,
    }),
  );
}

for (const size of sizes) {
  await measureAffectedRoots(size, 1);
  await measureAffectedRoots(size, 2);
}
