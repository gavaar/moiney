import { Text, View } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import { Icon, safeIconName, type IconName } from "@ui/Icon";
import { SlideToggle } from "@ui/SlideToggle";
import type { TransactionInitialState } from "./types";

type Intent = "create" | "repeat" | "edit";
type TransactionHeading = {
  intent: Intent;
  initial: Pick<TransactionInitialState, "pipeName" | "pipeIcon" | "title" | "spent" | "capacity">;
};
type Props = {
  transaction: TransactionHeading | null;
  sourceSelected: boolean;
  spend: { mode: "spend" | "transfer"; updateMode: (mode: string) => void } | null;
  showMode: boolean;
  loading: boolean;
};

const intentIcons: Record<Intent, IconName> = {
  create: "add-circle-outline", repeat: "repeat-once", edit: "pencil-outline",
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
  return { title, accessibleTitle: intent === "create" ? `Create: ${title}` : title, icon };
}

export function AmountFormHeader({ transaction, sourceSelected, spend, showMode, loading }: Props) {
  const heading = transaction ? getHeading(transaction, sourceSelected) : null;
  return (
    <View className="gap-2">
      {transaction && heading ? (
        <View accessibilityRole="header" accessibilityLabel={heading.accessibleTitle}
          className="flex-row items-center justify-between gap-2 border-b border-muted/20 p-2">
          <View className="flex-1 flex-row items-center gap-2">
            <Icon name={heading.icon} size={24} color={colors.muted} />
            <Text className="flex-1 text-md font-medium text-muted" numberOfLines={1}>{heading.title}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted">{transaction.intent}</Text>
            <Icon name={intentIcons[transaction.intent]} size={18} color={colors.muted} />
          </View>
        </View>
      ) : null}
      {spend && showMode ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-text">{spend.mode === "spend" ? "Add transaction" : "Transfer"}</Text>
          <SlideToggle options={[
            { value: "spend", label: "Spend", icon: "upload" },
            { value: "transfer", label: "Transfer", icon: "repeat" },
          ]} value={spend.mode} onChange={spend.updateMode} disabled={loading} />
        </View>
      ) : null}
    </View>
  );
}
