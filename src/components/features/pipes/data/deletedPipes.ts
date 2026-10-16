import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";

type DeletedPipesPage = FunctionReturnType<typeof api.events.deletedPipes>;
export type DeletedPipeEntry = DeletedPipesPage["events"][number];

export async function readDeletedPipes(
  client: ConvexReactClient,
  isActive: () => boolean,
  firstPage?: DeletedPipesPage,
) {
  const entries: DeletedPipeEntry[] = [];
  const visited = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    if (!isActive()) throw new Error("Deletion catalog read cancelled");
    const page = firstPage ?? await client.query(api.events.deletedPipes, { limit: 100, ...(cursor ? { cursor } : {}) });
    firstPage = undefined;
    if (!isActive()) throw new Error("Deletion catalog read cancelled");
    entries.push(...page.events);
    if (page.isDone) return entries;
    if (!page.cursor || visited.has(page.cursor)) throw new Error("Deletion catalog pagination stalled");
    visited.add(page.cursor);
    cursor = page.cursor;
  }
}
