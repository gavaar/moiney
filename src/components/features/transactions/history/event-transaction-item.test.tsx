// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import schema from "@convex/schema";
import { modules } from "@convex/test.setup";
import type { PipeModel } from "@features/pipes/data/pipes";
import { groupHistoryEvents } from "./event-groups";
import { EventTransactionItem } from "./event-transaction-item";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn(), pipes: [] as PipeModel[], success: vi.fn(), error: vi.fn(), reconcile: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client, useMutation: () => mocks.mutate }));
vi.mock("@ui/ConfirmModal", () => ({ useConfirmWithModal: () => async () => true }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock("@ui/Modal", () => ({ ModalShell: () => null }));
vi.mock("@features/transactions/TransactionForm/TransactionForm", () => ({ TransactionForm: () => null }));
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({ useOptionalTransactionCache: () => ({ reconcileTransactions: mocks.reconcile }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({
  pipesById: Object.fromEntries(mocks.pipes.map(pipe => [pipe.id, pipe])), childrenByParent: new Map(), isPaidFromEligible: () => true,
}) }));

it("renders a mirror-only operation without reads, then deletes the exact linked transaction and whole operation", async () => {
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
  const transaction = await auth.mutation(api.transactions.createTransaction, { from: ids.source, paidFrom: ids.payer, title: "hotel", value: -100, date: Date.now() });
  const entries = await auth.query(api.events.latest, { pipeId: ids.payer });
  expect(entries).toHaveLength(1);
  const row = groupHistoryEvents(entries)[0];
  if (row.kind !== "operation") throw new Error("Expected operation");
  mocks.query.mockImplementation((ref, args) => auth.query(ref, args));
  mocks.mutate.mockImplementation(args => auth.mutation(api.transactions.deleteTransaction, args));
  mocks.reconcile.mockResolvedValue(undefined);
  render(<EventTransactionItem operation={row.operation} deletedPipes={[]} onShowEditHistory={() => {}} />);
  expect(screen.getByText("Hotel")).toBeTruthy();
  expect(screen.getByText("-1.00")).toBeTruthy();
  expect(mocks.query).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Delete hotel"));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Transaction deleted"));
  expect(mocks.error).not.toHaveBeenCalled();
  expect(mocks.reconcile).toHaveBeenCalledWith([transaction.id], []);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
});
