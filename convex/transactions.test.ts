import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransaction, editTransaction } from "./transactions";

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
        userId: "user-1",
      });
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
