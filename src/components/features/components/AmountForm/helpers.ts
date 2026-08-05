import { type Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";

type PipeReference = {
  _id: Id<"pipes">;
  parentId?: Id<"pipes">;
  name: string;
  icon: string;
};

export function getTopmostPipeId(
  pipes: readonly PipeReference[],
  startingPipeId: Id<"pipes">,
): Id<"pipes"> {
  let topmostPipeId = startingPipeId;
  let currentPipe = pipes.find((pipe) => pipe._id === topmostPipeId);
  while (currentPipe?.parentId) {
    topmostPipeId = currentPipe.parentId;
    currentPipe = pipes.find((pipe) => pipe._id === topmostPipeId);
  }
  return topmostPipeId;
}

export function getButtonStyle(intent: "repeat" | "edit", isNegative: boolean) {
  if (intent === "edit") {
    return {
      border: "border-primary",
      iconColor: colors.primary,
      textColor: "text-primary",
    } as const;
  }
  return {
    border: (isNegative ? "border-error" : "border-success"),
    iconColor: isNegative ? colors.error : colors.success,
    textColor: (isNegative ? "text-error" : "text-success"),
  } as const;
}

export function getButtonIcon(intent: "repeat" | "edit", isFeed: boolean, spendMode: string) {
  if (intent === "edit") return "checkmark";
  if (isFeed) return "add-circle-outline";
  return spendMode === "spend" ? "upload" : "repeat";
}

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
  allPipes: readonly PipeReference[] | null | undefined,
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

export function buildPaidFromPipeItems(
  allPipes: readonly PipeReference[] | null | undefined,
  pipeId: Id<"pipes">,
  isNegative: boolean,
): Array<{ id: string; name: string; icon: string }> {
  const pipes = allPipes ?? [];
  const topmostPipeId = getTopmostPipeId(pipes, pipeId);

  const parentIds = new Set(
    pipes.flatMap((pipe) => pipe.parentId ? [pipe.parentId] : []),
  );
  const eligiblePipes = isNegative
    ? pipes.filter(
        (pipe) =>
          !parentIds.has(pipe._id) &&
          getTopmostPipeId(pipes, pipe._id) !== topmostPipeId,
      )
    : pipes.filter((pipe) => !pipe.parentId && pipe._id !== topmostPipeId);

  return [
    { id: "", name: "None", icon: "close-circle" },
    ...eligiblePipes
      .map((pipe) => ({ id: pipe._id, name: pipe.name, icon: pipe.icon })),
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
