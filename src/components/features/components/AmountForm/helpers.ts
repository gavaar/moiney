import { colors } from "@/lib/styles";
import type { PipeModel } from "@features/pipes/data/pipes";

type PipeReference = Pick<
  PipeModel,
  "id" | "parentId" | "name" | "icon" | "deletionJobId"
>;

export function getTopmostPipeId(
  pipes: readonly PipeReference[],
  startingPipeId: PipeModel["id"],
): PipeModel["id"] {
  let topmostPipeId = startingPipeId;
  let currentPipe = pipes.find((pipe) => pipe.id === topmostPipeId);
  while (currentPipe?.parentId) {
    topmostPipeId = currentPipe.parentId;
    currentPipe = pipes.find((pipe) => pipe.id === topmostPipeId);
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
  pipeId: PipeModel["id"],
): Array<{ id: string; name: string; icon: string }> {
  const pipes = allPipes ?? [];

  const ancestorIds = new Set<PipeModel["id"]>();
  let currentId: PipeModel["id"] | undefined = pipeId;
  while (currentId) {
    ancestorIds.add(currentId);
    const pipe = pipes.find((p) => p.id === currentId);
    currentId = pipe?.parentId;
  }

  const feeds = pipes.filter(
    (p) => !p.parentId && !p.deletionJobId && !ancestorIds.has(p.id),
  );

  return [
    { id: "", name: "None", icon: "close-circle" },
    ...feeds.map((p) => ({ id: p.id, name: p.name, icon: p.icon })),
  ];
}

export function buildPaidFromPipeItems(
  allPipes: readonly PipeReference[] | null | undefined,
  pipeId: PipeModel["id"],
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
          !parentIds.has(pipe.id) &&
          !pipe.deletionJobId &&
          getTopmostPipeId(pipes, pipe.id) !== topmostPipeId,
      )
    : pipes.filter(
        (pipe) =>
          !pipe.parentId &&
          !pipe.deletionJobId &&
          pipe.id !== topmostPipeId,
      );

  return [
    { id: "", name: "None", icon: "close-circle" },
    ...eligiblePipes
      .map((pipe) => ({ id: pipe.id, name: pipe.name, icon: pipe.icon })),
  ];
}

export function getDestinationPipeName(
  allPipes:
    | Array<Pick<PipeModel, "id" | "name">>
    | null
    | undefined,
  sentToPipeId: PipeModel["id"] | null,
): string | null {
  if (!sentToPipeId || !allPipes) return null;
  const pipe = allPipes.find((p) => p.id === sentToPipeId);
  return pipe?.name ?? null;
}
