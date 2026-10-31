import { expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { DeletedPipeEntry } from "@features/pipes/data/deletedPipes";
import { groupMonthlyEventHistory } from "@features/transactions/history/events/event-archives";
import type { HistoryEntry } from "@features/transactions/history/events/event-groups";
import { prepareHistoryRows } from "./history-rows";

it("preserves row identities and nesting when archives and their groups close and reopen", () => {
  const pipeId = "deleted" as Id<"pipes">;
  const deleted: DeletedPipeEntry = {
    id: "deletion" as Id<"events">,
    operationId: "deletion" as Id<"events">,
    pipeId,
    type: "pipe_deletion",
    ancestorIds: [],
    name: "Archived",
    icon: "wallet-outline",
    pipeType: "pipe",
    occurredAt: Date.UTC(2026, 5, 16),
    createdAt: 0,
  };
  const entries: HistoryEntry[] = ["first", "second"].map((id, index) => ({
    id: id as Id<"events">,
    operationId: id as Id<"events">,
    type: "transaction",
    pipeId,
    title: "coffee",
    value: -100,
    occurredAt: Date.UTC(2026, 5, 15 - index),
    createdAt: index,
  }));
  entries.push({ ...deleted, id: "creation" as Id<"events">, operationId: "creation" as Id<"events">, type: "pipe_creation", occurredAt: Date.UTC(2026, 5, 1) });
  const prepared = prepareHistoryRows(groupMonthlyEventHistory(entries, [deleted]));
  const collapsed = prepared.visible(new Set());
  const archive = collapsed.find(row => row.kind === "archive");
  if (!archive) throw new Error("Expected an archive");
  const archiveOpen = prepared.visible(new Set([archive.key]));
  const group = archiveOpen.find(row => row.kind === "event" && row.row.kind === "group");
  if (!group) throw new Error("Expected an archived title group");
  const fullyOpen = prepared.visible(new Set([archive.key, group.key]));
  const members = fullyOpen.filter(row => row.kind === "event" && row.row.kind === "operation");
  expect(members).toHaveLength(2);
  expect(members.every(row => row.depth === 2 && row.key.startsWith(`${group.key}:`))).toBe(true);
  expect(group.branch).toEqual([true]);
  expect(members.map(row => row.branch)).toEqual([[true, true], [true, false]]);
  expect(archiveOpen.at(-1)?.branch).toEqual([false]);
  expect(new Set(fullyOpen.map(row => row.key)).size).toBe(fullyOpen.length);
  for (const row of archiveOpen) expect(fullyOpen.find(candidate => candidate.key === row.key)).toBe(row);

  const hidden = prepared.visible(new Set([group.key]));
  expect(hidden).toEqual(collapsed);
  for (const row of collapsed) expect(hidden.find(candidate => candidate.key === row.key)).toBe(row);
  const reopened = prepared.visible(new Set([archive.key, group.key]));
  for (const row of fullyOpen) expect(reopened.find(candidate => candidate.key === row.key)).toBe(row);
});
