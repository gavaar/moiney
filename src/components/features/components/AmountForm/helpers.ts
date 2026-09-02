import { colors } from "@/lib/styles";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { isPaidFromPipeEligible } from "@features/pipes/data/paidFromEligibility";
import type { TransactionStructure } from "@domain/transactions";

type PipeReference = Pick<
  PipeModel,
  "id" | "parentId" | "name" | "icon" | "deletionJobId"
>;

type CreateTransactionCommand = {
  title: string;
  value: number;
  date: number;
  from?: PipeModel["id"];
  to?: PipeModel["id"];
  paidFrom?: PipeModel["id"];
};

type CreateTransactionInput = {
  title: string;
  amount: number;
  date: number;
  pipeId: PipeModel["id"];
  isFeed: boolean;
  spendMode: "spend" | "transfer";
  sentToPipeId: PipeModel["id"] | null;
  paidFromPipeId: PipeModel["id"] | null;
};

type EditTransactionCommand = {
  transactionId: Id<"transactions">;
  title: string;
  value: number;
  date: number;
  target?:
    | { type: "expense" }
    | { type: "transfer"; to: PipeModel["id"] }
    | { type: "payByTransfer"; paidFrom: PipeModel["id"] };
};

type EditTransactionInput = {
  transactionId: Id<"transactions">;
  title: string;
  amount: number;
  date: number;
  initialStructure?: TransactionStructure<PipeModel["id"]>;
  spendMode?: SpendMode;
  sentToPipeId?: PipeModel["id"] | null;
  paidFromPipeId?: PipeModel["id"] | null;
};

type SpendMode = "spend" | "transfer";

type SpendModeState = {
  spendMode: SpendMode;
  sentToPipeId: PipeModel["id"] | null;
  paidFromPipeId: PipeModel["id"] | null;
  showPaidFrom: boolean;
};

export function buildCreateTransactionCommand({
  title,
  amount,
  date,
  pipeId,
  isFeed,
  spendMode,
  sentToPipeId,
  paidFromPipeId,
}: CreateTransactionInput): CreateTransactionCommand {
  if (isFeed) {
    return {
      title: title.trim(),
      value: amount,
      date,
      to: pipeId,
    };
  }

  return {
    title,
    value: amount,
    date,
    from: pipeId,
    ...(spendMode === "transfer" && sentToPipeId
      ? { to: sentToPipeId }
      : {}),
    ...(spendMode === "spend" && paidFromPipeId
      ? { paidFrom: paidFromPipeId }
      : {}),
  };
}

export function buildEditTransactionCommand({
  transactionId,
  title,
  amount,
  date,
  initialStructure,
  spendMode,
  sentToPipeId,
  paidFromPipeId,
}: EditTransactionInput): EditTransactionCommand {
  let target: EditTransactionCommand["target"];
  if (initialStructure && initialStructure.type !== "feed") {
    if (spendMode === "transfer" && sentToPipeId) {
      if (
        initialStructure.type !== "transfer" ||
        initialStructure.to !== sentToPipeId
      ) {
        target = { type: "transfer", to: sentToPipeId };
      }
    } else if (paidFromPipeId) {
      if (
        initialStructure.type !== "payByTransfer" ||
        initialStructure.paidFrom !== paidFromPipeId
      ) {
        target = { type: "payByTransfer", paidFrom: paidFromPipeId };
      }
    } else if (initialStructure.type !== "expense") {
      target = { type: "expense" };
    }
  }
  return {
    transactionId,
    title,
    value: amount,
    date,
    ...(target ? { target } : {}),
  };
}

export function getIntentDate(
  intent: "create" | "repeat" | "edit",
  initialDate: number | undefined,
  now: Date,
): Date | undefined {
  if (intent === "edit" && initialDate !== undefined) {
    return new Date(initialDate);
  }
  if (intent === "create" || intent === "repeat") return new Date(now);
  return undefined;
}

export function transitionSpendMode(
  state: SpendModeState,
  nextMode: SpendMode,
): SpendModeState {
  if (nextMode === "spend") {
    return {
      ...state,
      spendMode: nextMode,
      sentToPipeId: null,
    };
  }

  return {
    ...state,
    spendMode: nextMode,
    paidFromPipeId: null,
    showPaidFrom: false,
  };
}

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

export function getButtonStyle(
  intent: "create" | "repeat" | "edit",
  isNegative: boolean,
) {
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

export function getButtonIcon(
  intent: "create" | "repeat" | "edit",
  isFeed: boolean,
  spendMode: string,
) {
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
  const value = isNegative ? -1 : 1;
  const eligiblePipes = pipes.filter((pipe) =>
    isPaidFromPipeEligible(pipes, pipeId, pipe.id, value),
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
