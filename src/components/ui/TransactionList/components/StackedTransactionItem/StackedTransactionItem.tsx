import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from "@features/components/AmountForm";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { Id } from '@convex/_generated/dataModel';

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

enum TransactionType {
  Feed = "feed",
  Transfer = "transfer",
  Drain = "drain",
}

function transactionType({ from, to }: { from?: Id<"pipes">; to?: Id<"pipes">}): TransactionType {
  if (from && to) return TransactionType.Transfer;
  if (from) return TransactionType.Drain;
  return TransactionType.Feed;
}

export function StackedTransactionItem({
  group,
  expanded,
  onToggle,
}: StackedTransactionItemProps) {
  const type = useMemo(() => {
    return transactionType({ from: group.from, to: group.to });
  }, [TransactionType, group]);
  const isNegative = group.value < 0;
  const [showForm, setShowForm] = useState(false);
  const longPressedRef = useRef(false);
  const { pipesById, childrenByParent } = usePipeSelection();
  const bgClass = useMemo(() => {
    switch(type) {
      case TransactionType.Feed:
        return "bg-secondary/30";
      case TransactionType.Transfer:
        return "bg-accent/30";
      case TransactionType.Drain:
        return isNegative ? "bg-error/30" : "bg-primary/30";
    }
  }, [type, isNegative]);

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
        ...(type === TransactionType.Transfer && destPipe ? { to: destPipe._id } : {}),
        isFeed: type === TransactionType.Feed,
        transactionId: firstTx._id,
        date: firstTx.date,
      }
    : undefined;

  function handlePress() {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    if (expanded) {
      onToggle();
    } else {
      setShowForm(true);
    }
  }

  function handleLongPress() {
    if (expanded) return;
    longPressedRef.current = true;
    onToggle();
  }

  return (
    <>
      <Pressable
        className={cn(
          "flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
          bgClass,
          expanded && "opacity-50",
        )}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <Icon
          name={safeIconName(type === TransactionType.Feed ? destPipe?.icon : sourcePipe?.icon)}
          size={16}
          color={colors.muted}
        />

        {type === TransactionType.Transfer ? (
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
          <View className="rounded-full min-w-[20px] h-5 items-center justify-center px-1.5 border border-muted mr-1">
            <Text className="text-muted text-xs font-bold">x{group.count}</Text>
          </View>
          <Text
            className={cn("text-xs", disabled ? "text-muted" : "text-white")}
          >
            {formatDateRange(group.oldestDate, group.latestDate)}
          </Text>
        </View>

        <Text
          className={cn(
            "text-sm font-bold w-16 text-right mr-2",
            disabled ? "text-muted" : "text-white",
          )}
        >
          {group.value.toFixed(2)}
        </Text>
      </Pressable>

      <ModalShell visible={showForm} closeOnBackdropPress={true} onClose={() => setShowForm(false)}>
        {primaryPipe && (
          <AmountForm variant="transaction" pipeId={primaryPipe._id} initState={amountFormInitState} />
        )}
      </ModalShell>
    </>
  );
}
