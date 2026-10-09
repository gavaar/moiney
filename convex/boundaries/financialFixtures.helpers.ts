import type { TestConvex } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type schema from "../schema";
import { insertFinancialOperation } from "../lib/events/financial";
import { readFinancialSnapshot, type FinancialSnapshot } from "../lib/events/financialSnapshot";
import { latestCorrectionEditedAt } from "../lib/events/corrections";
import { transactionStructureFromRoles } from "../../domain/transactions";

type Test = TestConvex<typeof schema>;
type Client = Pick<Test, "mutation" | "query">;

/** Fixture convenience: submit the real public command, then read its new operation. */
export async function createAndReadOperation(t: Test, client: Client, args: FunctionArgs<typeof api.financialOperations.create>) {
  const before = new Set(await t.run(async ctx => (await ctx.db.query("events").collect()).map(event => event._id)));
  await client.mutation(api.financialOperations.create, args);
  const operationId = await t.run(async ctx => (await ctx.db.query("events").collect())
    .find(event => !before.has(event._id) && event.operationId === event._id)!._id);
  const snapshot = await client.query(api.financialOperations.get, { operationId });
  if (!snapshot) throw new Error("Created operation is missing");
  return { ...snapshot, id: operationId };
}

export async function contributeAndReadOperation(t: Test, client: Client, args: FunctionArgs<typeof api.financialOperations.contributeToBoiler>) {
  const before = new Set(await t.run(async ctx => (await ctx.db.query("events").collect()).map(event => event._id)));
  const historyChanged = await client.mutation(api.financialOperations.contributeToBoiler, args);
  if (!historyChanged) return null;
  const operationId = await t.run(async ctx => (await ctx.db.query("events").collect())
    .find(event => !before.has(event._id) && event.operationId === event._id)!._id);
  const snapshot = await client.query(api.financialOperations.get, { operationId });
  if (!snapshot) throw new Error("Contribution operation is missing");
  return { ...snapshot, id: operationId };
}

export async function readOperation(ctx: MutationCtx, operationId: Id<"events">) {
  const event = await ctx.db.get("events", operationId);
  if (!event) return null;
  const { _creationTime, ...snapshot } = await readFinancialSnapshot(ctx, event.userId, operationId);
  return { ...snapshot, _id: operationId, _creationTime, userId: event.userId,
    editedAt: await latestCorrectionEditedAt(ctx, event.userId, operationId) };
}

export async function readOperations(ctx: MutationCtx) {
  const events = await ctx.db.query("events").collect();
  const financial = events.filter(event => event.operationId === event._id && event.type !== "pipe_creation" && event.type !== "pipe_deletion");
  return Promise.all(financial.map(async event => {
    const snapshot = await readOperation(ctx, event._id);
    if (!snapshot) throw new Error("Financial operation disappeared");
    return snapshot;
  }));
}

/** Persist a historical operation without replaying its accounting effects. */
export async function insertOperation(ctx: MutationCtx, fields: Omit<FinancialSnapshot, "_creationTime" | "operationId"> & { userId: Id<"users"> }) {
  return insertFinancialOperation(ctx, { userId: fields.userId, title: fields.title, value: fields.value,
    occurredAt: fields.date, structure: transactionStructureFromRoles(fields) });
}
