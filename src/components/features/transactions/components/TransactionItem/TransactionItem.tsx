import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { SwipeActions } from "@ui/SwipeActions";
import { TransactionForm } from '@features/transactions/TransactionForm/TransactionForm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePipeCatalog } from '@features/pipes/context/PipeCatalogContext';
import { formatAmount } from "@/lib/format";
import type { TransactionModel, TransactionPresentation } from "@features/transactions/data/transactions";
import { getTransactionItemModel, getTransactionItemPresentation } from "./transactionItem.model";
import { getTransactionDeletionWarning } from "./transactionDeletion.model";
import { useConfirmWithModal } from "@ui/ConfirmModal";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useOptionalEventHistoryCache } from "@features/transactions/cache/EventHistoryCacheContext";
import { useAlert } from "@ui/Alert";

type TransactionItemProps = ({ transaction: TransactionModel; resolveTransaction?: never } |
  { transaction: TransactionPresentation; resolveTransaction: () => Promise<TransactionModel | null> }) & {
  onShowEditHistory?: () => void;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};
export function TransactionItem({ transaction, resolveTransaction, onShowEditHistory }: TransactionItemProps) {
  const { pipesById, childrenByParent, isLoading: isPipeCatalogLoading, isPaidFromEligible } = usePipeCatalog();
  const confirmWithModal = useConfirmWithModal();
  const deleteTransaction = useMutation(api.financialOperations.remove);
  const historyCache = useOptionalEventHistoryCache();
  const showAlert = useAlert();

  const [formIntent, setFormIntent] = useState<"repeat" | "edit" | null>(null);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionTransaction, setActionTransaction] = useState<TransactionModel | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const catalog = { pipesById, childrenByParent, isPaidFromEligible };

  const model = useMemo(
    () => getTransactionItemPresentation(transaction, { pipesById, childrenByParent, isPaidFromEligible }),
    [transaction, pipesById, childrenByParent, isPaidFromEligible],
  );

  function withTransaction(action: (row: TransactionModel) => void | Promise<void>) {
    if (isPipeCatalogLoading || pending.current) return;
    if ("id" in transaction) { void action(transaction); return; }
    if (!resolveTransaction) return;
    pending.current = true;
    setIsResolving(true);
    void resolveTransaction().then(async row => {
      if (!active.current) return;
      if (!row) { showAlert.error("Transaction is no longer available. Pull to refresh."); return; }
      await action(row);
    }).catch(error => { if (active.current) showAlert.error(`${error}`); }).finally(() => {
      pending.current = false;
      if (active.current) setIsResolving(false);
    });
  }

  function openForm(intent: "repeat" | "edit", row: TransactionModel) {
    const current = getTransactionItemModel(row, catalog);
    if (isPipeCatalogLoading || (intent === "edit" ? !current.canEdit : current.disabled)) {
      setShowDisabledInfo(true);
    } else {
      setActionTransaction(row);
      setFormIntent(intent);
    }
  }

  async function confirmDelete(row: TransactionModel) {
    if (isDeleting || isPipeCatalogLoading) return;
    const warning = getTransactionDeletionWarning(row, pipesById ?? {});
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
      await deleteTransaction({ operationId: row.id });
    } catch (error) {
      showAlert.error(`${error}`);
      setIsDeleting(false);
      return;
    }

    try {
      await historyCache?.invalidateHistory();
    } catch {
      // The server deletion succeeded; the next history refresh remains authoritative.
    }
    showAlert.success("Transaction deleted");
    setIsDeleting(false);
  }

  const formModel = actionTransaction ? getTransactionItemModel(actionTransaction, catalog) : null;

  return (
    <View className="flex-row gap-1 items-center">
      <SwipeActions
        leftAction={{
          accessibilityLabel: `Delete ${transaction.title}`,
          content: <Icon name="trash-outline" size={20} color={colors.text} />,
          backgroundClassName: "bg-error",
          disabled: isDeleting || isResolving || isPipeCatalogLoading,
          onActivate: () => withTransaction(confirmDelete),
        }}
        rightAction={model.canEdit && !isPipeCatalogLoading ? {
          accessibilityLabel: `Edit ${transaction.title}`,
          content: <Icon name="pencil-outline" size={20} color={colors.text} />,
          backgroundClassName: "bg-secondary",
          disabled: isResolving,
          onActivate: () => withTransaction(row => openForm("edit", row)),
        } : undefined}
      >
        <Pressable
          className={cn(
            "w-full flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
            model.bgClass,
          )}
          disabled={isResolving}
          onPress={() => withTransaction(row => openForm("repeat", row))}
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

      {onShowEditHistory && transaction.editedAt ? (
        <Pressable
          testID="transaction-edit-history"
          className="items-center justify-center rounded-2xl border border-border bg-surface px-2"
          accessibilityRole="button"
          accessibilityLabel={`View edit history for ${transaction.title}`}
          disabled={isResolving}
          onPress={onShowEditHistory}
        >
          <Icon name="history" size={15} color={colors.muted} />
          <Text className="text-muted text-[10px]">Edited</Text>
        </Pressable>
      ) : null}

      <ModalShell visible={formIntent !== null} onClose={() => setFormIntent(null)}>
        {formIntent && formModel ? (
          <TransactionForm
            pipeId={formModel.primaryPipeId}
            initState={{ ...formModel.formInitState, intent: formIntent }}
            onSuccess={() => setFormIntent(null)}
          />
        ) : null}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            {model.viewOnly
              ? "This is preserved history from a deleted pipe. Select valid pipes to edit it."
              : "This transaction was from a pipe that does not exist or cannot accept transactions anymore (probably due to now having children pipes)."}
          </Text>
        </View>
      </ModalShell>
    </View>
  );
}
