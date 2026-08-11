import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupStaleTitleUsage,
  createTransaction,
  editTransaction,
} from "./transactions";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue("user-1"),
}));

function mockDb() {
  const chain: any = {
    withIndex: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    order: vi.fn(() => chain),
    first: vi.fn().mockResolvedValue(null),
    collect: vi.fn().mockResolvedValue([]),
    take: vi.fn().mockResolvedValue([]),
  };
  return {
    get: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(() => chain),
    _chain: chain,
  };
}

function mockCtx() {
  return { db: mockDb(), auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: "user-1" }) } } as any;
}

const A_PIPE = { _id: "pipe-1", userId: "user-1", fed: 500, spent: 100 };
const B_PIPE = { _id: "pipe-2", userId: "user-1", fed: 200, spent: 50 };

describe("createTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("spend (from only)", () => {
    it("patches from.spent and inserts transaction with no to", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(A_PIPE);

      await (createTransaction as any)._handler(ctx, {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
      expect(ctx.db.insert).toHaveBeenCalledWith("transactions", {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
        to: undefined,
        kind: "expense",
        userId: "user-1",
      });
    });
  });

  describe("transfer (from + to)", () => {
    it("patches both source.fed and dest.fed and inserts transaction with to", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (createTransaction as any)._handler(ctx, {
        title: "transfer",
        value: -50,
        date: 2000,
        from: "pipe-1",
        to: "pipe-2",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 450 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-2", { fed: 250 });
      expect(ctx.db.insert).toHaveBeenCalledWith("transactions", {
        title: "transfer",
        value: -50,
        date: 2000,
        from: "pipe-1",
        to: "pipe-2",
        kind: "transfer",
        userId: "user-1",
      });
    });
  });

  describe("feed (to only — no from)", () => {
    it("patches to.fed and inserts transaction with from: undefined", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(A_PIPE);

      await (createTransaction as any)._handler(ctx, {
        title: "salary",
        value: 1000,
        date: 3000,
        to: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 1500 });
      expect(ctx.db.insert).toHaveBeenCalledWith("transactions", {
        title: "salary",
        value: 1000,
        date: 3000,
        from: undefined,
        to: "pipe-1",
        kind: "feed",
        userId: "user-1",
      });
    });
  });

  describe("pay by transfer", () => {
    it("moves fed from the payer and records spend and fed on the category", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (createTransaction as any)._handler(ctx, {
        title: "coffee",
        value: -30,
        date: 3500,
        from: "pipe-1",
        paidFrom: "pipe-2",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
        fed: 530,
        spent: 130,
      });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-2", { fed: 170 });
      expect(ctx.db.patch).toHaveBeenCalledTimes(2);
      expect(ctx.db.insert).toHaveBeenCalledWith("transactions", {
        title: "coffee",
        value: -30,
        date: 3500,
        from: "pipe-1",
        paidFrom: "pipe-2",
        kind: "expense",
        userId: "user-1",
      });
    });

    it("rejects paying from the spending pipe", async () => {
      const ctx = mockCtx();

      await expect(
        (createTransaction as any)._handler(ctx, {
          title: "coffee",
          value: -30,
          date: 3500,
          from: "pipe-1",
          paidFrom: "pipe-1",
        }),
      ).rejects.toThrow("Paid from pipe must be different");
    });

    it("allows a positive refund to a parentless pipe that has children", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return { ...B_PIPE, parentId: undefined };
        return null;
      });
      ctx.db._chain.take
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: "child" }]);

      await expect(
        (createTransaction as any)._handler(ctx, {
          title: "coffee refund",
          value: 30,
          date: 3500,
          from: "pipe-1",
          paidFrom: "pipe-2",
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects a negative payer in the transaction pipe's root tree", async () => {
      const ctx = mockCtx();
      const rootPipe = { ...A_PIPE, _id: "root-1", parentId: undefined };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return { ...A_PIPE, parentId: "root-1" };
        if (id === "pipe-2") return { ...B_PIPE, parentId: "root-1" };
        if (id === "root-1") return rootPipe;
        return null;
      });

      await expect(
        (createTransaction as any)._handler(ctx, {
          title: "coffee",
          value: -30,
          date: 3500,
          from: "pipe-1",
          paidFrom: "pipe-2",
        }),
      ).rejects.toThrow("Paid from pipe must be outside the transaction tree");
    });

    it("recalculates the paid-from tree after applying the balance changes", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (createTransaction as any)._handler(ctx, {
        title: "coffee",
        value: -30,
        date: 3500,
        from: "pipe-1",
        paidFrom: "pipe-2",
      });

      expect(ctx.db._chain.collect).toHaveBeenCalled();
    });
  });

  describe("rule execution", () => {
    it("executes any_spend rule after a spend", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue({ ...A_PIPE, rule: "any_spend" });

      await (createTransaction as any)._handler(ctx, {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 400, spent: 0 });
      expect(ctx.db._chain.collect).toHaveBeenCalled();
    });

    it("executes any_spend rule on the source after a transfer", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "pipe-1") return { ...A_PIPE, rule: "any_spend" };
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (createTransaction as any)._handler(ctx, {
        title: "transfer",
        value: -50,
        date: 2000,
        from: "pipe-1",
        to: "pipe-2",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 450 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-2", { fed: 250 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 400, spent: 0 });
    });

    it("executes spend_overflow rule when the new spent reaches capacity", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue({ ...A_PIPE, rule: "spend_overflow", capacity: 100 });

      await (createTransaction as any)._handler(ctx, {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 400, spent: 0 });
    });

    it("does not execute spend_overflow rule when the new spent is below capacity", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue({ ...A_PIPE, rule: "spend_overflow", capacity: 200 });

      await (createTransaction as any)._handler(ctx, {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledTimes(1);
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
    });

    it("applies the cap update formula when spend_overflow triggers with capUpdateValue", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue({
        ...A_PIPE,
        rule: "spend_overflow",
        capacity: 100,
        capUpdateValue: 50,
      });

      await (createTransaction as any)._handler(ctx, {
        title: "groceries",
        value: -30,
        date: 1000,
        from: "pipe-1",
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
        fed: 400,
        spent: 0,
        capacity: 50,
      });
    });
  });

  describe("validation", () => {
    it("throws when neither from nor to is provided", async () => {
      const ctx = mockCtx();

      await expect(
        (createTransaction as any)._handler(ctx, {
          title: "nowhere",
          value: 0,
          date: 4000,
        }),
      ).rejects.toThrow("Either 'from' or 'to' must be provided");
    });
  });
});

describe("editTransaction", () => {
  const BASE_TX = {
    _id: "tx-1",
    _creationTime: 1000,
    title: "old title",
    value: -50,
    date: 2000,
    from: "pipe-1" as string | undefined,
    to: undefined as string | undefined,
    userId: "user-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("spend transaction", () => {
    it("patches transaction and adjusts from.spent when value changes", async () => {
      const ctx = mockCtx();
      const tx = { ...BASE_TX, from: "pipe-1", to: undefined };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return { ...A_PIPE, spent: 100 };
        return null;
      });

      await (editTransaction as any)._handler(ctx, {
        transactionId: "tx-1",
        title: "new title",
        value: -80,
        date: 3000,
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("tx-1", {
        title: "new title",
        value: -80,
        date: 3000,
      });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { spent: 130 });
      expect(ctx.db._chain.collect).toHaveBeenCalled();
      expect(ctx.db.insert).not.toHaveBeenCalled();
    });

    it("rejects editing a transaction with an embedded deleted-role icon", async () => {
      const ctx = mockCtx();
      const tx = { ...BASE_TX, fromIcon: "pipe-disconnected" };
      ctx.db.get.mockResolvedValue(tx);

      await expect(
        (editTransaction as any)._handler(ctx, {
          transactionId: "tx-1",
          title: "new title",
          value: -80,
          date: 3000,
        }),
      ).rejects.toThrow("Transaction is view-only");
    });
  });

  describe("feed transaction", () => {
    it("patches transaction and adjusts to.fed when value changes", async () => {
      const ctx = mockCtx();
      const tx = { ...BASE_TX, title: "salary", value: 1000, from: undefined, to: "pipe-1" };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return { ...A_PIPE, fed: 500 };
        return null;
      });

      await (editTransaction as any)._handler(ctx, {
        transactionId: "tx-1",
        title: "bonus",
        value: 1200,
        date: 4000,
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("tx-1", {
        title: "bonus",
        value: 1200,
        date: 4000,
      });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 700 });
    });
  });

  describe("transfer transaction", () => {
    it("patches transaction and adjusts both pipes' fed when value changes", async () => {
      const ctx = mockCtx();
      const tx = { ...BASE_TX, value: -50, from: "pipe-1", to: "pipe-2" };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return { ...A_PIPE, fed: 500 };
        if (id === "pipe-2") return { ...B_PIPE, fed: 200 };
        return null;
      });

      await (editTransaction as any)._handler(ctx, {
        transactionId: "tx-1",
        title: "new transfer",
        value: -80,
        date: 5000,
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("tx-1", {
        title: "new transfer",
        value: -80,
        date: 5000,
      });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", { fed: 470 });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-2", { fed: 230 });
    });
  });

  describe("pay by transfer transaction", () => {
    it("adjusts all three balances by the edited value difference", async () => {
      const ctx = mockCtx();
      const tx = {
        ...BASE_TX,
        value: -50,
        from: "pipe-1",
        paidFrom: "pipe-2",
      };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (editTransaction as any)._handler(ctx, {
        transactionId: "tx-1",
        title: "more coffee",
        value: -80,
        date: 5000,
      });

      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
        fed: 530,
        spent: 130,
      });
      expect(ctx.db.patch).toHaveBeenCalledWith("pipe-2", { fed: 170 });
    });

    it("recalculates the paid-from tree after an amount edit", async () => {
      const ctx = mockCtx();
      const tx = {
        ...BASE_TX,
        value: -50,
        from: "pipe-1",
        paidFrom: "pipe-2",
      };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return B_PIPE;
        return null;
      });

      await (editTransaction as any)._handler(ctx, {
        transactionId: "tx-1",
        title: "coffee",
        value: -80,
        date: 5000,
      });

      expect(ctx.db._chain.collect).toHaveBeenCalled();
    });

    it("rejects changing to a refund when paidFrom is not a root pipe", async () => {
      const ctx = mockCtx();
      const tx = {
        ...BASE_TX,
        value: -50,
        from: "pipe-1",
        paidFrom: "pipe-2",
      };
      ctx.db.get.mockImplementation((id: string) => {
        if (id === "tx-1") return tx;
        if (id === "pipe-1") return A_PIPE;
        if (id === "pipe-2") return { ...B_PIPE, parentId: "root-2" };
        return null;
      });

      await expect(
        (editTransaction as any)._handler(ctx, {
          transactionId: "tx-1",
          title: "coffee refund",
          value: 30,
          date: 5000,
        }),
      ).rejects.toThrow("Refund destination must be a root outside the transaction tree");
    });
  });

  describe("validation", () => {
    it("throws when transaction is not found", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(null);

      await expect(
        (editTransaction as any)._handler(ctx, {
          transactionId: "nonexistent",
          title: "test",
          value: 0,
          date: 1000,
        }),
      ).rejects.toThrow("Transaction not found");
    });

    it("throws when user does not own the transaction", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue({ ...BASE_TX, userId: "other-user" });

      await expect(
        (editTransaction as any)._handler(ctx, {
          transactionId: "tx-1",
          title: "test",
          value: 0,
          date: 1000,
        }),
      ).rejects.toThrow("Not authorized");
    });
  });
});

describe("cleanupStaleTitleUsage", () => {
  it("deletes one bounded stale batch and schedules the next batch", async () => {
    const staleRows = Array.from({ length: 100 }, (_, index) => ({
      _id: `usage-${index}`,
    }));
    const take = vi.fn().mockResolvedValue(staleRows);
    const withIndex = vi.fn((_name, range) => {
      range({ lt: vi.fn() });
      return { take };
    });
    const ctx = {
      db: {
        query: vi.fn(() => ({ withIndex })),
        delete: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await (cleanupStaleTitleUsage as any)._handler(ctx, { now: 1_000_000 });

    expect(withIndex).toHaveBeenCalledWith("by_lastUsedAt", expect.any(Function));
    expect(take).toHaveBeenCalledWith(100);
    expect(ctx.db.delete).toHaveBeenCalledTimes(100);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      expect.anything(),
      { now: 1_000_000 },
    );
  });
});
