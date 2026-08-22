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

describe("TransactionCacheProvider", () => {
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
