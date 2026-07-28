import { type Id } from "@convex/_generated/dataModel";

export function getButtonLabel(
  mode: "feed" | "spend",
  isNegative: boolean,
  destinationPipeName: string | null,
): string {
  if (mode === "feed") return "Feed";
  if (destinationPipeName) {
    return isNegative
      ? `Send to ${destinationPipeName}`
      : `Take from ${destinationPipeName}`;
  }
  return isNegative ? "Add expense" : "Add return";
}

export function buildPipeItems(
  allPipes:
    | Array<{
        _id: Id<"pipes">;
        parentId?: Id<"pipes">;
        name: string;
        icon: string;
      }>
    | null
    | undefined,
  pipeId: Id<"pipes">,
): Array<{ id: string; name: string; icon: string }> {
  const pipes = allPipes ?? [];

  const ancestorIds = new Set<Id<"pipes">>();
  let currentId: Id<"pipes"> | undefined = pipeId;
  while (currentId) {
    ancestorIds.add(currentId);
    const pipe = pipes.find((p) => p._id === currentId);
    currentId = pipe?.parentId;
  }

  const feeds = pipes.filter(
    (p) => !p.parentId && !ancestorIds.has(p._id),
  );

  return [
    { id: "", name: "None", icon: "close-circle" },
    ...feeds.map((p) => ({ id: p._id, name: p.name, icon: p.icon })),
  ];
}

export function getDestinationPipeName(
  allPipes:
    | Array<{ _id: Id<"pipes">; name: string }>
    | null
    | undefined,
  sentToPipeId: Id<"pipes"> | null,
): string | null {
  if (!sentToPipeId || !allPipes) return null;
  const pipe = allPipes.find((p) => p._id === sentToPipeId);
  return pipe?.name ?? null;
}
