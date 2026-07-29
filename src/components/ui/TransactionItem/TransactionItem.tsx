import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import type { Doc } from "@convex/_generated/dataModel";
import { ModalShell } from '../Modal';
import { AmountForm } from '@features/components/AmountForm';
import { useState } from 'react';
import { usePipeSelection } from '@features/pipes/context/PipeSelectionContext';

type TransactionItemProps = {
  transaction: Doc<"transactions">;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isFeed = !transaction.from && !!transaction.to;
  const isTransfer = !!transaction.from && !!transaction.to;
  const isDrain = !!transaction.from && !transaction.to;
  const isNegative = transaction.value < 0;
  const [showForm, setShowForm] = useState(false);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const { pipesById, childrenByParent } = usePipeSelection();

  const sourcePipe = transaction.from ? pipesById?.[transaction.from] : undefined;
  const destPipe = transaction.to ? pipesById?.[transaction.to] : undefined;
  const fromValid = !!sourcePipe && (childrenByParent.get(sourcePipe._id)?.length ?? 0) === 0;
  const toValid = !!destPipe && destPipe.parentId === undefined;
  const disabled = (!!transaction.from && !fromValid) || (!!transaction.to && !toValid);
  const primaryPipe = isFeed ? destPipe : sourcePipe;
  const bgClass = isFeed ? "bg-secondary/30" : isTransfer ? "bg-accent/30" : isNegative ? "bg-error/30" : "bg-primary/30";
  const amountFormInitState = primaryPipe ? {
    pipeIcon: primaryPipe.icon,
    pipeName: primaryPipe.name,
    title: transaction.title,
    value: `${transaction.value}`,
    ...(isTransfer && destPipe ? { to: destPipe._id } : {}),
    isFeed,
    transactionId: transaction._id,
    date: transaction.date,
  } : undefined;

  function handlePress() {
    if (disabled) {
      setShowDisabledInfo(true);
    } else {
      setShowForm(true);
    }
  }

  return (
    <Pressable
      className={cn(
        "flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
        bgClass,
      )}
      onPress={handlePress}
    >
      <Icon name={safeIconName(isFeed ? destPipe?.icon : sourcePipe?.icon)} size={16} color={colors.muted} />

      {isTransfer ? (
        <>
          <Icon name={isNegative ? "ray-start-arrow" : "ray-end-arrow"} size={14} color={colors.muted} />
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
        {transaction.title.charAt(0).toUpperCase() + transaction.title.slice(1)}
      </Text>
      <Text className={cn("text-xs mr-4", disabled ? "text-muted" : "text-white")}>
        {new Date(transaction.date).toLocaleDateString("en-US", DATE_FORMAT)}
      </Text>
      <Text
        className={cn(
          "text-sm font-bold w-16 mr-2 text-right",
          disabled ? "text-muted" : "text-white",
        )}
      >
        {transaction.value.toFixed(2)}
      </Text>

      <ModalShell visible={showForm} closeOnBackdropPress={true} onClose={() => setShowForm(false)}>
        {primaryPipe && <AmountForm variant="transaction" pipeId={primaryPipe._id} initState={amountFormInitState} />}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} closeOnBackdropPress={true} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            This transaction was from a pipe that does not exist or cannot accept transactions anymore
            (probably due to now having child pipes).
          </Text>
        </View>
      </ModalShell>
    </Pressable>
  );
}
