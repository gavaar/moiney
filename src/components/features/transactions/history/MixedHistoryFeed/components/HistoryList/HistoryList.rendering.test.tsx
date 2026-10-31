// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { HistoryList } from "./HistoryList";
import type { HistoryEntry } from "@features/transactions/history/events/event-groups";

vi.mock("react-native", async importOriginal => ({
  ...await importOriginal<typeof import("react-native")>(),
  FlatList: <Item,>({ data, keyExtractor, renderItem }: {
    data: Item[]; keyExtractor: (item: Item) => string; renderItem: (info: { item: Item }) => ReactNode;
  }) => <div>{data.map(item => <div key={keyExtractor(item)}>{renderItem({ item })}</div>)}</div>,
}));
const noop = () => undefined;
vi.mock("convex/react", () => ({ useConvex: () => ({ query: noop }), useMutation: () => noop }));
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

const pipeId = "source" as Id<"pipes">;
const catalog = {
  pipesById: { [pipeId]: { id: pipeId, name: "Source", icon: "wallet-outline", priority: 0, capacity: 1000, fed: 1000, spent: 0 } },
  childrenByParent: new Map(),
  isLoading: false,
  isPaidFromEligible: () => false,
};
function transaction(id: string, title: string, day: number): Extract<HistoryEntry, { type: "transaction" }> {
  return {
    id: id as Id<"events">,
    operationId: id as Id<"events">,
    type: "transaction",
    pipeId,
    title,
    value: -100,
    occurredAt: Date.UTC(2026, 5, day),
    createdAt: 0,
  };
}
const props = {
  filters: {},
  deletedPipes: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  hasMore: false,
  loadMore: noop,
  refresh: noop,
};

it("does not reformat a mounted transaction when an unrelated group toggles, but still applies refreshed data", () => {
  const outside = transaction("outside", "unrelated", 16);
  const entries = [outside, transaction("first", "group", 15), transaction("second", "group", 14)];
  const originalFormat = Date.prototype.toLocaleDateString;
  let outsideFormats = 0;
  const format = vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(function (this: Date, ...args) {
    if (this.getTime() === outside.occurredAt) outsideFormats++;
    return originalFormat.apply(this, args);
  });
  try {
    const { rerender } = render(<HistoryList {...props} entries={entries} />);
    const outsideButton = screen.getByRole("button", { name: /^Repeat unrelated/ });
    const initialFormats = outsideFormats;
    expect(initialFormats).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.getAllByRole("button", { name: /^Repeat group/ })).toHaveLength(2);
    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.queryByRole("button", { name: /^Repeat group/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Repeat unrelated/ })).toBe(outsideButton);
    expect(outsideFormats).toBe(initialFormats);

    rerender(<HistoryList {...props} entries={[{ ...outside, value: -500 }, ...entries.slice(1)]} />);
    expect(screen.getByRole("button", { name: /^Repeat unrelated, -5.00/ })).toBeTruthy();
    expect(outsideFormats).toBeGreaterThan(initialFormats);
  } finally {
    format.mockRestore();
  }
});
