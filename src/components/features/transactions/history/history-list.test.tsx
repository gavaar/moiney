// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { HistoryList } from "./history-list";
import type { HistoryEntry } from "./event-groups";
import type { DeletedPipeEntry } from "./event-archives";

const mocks = vi.hoisted(() => ({ query: vi.fn(), navigate: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("expo-router", () => ({ useRouter: () => ({ navigate: mocks.navigate }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ pipesById: {} }) }));
vi.mock("@ui/Icon", () => ({ Icon: () => null, safeIconName: (name: string) => name }));
vi.mock("../components/TransactionItem", () => ({ TransactionItem: ({ transaction }: { transaction: { title: string } }) => <span>{transaction.title}</span> }));
vi.mock("../components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal", () => ({ TransactionCorrectionHistoryModal: () => null }));
const pipe = (id: string) => id as Id<"pipes">;
const id = (id: string) => id as Id<"events">;
const june = Date.UTC(2026, 5, 15);
const trip: DeletedPipeEntry = { id: id("deleted-trip"), operationId: id("deleted-trip"), pipeId: pipe("trip"), type: "pipe_deletion", ancestorIds: [], occurredAt: june, createdAt: june, name: "Madrid", icon: "airplane", pipeType: "pipe" };
const payer: DeletedPipeEntry = { ...trip, id: id("deleted-payer"), operationId: id("deleted-payer"), pipeId: pipe("payer"), name: "Main" };
const expense: Extract<HistoryEntry, { type: "third_party_transaction" }> = { id: id("shared"), operationId: id("shared"), type: "third_party_transaction", title: "hotel", occurredAt: june, createdAt: june, value: -6000, pipeId: trip.pipeId, targetPipeId: payer.pipeId };
const mirror: HistoryEntry = { ...expense, id: id("payment"), type: "transaction", pipeId: payer.pipeId, targetPipeId: trip.pipeId, value: 6000 };
const props = { filters: {}, isLoading: false, isRefreshing: false, error: null, hasMore: false, loadMore: vi.fn(), refresh: vi.fn(), deletedPipes: [] as DeletedPipeEntry[] };

describe("loaded event History interaction", () => {
  beforeEach(() => { mocks.query.mockReset(); mocks.navigate.mockReset(); });

  it("expands loaded shared operations under both deleted perspectives without a query", async () => {
    render(<HistoryList {...props} entries={[expense, mirror]} deletedPipes={[trip, payer]} />);
    expect(screen.getAllByText("Spent: 60.00")).toHaveLength(2);
    expect(screen.getAllByText("x1")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(screen.getAllByText("hotel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Expand Main history" }));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("expands title groups locally and grows summaries only when main entries grow", async () => {
    const other = { ...expense, id: id("other"), operationId: id("other") };
    const { rerender } = render(<HistoryList {...props} entries={[expense, other]} deletedPipes={[trip]} />);
    expect(screen.getByText("Spent: 120.00")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand 2 transactions" }));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
    rerender(<HistoryList {...props} entries={[expense, other, { ...expense, id: id("third"), operationId: id("third") }]} deletedPipes={[trip]} />);
    expect(screen.getByText("Spent: 180.00")).toBeTruthy();
    expect(screen.getAllByText("hotel")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Load more Madrid/ })).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("keeps a lifecycle-only archive muted and nonexpandable without a summary request", () => {
    render(<HistoryList {...props} entries={[trip]} deletedPipes={[trip]} />);
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getByText("Jun 15, 2026")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Expand Madrid history" })).toBeNull();
    expect(screen.queryByText(/Spent/)).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("opens live creation entries without fetching financial history", async () => {
    render(<HistoryList {...props} entries={[{ ...trip, type: "pipe_creation" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Open Madrid" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ pathname: "/(main)/(tabs)/pipes", params: { pipeId: trip.pipeId } });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("never navigates from a retained creation entry inside a deleted archive", async () => {
    render(<HistoryList {...props} entries={[expense, trip, { ...trip, id: id("created-trip"), operationId: id("created-trip"), type: "pipe_creation" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows separate UTC pipe/month archives instead of a lifetime archive", () => {
    const july = Date.UTC(2026, 6, 1);
    render(<HistoryList {...props} entries={[expense, { ...expense, id: id("july"), operationId: id("july"), occurredAt: july }]} deletedPipes={[trip]} />);
    expect(screen.getByText("July 2026")).toBeTruthy();
    expect(screen.getByText("June 2026")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Expand Madrid history" })).toHaveLength(2);
    expect(screen.getAllByText("Spent: 60.00")).toHaveLength(2);
  });

  it("keeps shared operations visible in a surviving ordinary scope alongside an archive", async () => {
    render(<HistoryList {...props} entries={[expense, mirror]} deletedPipes={[payer]} />);
    expect(screen.getAllByText("hotel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Expand Main history" }));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
  });
});
