// @vitest-environment jsdom
// CPU experiment only: bounded mock viewport, RN Web, development React, no native layout.
import { Profiler, type ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { PipeModel } from "../src/components/features/pipes/data/pipes";
import type { DeletedPipeEntry } from "../src/components/features/pipes/data/deletedPipes";
import type { HistoryEntry } from "../src/components/features/transactions/history/events/event-groups";
import { HistoryList } from "../src/components/features/transactions/history/MixedHistoryFeed/components/HistoryList/HistoryList";

const counters = vi.hoisted(() => ({
  recording: false,
  windowSize: 20,
  mode: "baseline",
  groupingMs: 0,
  groupingCalls: 0,
  groupModelMs: 0,
  groupModelCalls: 0,
  transactionModelMs: 0,
  transactionModelCalls: 0,
  groupPresentationCalls: 0,
  reactMs: 0,
}));

vi.mock("react-native", async importOriginal => ({
  ...await importOriginal<typeof import("react-native")>(),
  FlatList: <Item,>({ data, keyExtractor, renderItem }: {
    data: Item[];
    keyExtractor: (item: Item) => string;
    renderItem: (info: { item: Item }) => ReactNode;
  }) => <div>{data.slice(0, counters.windowSize).map(item => <div key={keyExtractor(item)}>{renderItem({ item })}</div>)}</div>,
}));
const noop = () => undefined;
const client = { query: vi.fn() };
vi.mock("convex/react", () => ({ useConvex: () => client, useMutation: () => noop }));
vi.mock("expo-router", () => ({ useRouter: () => ({ navigate: noop }) }));
vi.mock("@ui/ConfirmModal", () => ({ useConfirmWithModal: () => noop }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: noop, success: noop }) }));
vi.mock("@ui/Modal", () => ({ ModalShell: () => null }));
vi.mock("@features/transactions/TransactionForm/TransactionForm", () => ({ TransactionForm: () => null }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => catalog }));
vi.mock("@ui/Icon", async importOriginal => ({
  ...await importOriginal<typeof import("@ui/Icon")>(),
  Icon: () => <span />,
}));
vi.mock("@features/transactions/components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal", () => ({ TransactionCorrectionHistoryModal: () => null }));

vi.mock("@features/transactions/history/events/event-archives", async importOriginal => {
  const original = await importOriginal<typeof import("../src/components/features/transactions/history/events/event-archives")>();
  return {
    ...original,
    groupMonthlyEventHistory: (...args: Parameters<typeof original.groupMonthlyEventHistory>) => {
      const startedAt = performance.now();
      const result = original.groupMonthlyEventHistory(...args);
      if (counters.recording) {
        counters.groupingMs += performance.now() - startedAt;
        counters.groupingCalls++;
      }
      return result;
    },
  };
});
vi.mock("@features/transactions/history/MixedHistoryFeed/components/HistoryList/components/HistoryRow/components/EventTransactionItem/EventTransactionItem", async importOriginal => {
  const original = await importOriginal<typeof import("../src/components/features/transactions/history/MixedHistoryFeed/components/HistoryList/components/HistoryRow/components/EventTransactionItem/EventTransactionItem")>();
  return {
    ...original,
    EventTransactionItem: (props: Parameters<typeof original.EventTransactionItem>[0]) => counters.mode === "lightweight-transactions"
      ? <span>{props.operation.title}</span> : <original.EventTransactionItem {...props} />,
    eventTransactionPresentation: (...args: Parameters<typeof original.eventTransactionPresentation>) => {
      if (counters.recording) counters.groupPresentationCalls++;
      return original.eventTransactionPresentation(...args);
    },
  };
});
vi.mock("@features/transactions/components/StackedTransactionItem/stackedTransactionItem.model", async importOriginal => {
  const original = await importOriginal<typeof import("../src/components/features/transactions/components/StackedTransactionItem/stackedTransactionItem.model")>();
  return {
    ...original,
    getStackedTransactionItemModel: (...args: Parameters<typeof original.getStackedTransactionItemModel>) => {
      const startedAt = performance.now();
      const result = original.getStackedTransactionItemModel(...args);
      if (counters.recording) {
        counters.groupModelMs += performance.now() - startedAt;
        counters.groupModelCalls++;
      }
      return result;
    },
  };
});
vi.mock("@features/transactions/components/TransactionItem/transactionItem.model", async importOriginal => {
  const original = await importOriginal<typeof import("../src/components/features/transactions/components/TransactionItem/transactionItem.model")>();
  return {
    ...original,
    getTransactionItemPresentation: (...args: Parameters<typeof original.getTransactionItemPresentation>) => {
      const startedAt = performance.now();
      const result = original.getTransactionItemPresentation(...args);
      if (counters.recording) {
        counters.transactionModelMs += performance.now() - startedAt;
        counters.transactionModelCalls++;
      }
      return result;
    },
  };
});

const pipes: PipeModel[] = Array.from({ length: 30 }, (_, index) => ({
  id: `pipe-${index}` as Id<"pipes">,
  name: `Pipe ${index}`,
  icon: "pipe",
  priority: index,
  capacity: 100_000,
  fed: 100_000,
  spent: 0,
}));
const catalog = {
  allPipes: pipes,
  pipesById: Object.fromEntries(pipes.map(pipe => [pipe.id, pipe])),
  childrenByParent: new Map<Id<"pipes">, PipeModel[]>(),
  isLoading: false,
  feeds: pipes,
  isPaidFromEligible: () => false,
};

function entriesFor(size: number, growingGroups: boolean): HistoryEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `event-${index}` as Id<"events">,
    operationId: `event-${index}` as Id<"events">,
    createdAt: index,
    occurredAt: Date.UTC(2026, 9, 1) + index * 60_000,
    type: "transaction",
    title: growingGroups ? `title-${index % 10}` : `title-${Math.floor(index / 10)}`,
    pipeId: pipes[index % pipes.length].id,
    value: -100,
  }));
}

function resetCounters() {
  counters.groupingMs = 0;
  counters.groupingCalls = 0;
  counters.groupModelMs = 0;
  counters.groupModelCalls = 0;
  counters.transactionModelMs = 0;
  counters.transactionModelCalls = 0;
  counters.groupPresentationCalls = 0;
  counters.reactMs = 0;
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.floor(sorted.length / 2)].toFixed(3));
}
afterEach(cleanup);

const scenarios: { windowSize: number; growingGroups: boolean; size: number; archiveCount: number; mode: string }[] = [];
for (const windowSize of [20, 60]) {
  for (const growingGroups of [false, true]) {
    for (const size of [100, 1000, 3000, 10000]) {
      const experiment = windowSize === 60 && size >= 3000;
      for (const archiveCount of experiment && growingGroups ? [0, 100, 500] : [0]) {
        for (const mode of experiment ? ["baseline", "lightweight-transactions"] : ["baseline"]) {
          scenarios.push({ windowSize, growingGroups, size, archiveCount, mode });
        }
      }
    }
  }
}

it.each(scenarios)("CPU $mode: $size entries, growing=$growingGroups, $windowSize row cap, $archiveCount unrelated deleted pipes", ({ windowSize, growingGroups, size, archiveCount, mode }) => {
  counters.windowSize = windowSize;
  counters.mode = mode;
  counters.recording = false;
  // Unrelated snapshots vary lookup cost without changing visible membership or row count.
  const deletedPipes: DeletedPipeEntry[] = Array.from({ length: archiveCount }, (_, index) => ({
    id: `deleted-${index}` as Id<"events">,
    operationId: `deleted-${index}` as Id<"events">,
    pipeId: `unrelated-${index}` as Id<"pipes">,
    type: "pipe_deletion",
    ancestorIds: [],
    occurredAt: Date.UTC(2026, 9, 1),
    createdAt: index,
    name: "Unrelated deleted pipe",
    icon: "pipe",
    pipeType: "pipe",
  }));
  const mounted = render(<Profiler id="history" onRender={(_id, _phase, actualDuration) => {
    if (counters.recording) counters.reactMs += actualDuration;
  }}><HistoryList entries={entriesFor(size, growingGroups)} deletedPipes={deletedPipes} filters={{}}
    isLoading={false} isRefreshing={false} error={null} hasMore={false} loadMore={noop} refresh={noop} /></Profiler>);
  const button = mounted.getAllByTestId("transaction-group-main")[0];
  const samples: { action: string; elapsedMs: number; groupingMs: number; groupingCalls: number; groupModelMs: number; groupModelCalls: number; transactionModelMs: number; transactionModelCalls: number; groupPresentationCalls: number; reactMs: number }[] = [];
  for (let index = 0; index < 24; index++) {
    resetCounters();
    counters.recording = index >= 6;
    const startedAt = performance.now();
    fireEvent.click(button);
    const elapsedMs = performance.now() - startedAt;
    const action = index % 2 === 0 ? "expand" : "collapse";
    expect(button.getAttribute("aria-expanded")).toBe(action === "expand" ? "true" : "false");
    if (counters.recording) samples.push({ ...counters, action, elapsedMs });
  }
  counters.recording = false;
  expect(client.query).not.toHaveBeenCalled();
  expect(samples.every(sample => sample.groupPresentationCalls === 0)).toBe(true);
  expect(samples.every(sample => sample.groupingCalls === 0)).toBe(true);
  for (const action of ["expand", "collapse"]) {
    const selected = samples.filter(sample => sample.action === action);
    const fields = ["elapsedMs", "reactMs", "groupingMs", "groupingCalls", "groupModelMs", "groupModelCalls", "transactionModelMs", "transactionModelCalls", "groupPresentationCalls"] as const;
    console.log(JSON.stringify({
      runtime: "Node/jsdom/RN Web/development React; bounded mock viewport, not native FlatList",
      entries: size,
      mode,
      unrelatedDeletedPipes: archiveCount,
      groupShape: growingGroups ? "10 growing titles" : "10 entries per title",
      rowCap: windowSize,
      action,
      samples: selected.length,
      median: Object.fromEntries(fields.map(field => [field, median(selected.map(sample => sample[field]))])),
    }));
  }
});
