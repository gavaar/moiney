// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { TransactionCacheProvider } from "@features/transactions/cache/TransactionCacheContext";
import { EventHistoryStore } from "@features/transactions/cache/EventHistoryStore";
import { useEventHistory } from "@features/transactions/cache/useEventHistory";
import { useAmountFormController } from "./useAmountFormController";
import type { AmountFormProps } from "./types";

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), edit: vi.fn(), boiler: vi.fn(), error: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({
  useConvex: () => client,
  useMutation: (reference: FunctionReference<"mutation">) => {
    const name = getFunctionName(reference);
    return name === "transactions:createTransaction" ? mocks.create : name === "transactions:editTransaction" ? mocks.edit : mocks.boiler;
  },
  useQuery: () => [],
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: "alice" }) }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: mocks.error }) }));
const source: PipeModel = { id: "source" as Id<"pipes">, name: "Wallet", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
const pipes = { allPipes: [source], pipesById: { [source.id]: source } };
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => pipes }));
const entry = (id: string) => ({ id: id as Id<"events">, operationId: id as Id<"events">, pipeId: source.id, createdAt: 1, occurredAt: 1, type: "transaction" as const, title: "lunch", value: -100 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: "legacy-tx", title: "lunch", value: -100, date: 1, createdAt: 1, kind: "expense", from: source.id });
  mocks.edit.mockResolvedValue({ id: "legacy-tx", title: "lunch", value: -100, date: 1, createdAt: 1, kind: "expense", from: source.id });
  mocks.boiler.mockResolvedValue({ id: "legacy-tx", title: "lunch", value: 100, date: 1, createdAt: 1, kind: "feed", to: source.id });
  mocks.query.mockResolvedValue({ events: [entry("new")], cursor: null, isDone: true });
});

const cases: { name: string; props: AmountFormProps; value: string }[] = [
  { name: "creation", props: { pipeId: source.id }, value: "-1.00" },
  { name: "feed", props: { pipeId: source.id, variant: "feed" }, value: "1.00" },
  { name: "edit", props: { pipeId: source.id, variant: "transaction", initState: {
    transactionId: "legacy-tx" as Id<"transactions">, intent: "edit", structure: { type: "expense", from: source.id },
    pipeName: source.name, pipeIcon: source.icon, title: "lunch", value: "-1.00", date: 1,
  } }, value: "-1.00" },
  { name: "boiler contribution", props: { pipeId: source.id, variant: "boiler", currentFed: 1000, boilerName: source.name }, value: "1.00" },
];

async function setup(props: AmountFormProps) {
  const values = new Map<string, string>();
  const disk = {
    read: async (key: string) => values.get(key) ?? null,
    write: async (key: string, value: string) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
  };
  const seed = new EventHistoryStore("alice", disk);
  await seed.hydrate();
  await seed.mergeHead([entry("old")], false, 1);
  const success = vi.fn();
  const { result } = renderHook(() => ({
    form: useAmountFormController({ ...props, onSuccess: success }),
    history: useEventHistory(),
  }), { wrapper: ({ children }) => <TransactionCacheProvider storage={disk}>{children}</TransactionCacheProvider> });
  await waitFor(() => expect(result.current.history.entries).toEqual([entry("old")]));
  return { result, values, success };
}

it.each(cases)("refreshes event history after $name without persisting a transaction snapshot", async ({ props, value }) => {
  const { result, values, success } = await setup(props);
  act(() => result.current.form.updateDraft({ title: "lunch", value }));
  await act(async () => result.current.form.action.submit());
  await waitFor(() => expect(result.current.history.entries).toEqual([entry("new")]));
  expect(success).toHaveBeenCalledOnce();
  expect(values.has("alice")).toBe(false);
  expect(mocks.error).not.toHaveBeenCalled();
});

it.each(cases)("keeps event history intact when $name fails", async ({ props, value }) => {
  const mutate = props.variant === "boiler" ? mocks.boiler : props.variant === "transaction" ? mocks.edit : mocks.create;
  mutate.mockRejectedValueOnce(new Error("rejected"));
  const { result, values, success } = await setup(props);
  const snapshot = values.get("event-history:alice");
  act(() => result.current.form.updateDraft({ title: "lunch", value }));
  await act(async () => result.current.form.action.submit());
  expect(result.current.history.entries).toEqual([entry("old")]);
  expect(values.get("event-history:alice")).toBe(snapshot);
  expect(mocks.query).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("rejected");
});

it("does not invalidate history for a boiler current-fed-only correction with no event", async () => {
  mocks.boiler.mockResolvedValueOnce(null);
  const { result, success } = await setup({ pipeId: source.id, variant: "boiler", currentFed: 1000, boilerName: source.name });
  act(() => result.current.form.updateDraft({ currentFed: "12.00" }));
  await act(async () => result.current.form.action.submit());
  expect(success).toHaveBeenCalledOnce();
  expect(result.current.history.entries).toEqual([entry("old")]);
  expect(mocks.query).not.toHaveBeenCalled();
});
