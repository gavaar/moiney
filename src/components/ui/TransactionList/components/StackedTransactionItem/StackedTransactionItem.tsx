import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from "@features/components/AmountForm";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";

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
  const isNegative = group.value < 0;
  const [showForm, setShowForm] = useState(false);
  const disclosureRotation = useRef(
    new Animated.Value(expanded ? 1 : 0),
  ).current;
  const { pipesById, childrenByParent } = usePipeSelection();

  useEffect(() => {
    const animation = Animated.timing(disclosureRotation, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [disclosureRotation, expanded]);

  const disclosureRotationStyle = {
    transform: [
      {
        rotate: disclosureRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
  };
  const bgClass = useMemo(() => {
    switch(group.kind) {
      case "feed":
        return "bg-secondary/30";
      case "transfer":
        return "bg-accent/30";
      case "expense":
        return isNegative ? "bg-error/30" : "bg-primary/30";
    }
  }, [group.kind, isNegative]);

  const sourcePipe = group.from ? pipesById?.[group.from] : undefined;
  const destPipe = group.to ? pipesById?.[group.to] : undefined;
  const fromValid =
    !!sourcePipe && (childrenByParent.get(sourcePipe._id)?.length ?? 0) === 0;
  const toValid = !!destPipe && destPipe.parentId === undefined;
  const disabled =
    (!!group.from && !fromValid) || (!!group.to && !toValid);
  const primaryPipe = sourcePipe || destPipe;
  const firstTx = group.transactions[0];
  const amountFormInitState = primaryPipe
    ? {
        pipeIcon: primaryPipe.icon,
        pipeName: primaryPipe.name,
        title: firstTx.title,
        value: `${firstTx.value}`,
        ...(group.kind === "transfer" && destPipe ? { to: destPipe._id } : {}),
        isFeed: group.kind === "feed",
        transactionId: firstTx._id,
        date: firstTx.date,
      }
    : undefined;

  function handlePress() {
    setShowForm(true);
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
            name={safeIconName(group.kind === "feed" ? destPipe?.icon : sourcePipe?.icon)}
            size={16}
            color={colors.muted}
          />

          {group.kind === "transfer" ? (
            <>
              <Icon
                name={isNegative ? "ray-start-arrow" : "ray-end-arrow"}
                size={14}
                color={colors.muted}
              />
              <Icon name={safeIconName(destPipe?.icon)} size={16} color={colors.muted} />
            </>
          ) : null}

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
            {group.value.toFixed(2)}
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
        {primaryPipe && (
          <AmountForm variant="transaction" pipeId={primaryPipe._id} initState={amountFormInitState} />
        )}
      </ModalShell>
    </>
  );
}
