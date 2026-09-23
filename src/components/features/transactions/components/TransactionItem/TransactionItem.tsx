import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { SwipeActions } from "@ui/SwipeActions";
import { TransactionForm } from '@features/transactions/TransactionForm/TransactionForm';
import { useMemo, useState } from 'react';
import { usePipeCatalog } from '@features/pipes/context/PipeCatalogContext';
import { formatAmount } from "@/lib/format";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { getTransactionItemModel } from "./transactionItem.model";
import { getTransactionDeletionWarning } from "./transactionDeletion.model";
import { useConfirmWithModal } from "@ui/ConfirmModal";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useOptionalTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import { useAlert } from "@ui/Alert";

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
  const { pipesById, childrenByParent, isLoading: isPipeCatalogLoading, isPaidFromEligible } = usePipeCatalog();
  const confirmWithModal = useConfirmWithModal();
  const deleteTransaction = useMutation(api.transactions.deleteTransaction);
  const transactionCache = useOptionalTransactionCache();
  const showAlert = useAlert();

  const [formIntent, setFormIntent] = useState<"repeat" | "edit" | null>(null);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const model = useMemo(
    () => getTransactionItemModel(transaction, { pipesById, childrenByParent, isPaidFromEligible }),
    [transaction, pipesById, childrenByParent, isPaidFromEligible],
  );

  function openForm(intent: "repeat" | "edit") {
    if (model.disabled) {
      setShowDisabledInfo(true);
    } else {
      setFormIntent(intent);
    }
  }

  async function confirmDelete() {
    if (isDeleting || isPipeCatalogLoading) return;
    const warning = getTransactionDeletionWarning(transaction, pipesById ?? {});
    const confirmed = await confirmWithModal({
      title: "Delete transaction?",
      message: (
        <View className="bg-error/10 border border-error rounded-lg p-3">
          <Text className="text-error text-sm leading-5">{warning.message}</Text>
        </View>
      ),
      confirmLabel: "Delete transaction",
      destructive: true,
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteTransaction({ transactionId: transaction.id });
    } catch (error) {
      showAlert.error(`${error}`);
      setIsDeleting(false);
      return;
    }

    try {
      await transactionCache?.reconcileTransactions([transaction.id], []);
    } catch {
      try {
        await transactionCache?.invalidateAll();
      } catch {
        // The server deletion succeeded; the next cache refresh remains authoritative.
      }
    }
    showAlert.success("Transaction deleted");
    setIsDeleting(false);
  }

  return (
    <View className="flex-row gap-1 items-center">
      <SwipeActions
        leftAction={{
          accessibilityLabel: `Delete ${transaction.title}`,
          content: <Icon name="trash-outline" size={20} color={colors.text} />,
          backgroundClassName: "bg-error",
          disabled: isDeleting || isPipeCatalogLoading,
          onActivate: () => void confirmDelete(),
        }}
        rightAction={!model.disabled ? {
          accessibilityLabel: `Edit ${transaction.title}`,
          content: <Icon name="pencil-outline" size={20} color={colors.text} />,
          backgroundClassName: "bg-secondary",
          onActivate: () => openForm("edit"),
        } : undefined}
      >
        <Pressable
          className={cn(
            "w-full flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
            model.bgClass,
          )}
          onPress={() => openForm("repeat")}
        >
          {model.uiIcons.map((icon, index) => (<Icon key={index} name={icon.name} size={icon.size} color={icon.color} />))}

          <Text
            className={cn(
              "font-bold text-sm flex-1 ml-0.5",
              model.disabled ? "text-muted" : "text-text",
            )}
            numberOfLines={1}
          >
            {transaction.title.charAt(0).toUpperCase() + transaction.title.slice(1)}
          </Text>
          <Text className={cn("text-xs mr-4", model.disabled ? "text-muted" : "text-white")}>
            {new Date(transaction.date).toLocaleDateString("en-US", DATE_FORMAT)}
          </Text>
          <Text
            className={cn(
              "text-sm font-bold w-16 mr-2 text-right",
              model.disabled ? "text-muted" : "text-white",
            )}
          >
            {formatAmount(transaction.value)}
          </Text>
        </Pressable>
      </SwipeActions>

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

      <ModalShell visible={formIntent !== null} onClose={() => setFormIntent(null)}>
        {formIntent && model.primaryPipeId && model.formInitState ? (
          <TransactionForm
            pipeId={model.primaryPipeId}
            initState={{ ...model.formInitState, intent: formIntent }}
            onSuccess={() => setFormIntent(null)}
          />
        ) : null}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            {model.viewOnly
              ? "This is preserved history from a deleted pipe. Preserved history is view-only."
              : "This transaction was from a pipe that does not exist or cannot accept transactions anymore (probably due to now having children pipes)."}
          </Text>
        </View>
      </ModalShell>
    </View>
  );
}
