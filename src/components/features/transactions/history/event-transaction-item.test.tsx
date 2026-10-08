// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import schema from "@convex/schema";
import { modules } from "@convex/test.setup";
import type { PipeModel } from "@features/pipes/data/pipes";
import { groupHistoryEvents } from "./event-groups";
import { EventTransactionItem } from "./event-transaction-item";
import { EventHistoryCacheProvider } from "../cache/EventHistoryCacheContext";
import { EventHistoryStore } from "../cache/EventHistoryStore";
import { useEventHistory } from "../cache/useEventHistory";
import type { Id } from "@convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn(), pipes: [] as PipeModel[], success: vi.fn(), error: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client, useMutation: (reference: FunctionReference<"mutation">) =>
  (args: unknown) => mocks.mutate(reference, args) }));
vi.mock("@ui/ConfirmModal", () => ({ useConfirmWithModal: () => async () => true }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock("@ui/Modal", () => ({ ModalShell: () => null }));
vi.mock("@features/transactions/TransactionForm/TransactionForm", () => ({ TransactionForm: () => null }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: "alice" }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({
  pipesById: Object.fromEntries(mocks.pipes.map(pipe => [pipe.id, pipe])), childrenByParent: new Map(), isPaidFromEligible: () => true,
}) }));

function HistoryCount() {
  return <span data-testid="history-count">{useEventHistory().entries.length}</span>;
}

it("opens Edited history by operation ID without resolving a legacy action", () => {
  mocks.query.mockClear();
  mocks.query.mockResolvedValue(null);
  const history = vi.fn();
  const operationId = "operation" as Id<"events">;
  const row = groupHistoryEvents([{ id: operationId, operationId, type: "transaction", pipeId: "source" as Id<"pipes">,
    title: "lunch", value: -100, occurredAt: 1, createdAt: 1, editedAt: 2 }])[0];
  if (row.kind !== "operation") throw new Error("Expected operation");
  render(<EventTransactionItem operation={row.operation} deletedPipes={[]} onShowEditHistory={history} />);
  fireEvent.click(screen.getByLabelText("View edit history for lunch"));
  expect(history).toHaveBeenCalledWith(operationId);
  expect(mocks.query).not.toHaveBeenCalled();
});

it("deletes an event-only operation and refreshes event history without transaction snapshots", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const fields = { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
    const source = await ctx.db.insert("pipes", fields);
    const payer = await ctx.db.insert("pipes", fields);
    mocks.pipes = [{ ...fields, id: source }, { ...fields, id: payer }];
    return { userId, source, payer };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  await auth.mutation(api.transactions.createTransaction, { from: ids.source, paidFrom: ids.payer, title: "hotel", value: -100, date: Date.now() });
  await t.run(async ctx => { for (const transaction of await ctx.db.query("transactions").collect()) await ctx.db.delete("transactions", transaction._id); });
  const entries = await auth.query(api.events.latest, { pipeId: ids.payer });
  expect(entries).toHaveLength(1);
  const row = groupHistoryEvents(entries)[0];
  if (row.kind !== "operation") throw new Error("Expected operation");
  mocks.query.mockImplementation((ref, args) => auth.query(ref, args));
  mocks.mutate.mockImplementation((reference, args) => auth.mutation(reference, args));
  const values = new Map<string, string>();
  const storage = {
    read: async (key: string) => values.get(key) ?? null,
    write: async (key: string, value: string) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
  };
  const seed = new EventHistoryStore("alice", storage);
  await seed.hydrate();
  await seed.mergeHead(entries, false, 1);
  render(<EventHistoryCacheProvider storage={storage}>
    <HistoryCount />
    <EventTransactionItem operation={row.operation} deletedPipes={[]} onShowEditHistory={() => {}} />
  </EventHistoryCacheProvider>);
  await waitFor(() => expect(screen.getByTestId("history-count").textContent).toBe("1"));
  expect(screen.getByText("Hotel")).toBeTruthy();
  expect(screen.getByText("-1.00")).toBeTruthy();
  expect(mocks.query).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Delete hotel"));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Transaction deleted"));
  expect(mocks.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByTestId("history-count").textContent).toBe("0"));
  expect(values.has("alice")).toBe(false);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
});
