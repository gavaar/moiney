// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

it.each([
  "history:list",
  "history:archivePage",
  "transactions:listTransactions",
  "transactions:listTransactionsPaginated",
  "transactions:forEventOperation",
  "transactions:listTransactionCorrectionsPaginated",
  "monthlySpendingStats:monthPage",
])("does not expose the retired reader %s", async path => {
  const t = convexTest(schema, modules);
  await expect(t.query(makeFunctionReference<"query">(path), {})).rejects.toThrow(/Could not find|no such export/);
});

it.each([
  "monthlySpendingStats:captureUserMonth",
  "transactions:createTransaction",
  "transactions:contributeToBoiler",
  "transactions:editTransaction",
  "transactions:deleteTransaction",
  "transactions:deleteTransactionCorrectionsBatch",
  "migrations:m20261006_160000_backfillLivePipeEvents",
  "migrations:m20261006_160001_backfillLifecycleEvents",
  "migrations:m20261006_160002_backfillTransactionEvents",
])("does not expose the retired job %s", async path => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(makeFunctionReference<"mutation">(path), {})).rejects.toThrow(/Could not find|no such export/);
});
