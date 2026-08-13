import { describe, expect, it, vi } from "vitest";
import {
  migratePipesToCents,
  migrateTransactionsToCents,
} from "./migrations";

function queryChain<T>(rows: T[]) {
  return {
    withIndex: vi.fn(() => ({
      collect: vi.fn().mockResolvedValue(rows),
    })),
  };
}

function migrationPage<T>(page: T[]) {
  return {
    paginate: vi.fn().mockResolvedValue({
      continueCursor: "done",
      page,
      isDone: true,
    }),
  };
}

const migrationArgs = {
  oneBatchOnly: true,
  cursor: "legacy-cursor",
  batchSize: 100,
  dryRun: false,
};

describe("migrateTransactionsToCents", () => {
  it("converts legacy values and skips already-marked transactions", async () => {
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue(
          migrationPage([
            {
              _id: "tx-1",
              value: 12.345,
              moneyMigrationVersion: undefined,
            },
            {
              _id: "tx-2",
              value: 999,
              moneyMigrationVersion: 1,
            },
          ]),
        ),
        patch: vi.fn(),
      },
    } as any;

    await (migrateTransactionsToCents as any)._handler(ctx, migrationArgs);

    expect(ctx.db.patch).toHaveBeenCalledWith("transactions", "tx-1", {
      value: 1235,
      moneyMigrationVersion: 1,
    });
    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
  });
});

describe("migratePipesToCents", () => {
  it("does not migrate transactions owned by another migration phase", async () => {
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "users") {
            return {
              paginate: vi.fn().mockResolvedValue({
                continueCursor: "done",
                page: [{ _id: "user-1", moneyMigrationVersion: undefined }],
                isDone: true,
              }),
            };
          }
          if (table === "pipeDeletionJobs") return queryChain([]);
          if (table === "pipes") {
            return queryChain([
              {
                _id: "pipe-1",
                parentId: undefined,
                fed: 1.25,
                capacity: 2,
                spent: 0,
                capUpdateValue: undefined,
              },
            ]);
          }
          return queryChain([]);
        }),
        patch: vi.fn(),
      },
    } as any;

    await (migratePipesToCents as any)._handler(ctx, {
      oneBatchOnly: true,
      cursor: "legacy-cursor",
      batchSize: 10,
      dryRun: false,
    });

    const queriedTables = ctx.db.query.mock.calls.map(([table]: [string]) => table);
    expect(queriedTables).not.toContain("transactions");
    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      "transactions",
      expect.anything(),
      expect.anything(),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith("pipes", "pipe-1", {
      capacity: 200,
      fed: 125,
      spent: 0,
      capUpdateValue: undefined,
      moneyMigrationVersion: 1,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith("users", "user-1", {
      moneyMigrationVersion: 1,
    });
  });

  it("rejects a user with an active deletion job before writing pipes", async () => {
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "users") {
            return migrationPage([{ _id: "user-1", moneyMigrationVersion: undefined }]);
          }
          return queryChain([
            {
              phase: "processingTransactions",
            },
          ]);
        }),
        patch: vi.fn(),
      },
    } as any;

    await expect(
      (migratePipesToCents as any)._handler(ctx, {
        ...migrationArgs,
        batchSize: 10,
      }),
    ).rejects.toThrow("Cannot migrate money while a pipe deletion job is active");

    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("does not double-convert a marked member of a mixed tree", async () => {
    const markedChild = {
      _id: "child-marked",
      parentId: "root",
      fed: 125,
      capacity: 200,
      spent: 0,
      moneyMigrationVersion: 1,
    };
    const legacyChild = {
      _id: "child-legacy",
      parentId: "root",
      fed: 1.25,
      capacity: 2,
      spent: 0,
      moneyMigrationVersion: undefined,
    };
    const root = {
      _id: "root",
      parentId: undefined,
      fed: 2.5,
      capacity: 4,
      spent: 0,
      moneyMigrationVersion: undefined,
    };
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "users") {
            return migrationPage([{ _id: "user-1", moneyMigrationVersion: undefined }]);
          }
          if (table === "pipeDeletionJobs") return queryChain([]);
          return queryChain([root, markedChild, legacyChild]);
        }),
        patch: vi.fn(),
      },
    } as any;

    await (migratePipesToCents as any)._handler(ctx, {
      ...migrationArgs,
      batchSize: 10,
    });

    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      "pipes",
      "child-marked",
      expect.anything(),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "pipes",
      "child-legacy",
      expect.objectContaining({
        capacity: 200,
        moneyMigrationVersion: 1,
      }),
    );
  });

  it("includes a marked parent when converting an unmarked child", async () => {
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "users") {
            return migrationPage([{ _id: "user-1", moneyMigrationVersion: undefined }]);
          }
          if (table === "pipeDeletionJobs") return queryChain([]);
          return queryChain([
            {
              _id: "root-marked",
              parentId: undefined,
              fed: 250,
              capacity: 400,
              spent: 0,
              moneyMigrationVersion: 1,
            },
            {
              _id: "child-legacy",
              parentId: "root-marked",
              fed: 1.25,
              capacity: 2,
              spent: 0,
              moneyMigrationVersion: undefined,
            },
          ]);
        }),
        patch: vi.fn(),
      },
    } as any;

    await (migratePipesToCents as any)._handler(ctx, {
      ...migrationArgs,
      batchSize: 10,
    });

    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      "pipes",
      "root-marked",
      expect.anything(),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "pipes",
      "child-legacy",
      expect.objectContaining({
        capacity: 200,
        moneyMigrationVersion: 1,
      }),
    );
  });
});
