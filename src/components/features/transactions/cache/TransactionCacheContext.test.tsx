// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  TransactionCacheProvider,
  useTransactionCache,
} from "./TransactionCacheContext";
import type { TransactionCacheStorage } from "./TransactionCacheStore";

const auth = { accountKey: "account-1" as string | null };
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth,
}));

function storage(): TransactionCacheStorage & { value: string | null } {
  const value = { value: null as string | null };
  return {
    ...value,
    read: vi.fn(async () => value.value),
    write: vi.fn(async (_accountKey: string, next: string) => {
      value.value = next;
    }),
    remove: vi.fn(async () => {
      value.value = null;
    }),
    get value() {
      return value.value;
    },
    set value(next: string | null) {
      value.value = next;
    },
  };
}

function Consumer() {
  const cache = useTransactionCache();
  const transaction: TransactionModel = {
    id: "tx-1" as Id<"transactions">,
    createdAt: 1,
    title: "cached",
    value: -100,
    date: 1,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
  return <button onClick={() => cache.replace("history", [transaction], false)}>save</button>;
}

function AddConsumer() {
  const cache = useTransactionCache();
  const transaction: TransactionModel = {
    id: "tx-2" as Id<"transactions">,
    createdAt: 1,
    title: "added",
    value: -100,
    date: 1,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
  return <button onClick={() => cache.addTransaction(transaction)}>add</button>;
}

function UpdateConsumer() {
  const cache = useTransactionCache();
  const transaction: TransactionModel = {
    id: "tx-3" as Id<"transactions">,
    createdAt: 1,
    title: "updated",
    value: -100,
    date: 1,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
  return <button onClick={() => cache.updateTransaction(transaction)}>update</button>;
}

function ReconcileConsumer() {
  const cache = useTransactionCache();
  const transaction: TransactionModel = {
    id: "tx-4" as Id<"transactions">,
    createdAt: 1,
    title: "survives",
    value: -100,
    date: 1,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
  return (
    <button
      onClick={() => cache.reconcileTransactions(["tx-4", "deleted"], [transaction])}
    >
      reconcile
    </button>
  );
}

describe("TransactionCacheProvider", () => {
  it("exposes create-time cache synchronization", async () => {
    const cacheStorage = storage();
    render(
      <TransactionCacheProvider storage={cacheStorage}>
        <AddConsumer />
      </TransactionCacheProvider>,
    );

    await waitFor(() => expect(screen.getByText("add")).toBeDefined());
    fireEvent.click(screen.getByText("add"));

    await waitFor(() =>
      expect(JSON.parse(cacheStorage.value!).entities["tx-2"].transaction.title).toBe(
        "added",
      ),
    );
  });

  it("exposes edit-time cache synchronization", async () => {
    const cacheStorage = storage();
    render(
      <TransactionCacheProvider storage={cacheStorage}>
        <UpdateConsumer />
      </TransactionCacheProvider>,
    );

    await waitFor(() => expect(screen.getByText("update")).toBeDefined());
    fireEvent.click(screen.getByText("update"));

    await waitFor(() =>
      expect(JSON.parse(cacheStorage.value!).entities["tx-3"].transaction.title).toBe(
        "updated",
      ),
    );
  });

  it("exposes deletion reconciliation", async () => {
    const cacheStorage = storage();
    render(
      <TransactionCacheProvider storage={cacheStorage}>
        <ReconcileConsumer />
      </TransactionCacheProvider>,
    );

    await waitFor(() => expect(screen.getByText("reconcile")).toBeDefined());
    fireEvent.click(screen.getByText("reconcile"));

    await waitFor(() => {
      const parsed = JSON.parse(cacheStorage.value!);
      expect(parsed.entities["tx-4"].transaction.title).toBe("survives");
      expect(parsed.entities.deleted).toBeUndefined();
    });
  });

  it("clears the active account cache when the account logs out", async () => {
    const cacheStorage = storage();
    const { rerender } = render(
      <TransactionCacheProvider storage={cacheStorage}>
        <Consumer />
      </TransactionCacheProvider>,
    );

    await waitFor(() => expect(screen.getByText("save")).toBeDefined());
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(cacheStorage.value).not.toBeNull());

    auth.accountKey = null;
    rerender(
      <TransactionCacheProvider storage={cacheStorage}>
        <Consumer />
      </TransactionCacheProvider>,
    );

    await waitFor(() => expect(cacheStorage.value).toBeNull());
  });
});
