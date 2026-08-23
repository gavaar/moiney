import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from '@features/components/AmountForm';
import { useState } from 'react';
import { usePipeCatalog } from '@features/pipes/context/PipeCatalogContext';
import { resolveTransactionKind } from "@domain/transactions";
import { formatAmount } from "@/lib/format";
import type { TransactionModel } from "@features/transactions/data/transactions";

type TransactionItemProps = {
  transaction: TransactionModel;
  onShowEditHistory?: (transactionId: TransactionModel["id"]) => void;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function TransactionItem({ transaction, onShowEditHistory }: TransactionItemProps) {
  const kind = resolveTransactionKind(transaction);
  const isFeed = kind === "feed";
  const isTransfer = kind === "transfer";
  const isPayByTransfer = kind === "expense" && !!transaction.paidFrom;
  const isNegative = transaction.value < 0;
  const [showForm, setShowForm] = useState(false);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const { pipesById, childrenByParent } = usePipeCatalog();

  const sourcePipe = transaction.from ? pipesById?.[transaction.from] : undefined;
  const destPipe = transaction.to ? pipesById?.[transaction.to] : undefined;
  const paidFromPipe = transaction.paidFrom ? pipesById?.[transaction.paidFrom] : undefined;
  const fromValid =
    !!sourcePipe &&
    !sourcePipe.deletionJobId &&
    (childrenByParent.get(sourcePipe.id)?.length ?? 0) === 0;
  const toValid = !!destPipe && !destPipe.deletionJobId && destPipe.parentId === undefined;
  const paidFromValid =
    !!paidFromPipe &&
    !paidFromPipe.deletionJobId &&
    (childrenByParent.get(paidFromPipe.id)?.length ?? 0) === 0;
  const viewOnly = !!transaction.fromIcon || !!transaction.toIcon || !!transaction.paidFromIcon;
  const icons = {
    from: {
      name: sourcePipe?.icon ?? transaction.fromIcon ?? "pipe-disconnected",
      color: sourcePipe || transaction.fromIcon ? colors.muted : colors.surface,
    },
    to: {
      name: destPipe?.icon ?? transaction.toIcon ?? "pipe-disconnected",
      color: destPipe || transaction.toIcon ? colors.muted : colors.surface,
    },
    paidFrom: {
      name: paidFromPipe?.icon ?? transaction.paidFromIcon ?? "pipe-disconnected",
      color: paidFromPipe || transaction.paidFromIcon ? colors.muted : colors.surface,
    },
  };
  const disabled =
    viewOnly ||
    (!!transaction.from && !fromValid) ||
    (!!transaction.to && !toValid) ||
    (!!transaction.paidFrom && !paidFromValid);
  const primaryPipe = isFeed ? destPipe : sourcePipe;
  const bgClass = isFeed
    ? "bg-secondary/30"
    : isTransfer
      ? "bg-accent/30"
      : isNegative
        ? "bg-error/30"
        : isPayByTransfer
          ? "bg-success/30"
          : "bg-primary/30";
  const amountFormInitState = primaryPipe && !viewOnly ? {
    pipeIcon: primaryPipe.icon,
    pipeName: primaryPipe.name,
    title: transaction.title,
    value: formatAmount(transaction.value),
    ...(isTransfer && destPipe ? { to: destPipe.id } : {}),
    ...(isPayByTransfer && paidFromPipe ? { paidFrom: paidFromPipe.id } : {}),
    isFeed,
    transactionId: transaction.id,
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
    <View className="flex-row gap-1 items-center">
      <Pressable
        className={cn(
          "flex-1 flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
          bgClass,
        )}
        onPress={handlePress}
      >
        <Icon
          name={safeIconName(isFeed ? icons.to.name : isPayByTransfer ? icons.paidFrom.name : icons.from.name)}
          size={16}
          color={isFeed ? icons.to.color : isPayByTransfer ? icons.paidFrom.color : icons.from.color}
        />

        {isTransfer || isPayByTransfer ? (
          <>
            <Icon name={isNegative ? "ray-start-arrow" : "ray-end-arrow"} size={14} color={colors.muted} />
            <Icon
              name={safeIconName(isPayByTransfer ? icons.from.name : icons.to.name)}
              size={16}
              color={isPayByTransfer ? icons.from.color : icons.to.color}
            />
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
          {formatAmount(transaction.value)}
        </Text>
      </Pressable>

      {transaction.editedAt && onShowEditHistory ? (
        <Pressable
          testID="transaction-edit-history"
          className="items-center justify-center rounded-2xl border border-border bg-surface px-2"
          accessibilityRole="button"
          accessibilityLabel={`View edit history for ${transaction.title}`}
          onPress={() => onShowEditHistory(transaction.id)}
        >
          <Icon name="history" size={15} color={colors.muted} />
          <Text className="text-muted text-[10px]">Edited</Text>
        </Pressable>
      ) : null}

      <ModalShell visible={showForm} onClose={() => setShowForm(false)}>
        {primaryPipe && <AmountForm variant="transaction" pipeId={primaryPipe.id} initState={amountFormInitState} />}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            {viewOnly
              ? "This is preserved history from a deleted pipe. Preserved history is view-only."
              : "This transaction was from a pipe that does not exist or cannot accept transactions anymore (probably due to now having children pipes)."}
          </Text>
        </View>
      </ModalShell>
    </View>
  );
}
