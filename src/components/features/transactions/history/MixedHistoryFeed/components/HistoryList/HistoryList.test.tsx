// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { HistoryList } from "./HistoryList";
import type { HistoryEntry } from "@features/transactions/history/events/event-groups";
import type { DeletedPipeEntry } from "@features/pipes/data/deletedPipes";
import type { PipeModel } from "@features/pipes/data/pipes";
import { colors } from "@/lib/styles";

const mocks = vi.hoisted(() => ({ query: vi.fn(), navigate: vi.fn(), catalog: vi.fn<() => { pipesById: Record<string, PipeModel> }>(), childrenByParent: new Map<Id<"pipes">, PipeModel[]>() }));
const client = { query: mocks.query };
vi.mock("react-native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native")>()),
  FlatList: <Item,>({ data, keyExtractor, renderItem, onEndReached, onRefresh, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: {
    data: Item[];
    keyExtractor: (item: Item) => string;
    renderItem: (info: { item: Item }) => ReactNode;
    onEndReached: () => void;
    onRefresh: () => void;
    ListHeaderComponent: ReactNode;
    ListEmptyComponent: ReactNode;
    ListFooterComponent: ReactNode;
  }) => <div>
    <button aria-label="Reach history end" onClick={onEndReached} />
    <button aria-label="Refresh history" onClick={onRefresh} />
    {ListHeaderComponent}
    {data.length === 0 ? ListEmptyComponent : data.map(item => <div key={keyExtractor(item)}>{renderItem({ item })}</div>)}
    {ListFooterComponent}
  </div>,
}));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("expo-router", () => ({ useRouter: () => ({ navigate: mocks.navigate }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ ...mocks.catalog(), childrenByParent: mocks.childrenByParent }) }));
vi.mock("@ui/Icon", () => ({ Icon: ({ name, color }: { name: string; color: string }) => <span data-testid={name} data-color={color} style={{ color }} />, safeIconName: (name: string) => name }));
vi.mock("@features/transactions/components/TransactionItem", () => ({ TransactionItem: ({ transaction }: { transaction: { title: string } }) => <span>{transaction.title}</span> }));
vi.mock("@features/transactions/components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal", () => ({ TransactionCorrectionHistoryModal: () => null }));
const pipe = (id: string) => id as Id<"pipes">;
const id = (id: string) => id as Id<"events">;
const june = Date.UTC(2026, 5, 15);
const trip: DeletedPipeEntry = { id: id("deleted-trip"), operationId: id("deleted-trip"), pipeId: pipe("trip"), type: "pipe_deletion", ancestorIds: [], occurredAt: june, createdAt: june, name: "Madrid", icon: "airplane", pipeType: "pipe" };
const payer: DeletedPipeEntry = { ...trip, id: id("deleted-payer"), operationId: id("deleted-payer"), pipeId: pipe("payer"), name: "Main" };
const expense: Extract<HistoryEntry, { type: "third_party_transaction" }> = { id: id("shared"), operationId: id("shared"), type: "third_party_transaction", title: "hotel", occurredAt: june, createdAt: june, value: -6000, pipeId: trip.pipeId, targetPipeId: payer.pipeId };
const mirror: HistoryEntry = { ...expense, id: id("payment"), type: "transaction", pipeId: payer.pipeId, targetPipeId: trip.pipeId, value: 6000 };
const settlement: Extract<HistoryEntry, { type: "settlement" }> = {
  id: id("settlement"),
  operationId: id("settlement"),
  pipeId: trip.pipeId,
  type: "settlement",
  occurredAt: june,
  createdAt: june,
  name: "Madrid",
  icon: "airplane",
  cause: "manual",
  before: { capacity: 4000, fed: 4000, spent: 3000, pendingFedAdjustment: 500 },
  after: { capacity: 5000, fed: 1500, spent: 0, pendingFedAdjustment: 0 },
};
const props = { filters: {}, isLoading: false, isRefreshing: false, error: null, hasMore: false, loadMore: vi.fn(), refresh: vi.fn(), deletedPipes: [] as DeletedPipeEntry[] };

describe("loaded event History interaction", () => {
  beforeEach(() => {
    mocks.query.mockReset(); mocks.navigate.mockReset();
    mocks.catalog.mockReturnValue({ pipesById: {} });
    mocks.childrenByParent.clear();
    props.loadMore.mockReset(); props.refresh.mockReset();
  });

  it("opens read-only settlement details in the selected pipe without financial reads or navigation", async () => {
    render(<HistoryList {...props} entries={[settlement]} filters={{ pipeIds: [trip.pipeId] }} />);
    expect(screen.getByTestId("gesture-tap-hold")).toBeTruthy();
    expect(screen.queryByText("Cycle completed")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "View Madrid settlement" }));
    expect(screen.getByText("Manually settled")).toBeTruthy();
    expect(screen.queryByText(/Configured rule/)).toBeNull();
    expect(screen.getByLabelText("Capacity before settlement: 40.00")).toBeTruthy();
    expect(screen.getByLabelText("Spent before settlement: 30.00")).toBeTruthy();
    expect(screen.getByLabelText("Paid from elsewhere: 5.00")).toBeTruthy();
    expect(screen.getByLabelText("Leftover funding: 15.00")).toBeTruthy();
    expect(screen.getByLabelText("New capacity: 50.00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Repeat|Edit|Delete|Close/i })).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByText("Manually settled")).toBeNull();
  });

  it.each([
    { cause: "manual", icon: "gesture-tap-hold", label: "Manually settled" },
    { cause: "spend_overflow", icon: "overflow-pipe", label: "Settled on spending limit" },
    { cause: "cron", icon: "timer-outline", label: "Scheduled settlement" },
    { cause: "self_destruct", icon: "bomb-pipe", label: "Settled before self-destruct" },
  ] satisfies { cause: typeof settlement.cause; icon: string; label: string }[])(
    "shows the execution icon and details for the actual $cause cause", async ({ cause, icon, label }) => {
      render(<HistoryList {...props} entries={[{ ...settlement, cause }]} />);
      expect(screen.getByTestId(icon)).toBeTruthy();
      expect(screen.getByTestId("airplane")).toBeTruthy();
      expect(screen.queryByText(label)).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "View Madrid settlement" }));
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getAllByTestId(icon)).toHaveLength(2);
    },
  );

  it("exposes settlement-only deleted archives without counting settlement as expenditure", async () => {
    render(<HistoryList {...props} entries={[settlement]} deletedPipes={[trip]} />);
    expect(screen.getByText("Spent: 0.00")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(screen.getByTestId("gesture-tap-hold")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "View Madrid settlement" }));
    expect(screen.getByText("Manually settled")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("shows an empty state only after loading finishes", () => {
    const { rerender } = render(<HistoryList {...props} entries={[]} isLoading />);
    expect(screen.getByRole("progressbar", { name: "Loading history" })).toBeTruthy();
    expect(screen.queryByText("No history yet")).toBeNull();
    rerender(<HistoryList {...props} entries={[]} />);
    expect(screen.getByText("No history yet")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("keeps expansion usable in development without the temporary timing overlay", () => {
    vi.stubGlobal("__DEV__", true);
    try {
      const other = { ...expense, id: id("other"), operationId: id("other") };
      render(<HistoryList {...props} entries={[expense, other]} />);
      expect(screen.queryByLabelText("History expansion timings")).toBeNull();
      fireEvent.click(screen.getByTestId("transaction-group-main"));
      expect(screen.getAllByText("hotel")).toHaveLength(2);
      fireEvent.click(screen.getByTestId("transaction-group-main"));
      expect(screen.queryByText("hotel")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows an accessible failure instead of an empty state", () => {
    render(<HistoryList {...props} entries={[]} error="Unable to load history." />);
    expect(screen.getByRole("alert").textContent).toBe("Unable to load history.");
    expect(screen.queryByText("No history yet")).toBeNull();
  });

  it("keeps loaded history visible during loading and failures", () => {
    const { rerender } = render(<HistoryList {...props} entries={[expense]} isLoading />);
    expect(screen.getByText("hotel")).toBeTruthy();
    rerender(<HistoryList {...props} entries={[expense]} error="Unable to load history." />);
    expect(screen.getByText("hotel")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it.each([
    { hasMore: true, isLoading: false, error: null, expected: 1 },
    { hasMore: false, isLoading: false, error: null, expected: 0 },
    { hasMore: true, isLoading: true, error: null, expected: 0 },
    { hasMore: true, isLoading: false, error: "Unable to load history.", expected: 0 },
  ])("loads more only when available and not loading or failed ($expected calls)", ({ expected, ...state }) => {
    render(<HistoryList {...props} {...state} entries={[expense]} />);
    fireEvent.click(screen.getByRole("button", { name: "Reach history end" }));
    expect(props.loadMore).toHaveBeenCalledTimes(expected);
  });

  it("allows explicit refresh after a failure", () => {
    render(<HistoryList {...props} entries={[]} error="Unable to load history." />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    expect(props.refresh).toHaveBeenCalledOnce();
  });

  it.each(["transaction-group-main", "transaction-group-disclosure"])("expands and collapses loaded title members through %s without reads", control => {
    const other = { ...expense, id: id("other"), operationId: id("other"), value: -2000 };
    render(<HistoryList {...props} entries={[expense, other]} />);
    expect(screen.getByText("Hotel")).toBeTruthy();
    expect(screen.getByText("-80.00")).toBeTruthy();
    fireEvent.click(screen.getByTestId(control));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
    fireEvent.click(screen.getByTestId(control));
    expect(screen.queryByText("hotel")).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("expands and collapses without rereading unchanged deletion metadata", () => {
    let iconReads = 0;
    const unrelated: DeletedPipeEntry = {
      ...payer,
      pipeId: pipe("unrelated"),
      get icon() { iconReads++; return "wallet-outline"; },
    };
    const other = { ...expense, id: id("other"), operationId: id("other") };
    render(<HistoryList {...props} entries={[expense, other]} deletedPipes={[unrelated]} />);
    const initialReads = iconReads;
    expect(initialReads).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.queryByText("hotel")).toBeNull();
    expect(iconReads).toBe(initialReads);
  });

  it("reuses unchanged history during expansion and includes newly loaded members", () => {
    let dateReads = 0;
    const unrelated: HistoryEntry = {
      ...expense,
      id: id("unrelated"),
      operationId: id("unrelated"),
      title: "other",
      get occurredAt() { dateReads++; return june - 1; },
    };
    const other = { ...expense, id: id("other"), operationId: id("other") };
    const entries = [expense, other, unrelated];
    const { rerender } = render(<HistoryList {...props} entries={entries} />);
    const initialReads = dateReads;
    expect(initialReads).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.getAllByText("hotel")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.queryByText("hotel")).toBeNull();
    expect(dateReads).toBe(initialReads);

    fireEvent.click(screen.getByTestId("transaction-group-main"));
    rerender(<HistoryList {...props} entries={[...entries, { ...expense, id: id("third"), operationId: id("third") }]} />);
    expect(screen.getAllByText("hotel")).toHaveLength(3);
    expect(screen.getByText("-180.00")).toBeTruthy();
    expect(dateReads).toBeGreaterThan(initialReads);
  });

  it.each(["from", "to", "paidFrom"] as const)("keeps the archived $role group icon current without member presentations", role => {
    const member: HistoryEntry = role === "to"
      ? { id: id("member"), operationId: id("member"), type: "feed", pipeId: trip.pipeId, title: "hotel", value: 100, occurredAt: june, createdAt: june }
      : { id: id("member"), operationId: id("member"), type: "transaction", pipeId: trip.pipeId, title: "hotel", value: role === "paidFrom" ? 100 : -100, occurredAt: june, createdAt: june, ...(role === "paidFrom" ? { targetPipeId: payer.pipeId } : {}) };
    const entries = [member, { ...member, id: id("older"), operationId: id("older"), occurredAt: june - 1 }];
    const filters = { pipeIds: [trip.pipeId] };
    const { rerender } = render(<HistoryList {...props} entries={entries} deletedPipes={[trip]} filters={filters} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(within(screen.getByTestId("transaction-group-main")).getByTestId("airplane")).toBeTruthy();
    fireEvent.click(screen.getByTestId("transaction-group-main"));
    expect(screen.getAllByText("hotel")).toHaveLength(2);

    rerender(<HistoryList {...props} entries={entries} deletedPipes={[{ ...trip, icon: "cash-outline" }]} filters={filters} />);
    expect(within(screen.getByTestId("transaction-group-main")).getByTestId("cash-outline")).toBeTruthy();
    expect(screen.getAllByText("hotel")).toHaveLength(2);
  });

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

  it("keeps live creation entries informational without routing or fetching financial history", async () => {
    render(<HistoryList {...props} entries={[{ ...trip, type: "pipe_creation" }]} />);
    await userEvent.click(screen.getByText("Madrid"));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
    expect(screen.getByLabelText("Madrid, pipe created, Jun 15, 2026")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Event type: Created pipe" }));
    expect(screen.getByText("Created pipe")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "feed", sourceType: "feed", rule: "instant_settlement", color: colors.primaryMuted },
    { kind: "boiler", sourceType: "boiler", rule: "instant_settlement", color: colors.secondarySoft },
    { kind: "legacy feed", color: colors.primaryMuted },
    { kind: "manual", parentId: pipe("parent"), color: colors.text },
    { kind: "instant", parentId: pipe("parent"), rule: "instant_settlement", color: colors.accent },
    { kind: "overflow", parentId: pipe("parent"), rule: "spend_overflow", color: colors.primary },
    { kind: "timed", parentId: pipe("parent"), rule: "cron", color: colors.secondary },
    { kind: "self-destruct", parentId: pipe("parent"), rule: "self_destruct", color: colors.error },
  ] satisfies (Pick<PipeModel, "parentId" | "sourceType" | "rule"> & { kind: string; color: string })[])(
    "colors the live $kind creation border and pipe icon by its current type", ({ color, kind: _kind, ...type }) => {
      const current: PipeModel = { id: trip.pipeId, name: "Madrid", icon: "airplane", priority: 0, capacity: 0, fed: 0, spent: 0, ...type };
      mocks.catalog.mockReturnValue({ pipesById: { [current.id]: current } });
      render(<HistoryList {...props} entries={[{ ...trip, type: "pipe_creation" }]} />);
      const icon = screen.getByTestId("airplane");
      expect(icon.getAttribute("data-color")).toBe(color);
      expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(color);
      expect(getComputedStyle(screen.getByLabelText(/Madrid, pipe created/)).borderTopColor).toBe(icon.style.color);
    },
  );

  it("updates creation colors when the live pipe rule changes", () => {
    const current: PipeModel = { id: trip.pipeId, parentId: pipe("parent"), name: "Madrid", icon: "airplane", priority: 0, capacity: 0, fed: 0, spent: 0, rule: "cron" };
    const entries: HistoryEntry[] = [{ ...trip, type: "pipe_creation" }];
    mocks.catalog.mockReturnValue({ pipesById: { [current.id]: current } });
    const { rerender } = render(<HistoryList {...props} entries={entries} />);
    expect(screen.getByTestId("airplane").getAttribute("data-color")).toBe(colors.secondary);
    expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(colors.secondary);
    mocks.catalog.mockReturnValue({ pipesById: { [current.id]: { ...current, rule: "self_destruct" } } });
    rerender(<HistoryList {...props} entries={entries} />);
    const icon = screen.getByTestId("airplane");
    expect(icon.getAttribute("data-color")).toBe(colors.error);
    expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(colors.error);
    expect(getComputedStyle(screen.getByLabelText(/Madrid, pipe created/)).borderTopColor).toBe(icon.style.color);
  });

  it.each([
    { kind: "intermediate", parentId: pipe("parent"), color: colors.muted },
    { kind: "feed with children", sourceType: "feed", color: colors.primaryMuted },
    { kind: "boiler with children", sourceType: "boiler", color: colors.secondarySoft },
  ] satisfies (Pick<PipeModel, "parentId" | "sourceType"> & { kind: string; color: string })[])(
    "uses $kind creation colors without routing", async ({ color, kind: _kind, ...type }) => {
      const current: PipeModel = { id: trip.pipeId, name: "Madrid", icon: "airplane", priority: 0, capacity: 0, fed: 0, spent: 0, ...type };
      const child: PipeModel = { ...current, id: pipe("child"), parentId: current.id, name: "Child", icon: "pipe" };
      mocks.catalog.mockReturnValue({ pipesById: { [current.id]: current, [child.id]: child } });
      mocks.childrenByParent.set(current.id, [child]);
      const entries: HistoryEntry[] = [{ ...trip, type: "pipe_creation" }];
      const { rerender } = render(<HistoryList {...props} entries={entries} />);
      const icon = screen.getByTestId("airplane");
      expect(icon.getAttribute("data-color")).toBe(color);
      expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(color);
      expect(getComputedStyle(screen.getByLabelText(/Madrid, pipe created/)).borderTopColor).toBe(icon.style.color);
      expect(screen.queryByText("Deleted")).toBeNull();
      await userEvent.click(screen.getByText("Madrid"));
      expect(mocks.navigate).not.toHaveBeenCalled();
      mocks.childrenByParent.delete(current.id);
      mocks.catalog.mockReturnValue({ pipesById: { [current.id]: current } });
      rerender(<HistoryList {...props} entries={entries} />);
      expect(screen.getByTestId("airplane").getAttribute("data-color")).toBe(current.parentId ? colors.text : color);
    },
  );

  it("never navigates from a retained creation entry inside a deleted archive", async () => {
    render(<HistoryList {...props} entries={[expense, trip, settlement, { ...trip, id: id("created-trip"), operationId: id("created-trip"), type: "pipe_creation" }]} />);
    const header = screen.getByRole("button", { name: "Madrid archived history", expanded: false });
    const archive = header.parentElement!;
    expect(screen.getAllByTestId("history-event-marker")).toHaveLength(1);
    expect(within(archive).getByTestId("pipe-deletion").getAttribute("data-color")).toBe(colors.error);
    expect(screen.queryByTestId("pipe-creation")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(screen.getByRole("button", { name: "Madrid archived history", expanded: true })).toBe(header);
    expect(within(archive).getByTestId("pipe-deletion").getAttribute("data-color")).toBe(colors.error);
    expect(screen.getByLabelText("Madrid, pipe created, Jun 15, 2026, pipe now deleted")).toBeTruthy();
    expect(screen.getByLabelText("Madrid, pipe deleted, Jun 15, 2026")).toBeTruthy();
    expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(colors.text);
    expect(screen.getByRole("button", { name: "View Madrid settlement" })).toBeTruthy();
    expect(screen.getByTestId("settlement").getAttribute("data-color")).toBe(colors.secondary);
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
    for (const icon of screen.getAllByTestId("airplane")) expect(icon.getAttribute("data-color")).toBe(colors.muted);
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
