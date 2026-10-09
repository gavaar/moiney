// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import schema from "@convex/schema";
import { modules } from "@convex/test.setup";
import { insertFinancialOperation } from "@convex/lib/events/financial";
import type { PipeModel } from "@features/pipes/data/pipes";
import { groupHistoryEvents } from "./event-groups";
import { EventTransactionItem } from "./event-transaction-item";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn(), pipes: [] as PipeModel[], invalidate: vi.fn(), error: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({
  useConvex: () => client,
  useQuery: () => [],
  useMutation: (reference: FunctionReference<"mutation">) => (args: unknown) => mocks.mutate(reference, args),
}));
vi.mock("@ui/ConfirmModal", () => ({ useConfirmWithModal: () => vi.fn() }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: vi.fn(), error: mocks.error }) }));
vi.mock("@ui/Modal", () => ({ ModalShell: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <div>{children}</div> : null }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => ({ invalidateHistory: mocks.invalidate }) }));
vi.mock("@features/transactions/cache/useEventHistory", () => ({ useEventHistory: () => ({ entries: [], isLoading: false }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({
  allPipes: mocks.pipes, pipesById: Object.fromEntries(mocks.pipes.map(pipe => [pipe.id, pipe])),
  childrenByParent: new Map(), isLoading: false, isPaidFromEligible: () => true,
}) }));

it.each(["edit", "repeat"] as const)("submits %s from a payer-only perspective through the real form without a legacy action row", async intent => {
  vi.clearAllMocks();
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
    const source = await ctx.db.insert("pipes", { ...fields, name: "Budget", spent: 100, pendingFedAdjustment: 100 });
    const payer = await ctx.db.insert("pipes", { ...fields, name: "Wallet", fed: 900 });
    mocks.pipes = [{ ...fields, id: source, name: "Budget", spent: 100 }, { ...fields, id: payer, name: "Wallet", fed: 900 }];
    const operationId = await insertFinancialOperation(ctx, { userId, title: "lunch", value: -100, occurredAt: 1,
      structure: { type: "payByTransfer", from: source, paidFrom: payer } });
    return { userId, source, payer, operationId };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  mocks.query.mockImplementation((reference, args) => auth.query(reference, args));
  mocks.mutate.mockImplementation((reference, args) => auth.mutation(reference, args));
  const row = groupHistoryEvents(await auth.query(api.events.latest, { pipeId: ids.payer }))[0];
  if (row.kind !== "operation") throw new Error("Expected financial operation");
  render(<EventTransactionItem operation={row.operation} deletedPipes={[]} onShowEditHistory={() => {}} />);
  expect(mocks.query).not.toHaveBeenCalled();
  if (intent === "edit") fireEvent.click(screen.getByLabelText("Edit lunch"));
  else fireEvent.click(screen.getByText("Lunch"));
  await waitFor(() => expect(screen.getByPlaceholderText("What was this for?")).toBeTruthy());
  expect(screen.getByDisplayValue("1.00")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Change Value sign, currently negative" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Paid from" }).textContent).toContain("Wallet");
  fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Dinner" } });
  fireEvent.click(screen.getByRole("button", { name: intent === "edit" ? "Update transaction" : "Add expense" }));
  await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledOnce());
  expect(mocks.error).not.toHaveBeenCalled();
  const events = await auth.query(api.events.latest, {});
  if (intent === "edit") {
    expect(events).toHaveLength(2);
    expect(events.find(event => event.id === ids.operationId)).toMatchObject({ title: "dinner", value: -100 });
    const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
    expect(corrections).toEqual([expect.objectContaining({ operationId: ids.operationId, previous: { title: "lunch", value: -100, date: 1,
      kind: "expense", from: ids.source, paidFrom: ids.payer }, current: expect.objectContaining({ title: "dinner", value: -100 }) })]);
    expect(await t.run(ctx => ctx.db.get("pipes", ids.source))).toMatchObject({ spent: 100, pendingFedAdjustment: 100 });
    expect(await t.run(ctx => ctx.db.get("pipes", ids.payer))).toMatchObject({ fed: 900 });
  } else {
    expect(events).toHaveLength(4);
    expect(events.filter(event => "title" in event && event.title === "dinner")).toHaveLength(2);
    expect(await t.run(ctx => ctx.db.get("pipes", ids.source))).toMatchObject({ spent: 200, pendingFedAdjustment: 200 });
    expect(await t.run(ctx => ctx.db.get("pipes", ids.payer))).toMatchObject({ fed: 800 });
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  }
});
