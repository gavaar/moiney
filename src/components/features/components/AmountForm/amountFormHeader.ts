import { formatAmount } from "@/lib/format";
import { safeIconName, type IconName } from "@ui/Icon";
import type { TransactionInitialState } from "./types";
import type { FormHeader } from "@ui/Form";

type Intent = "create" | "repeat" | "edit" | "feed";
type TransactionHeading = {
  intent: Intent;
  initial: Pick<TransactionInitialState, "pipeName" | "pipeIcon" | "title" | "spent" | "capacity">;
};

const intentIcons: Record<Intent, IconName> = {
  create: "add-circle-outline", repeat: "repeat-once", edit: "pencil-outline", feed: "add-circle-outline",
};

function getHeading(transaction: TransactionHeading, selected: boolean) {
  if (!selected) return { title: "Select pipe", accessibleTitle: "Select pipe", icon: "pipe-disconnected" as const };
  const { initial, intent } = transaction;
  const icon = safeIconName(initial.pipeIcon);
  if (intent === "edit") return {
    title: `Edit: ${initial.pipeName}: ${initial.title}`,
    accessibleTitle: `Edit: ${initial.pipeName} ${initial.title}`,
    icon,
  };
  const summary = initial.spent !== undefined && initial.capacity !== undefined
    ? ` (${formatAmount(initial.spent)} / ${formatAmount(initial.capacity)})` : "";
  const title = `${initial.pipeName}${summary}`;
  const accessibleTitle = intent === "create" ? `Create: ${title}` : intent === "feed" ? `Feed: ${title}` : title;
  return { title, accessibleTitle, icon };
}

export function getAmountFormHeader(transaction: TransactionHeading, sourceSelected: boolean): FormHeader {
  const heading = getHeading(transaction, sourceSelected);
  return {
    title: heading.title,
    accessibilityLabel: heading.accessibleTitle,
    icon: heading.icon,
    badge: { label: transaction.intent, icon: intentIcons[transaction.intent] },
  };
}
