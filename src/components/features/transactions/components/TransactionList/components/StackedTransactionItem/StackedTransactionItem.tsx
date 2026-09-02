import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon, safeIconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from "@features/components/AmountForm";
import { transactionStructureFromRoles } from "@domain/transactions";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import { isPaidFromPipeEligible } from "@features/pipes/data/paidFromEligibility";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { formatAmount } from "@/lib/format";

type StackedTransactionItemProps = {
  group: TransactionGroup;
  expanded: boolean;
  onToggle: () => void;
};

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function formatDateRange(oldestDate: number, latestDate: number): string {
  const oldest = new Date(oldestDate);
  const latest = new Date(latestDate);

  const sameYear = oldest.getFullYear() === latest.getFullYear();
  const sameMonth = sameYear && oldest.getMonth() === latest.getMonth();

  if (sameYear && sameMonth) {
    const o = oldest.toLocaleDateString("en-US", MONTH_DAY);
    return `${o} - ${latest.getDate()}, ${latest.getFullYear()}`;
  }
  if (sameYear) {
    const o = oldest.toLocaleDateString("en-US", MONTH_DAY);
    const l = latest.toLocaleDateString("en-US", MONTH_DAY);
    return `${o} - ${l}, ${latest.getFullYear()}`;
  }
  const o = oldest.toLocaleDateString("en-US", MONTH_DAY_YEAR);
  const l = latest.toLocaleDateString("en-US", MONTH_DAY_YEAR);
  return `${o} - ${l}`;
}

export function StackedTransactionItem({
  group,
  expanded,
  onToggle,
}: StackedTransactionItemProps) {
  const isNegative = group.totalValue < 0;
  const [showForm, setShowForm] = useState(false);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const disclosureRotation = useSharedValue(expanded ? 1 : 0);
  const { allPipes, pipesById, childrenByParent } = usePipeCatalog();

  useEffect(() => {
    disclosureRotation.value = withTiming(expanded ? 1 : 0, { duration: 180 });
  }, [disclosureRotation, expanded]);

  const disclosureRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${disclosureRotation.value * 180}deg` }],
  }));
  const bgClass = useMemo(() => {
    if (group.totalValue === 0) return "bg-surface";
    return isNegative ? "bg-error/30" : "bg-success/30";
  }, [group.totalValue, isNegative]);

  const latestTransaction = group.transactions[0];
  const sourcePipe = group.from ? pipesById?.[group.from] : undefined;
  const destPipe = group.to ? pipesById?.[group.to] : undefined;
  const paidFromPipe = group.paidFrom ? pipesById?.[group.paidFrom] : undefined;
  const deletedIcons = {
    from: group.transactions.find((transaction) => transaction.fromIcon)?.fromIcon,
    to: group.transactions.find((transaction) => transaction.toIcon)?.toIcon,
    paidFrom: group.transactions.find((transaction) => transaction.paidFromIcon)?.paidFromIcon,
  };
  const visiblePipeId = group.visiblePipeIds[0];
  const visiblePipe = visiblePipeId ? pipesById?.[visiblePipeId] : undefined;
  const visibleDeletedIcon = visiblePipeId
    ? group.transactions.reduce<string | undefined>((icon, transaction) => {
        if (icon) return icon;
        if (transaction.from === visiblePipeId) return transaction.fromIcon;
        if (transaction.to === visiblePipeId) return transaction.toIcon;
        if (transaction.paidFrom === visiblePipeId) return transaction.paidFromIcon;
        return undefined;
      }, undefined)
    : undefined;
  const groupIconName =
    group.visiblePipeIds.length > 1
      ? "card-multiple"
      : visiblePipe?.icon ?? visibleDeletedIcon ?? "pipe-disconnected";
  const groupIconColor =
    group.visiblePipeIds.length > 1
      ? colors.surface
      : visiblePipe || visibleDeletedIcon
        ? colors.muted
        : colors.surface;
  const fromValid =
    !!sourcePipe &&
    !sourcePipe.deletionJobId &&
    (childrenByParent.get(sourcePipe.id)?.length ?? 0) === 0;
  const toValid = !!destPipe && !destPipe.deletionJobId && destPipe.parentId === undefined;
  const paidFromValid =
    !!group.from &&
    !!group.paidFrom &&
    isPaidFromPipeEligible(
      allPipes ?? Object.values(pipesById ?? {}),
      group.from,
      group.paidFrom,
      group.latestValue,
    );
  const viewOnly = !!deletedIcons.from || !!deletedIcons.to || !!deletedIcons.paidFrom;
  const disabled =
    viewOnly ||
    (!!group.from && !fromValid) ||
    (!!group.to && !toValid) ||
    (!!group.paidFrom && !paidFromValid);
  const primaryPipe = sourcePipe || destPipe;
  const amountFormInitState = primaryPipe && !viewOnly
    ? {
        pipeIcon: primaryPipe.icon,
        pipeName: primaryPipe.name,
        title: latestTransaction.title,
        value: formatAmount(group.latestValue),
        structure: transactionStructureFromRoles(group),
      }
    : undefined;

  function handlePress() {
    if (disabled && !viewOnly) {
      setShowDisabledInfo(true);
    } else {
      setShowForm(true);
    }
  }

  return (
    <>
      <View
        testID="transaction-group-row"
        className="flex-row gap-1"
      >
        <Pressable
          testID="transaction-group-main"
          className={cn(
            "flex-1 flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
            bgClass,
          )}
          onPress={handlePress}
        >
          <Icon
            name={safeIconName(groupIconName)}
            size={16}
            color={groupIconColor}
          />

          <Text
            className={cn(
              "font-bold text-sm flex-1 ml-0.5",
              disabled ? "text-muted" : "text-text",
            )}
            numberOfLines={1}
          >
            {group.title.charAt(0).toUpperCase() + group.title.slice(1)}
          </Text>

          <View className="flex-row items-center gap-1 mr-3">
            <Text
              className={cn("text-xs", disabled ? "text-muted" : "text-white")}
            >
              {formatDateRange(group.oldestDate, group.latestDate)}
            </Text>
          </View>

          <Text
            className={cn(
              "text-sm font-bold w-16 text-right",
              disabled ? "text-muted" : "text-white",
            )}
          >
            {formatAmount(group.totalValue)}
          </Text>
        </Pressable>

        <Pressable
          testID="transaction-group-disclosure"
          className={cn(
            "self-stretch rounded-full border border-border px-2 flex-row items-center justify-center gap-0.5",
            bgClass,
          )}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.count} transactions`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
        >
          <Text className="text-muted text-xs font-bold">x{group.count}</Text>
          <Animated.View style={disclosureRotationStyle}>
            <Icon name="chevron-down" size={12} color={colors.muted} />
          </Animated.View>
        </Pressable>
      </View>

      <ModalShell visible={showForm} onClose={() => setShowForm(false)}>
        {showForm && viewOnly ? (
          <View className="p-4">
            <Text className="text-text font-bold text-lg mb-2">Preserved history</Text>
            <Text className="text-muted text-sm">Preserved history is view-only.</Text>
          </View>
        ) : showForm && primaryPipe && amountFormInitState ? (
          <AmountForm variant="transaction" pipeId={primaryPipe.id} initState={amountFormInitState} />
        ) : null}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            This transaction was from a pipe that does not exist or cannot accept transactions anymore (probably due to now having children pipes).
          </Text>
        </View>
      </ModalShell>
    </>
  );
}
