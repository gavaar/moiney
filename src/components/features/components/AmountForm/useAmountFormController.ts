import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseMoney } from "@domain/money";
import { planTransactionEdit, type TransactionStructure } from "@domain/transactions";
import { formatAmount } from "@/lib/format";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useOptionalTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import {
  buildCreateTransactionCommand,
  buildEditTransactionCommand,
  buildPaidFromPipeItems,
  buildPipeItems,
  getButtonIcon,
  getButtonLabel,
  getButtonStyle,
  getDestinationPipeName,
  getIntentDate,
  transitionSpendMode,
} from "./helpers";
import type { AmountFormDraft, AmountFormProps } from "./types";
import type { PipeModel } from "@features/pipes/data/pipes";

type SpendMode = "spend" | "transfer";
const EMPTY_PIPES_BY_ID: Readonly<Record<string, PipeModel>> = {};

export function useAmountFormController(props: AmountFormProps) {
  const { pipeId, onSuccess } = props;
  const variant = props.variant ?? "spend";
  const isBoiler = variant === "boiler";
  const isTransaction = variant === "transaction";
  const initialTransaction =
    props.variant === "transaction" ? props.initState : undefined;
  const currentFed = props.variant === "boiler" ? props.currentFed : 0;
  const initialStructure = initialTransaction?.structure;
  const intent = initialTransaction?.intent ?? "repeat";

  const [title, setTitle] = useState(initialTransaction?.title ?? "");
  const [value, setValue] = useState(
    initialTransaction?.value ?? (isBoiler ? "0" : variant === "feed" ? "" : "-"),
  );
  const initialCurrentFedValue = (currentFed / 100).toFixed(2);
  const [currentFedValue, setCurrentFedValue] = useState(initialCurrentFedValue);
  const [date, setDate] = useState(
    () => getIntentDate(intent, initialTransaction?.date, new Date()) ?? new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [sentToPipeId, setSentToPipeId] = useState<Id<"pipes"> | null>(
    initialStructure?.type === "transfer" ? initialStructure.to : null,
  );
  const [paidFromPipeId, setPaidFromPipeId] = useState<Id<"pipes"> | null>(
    initialStructure?.type === "payByTransfer"
      ? initialStructure.paidFrom
      : null,
  );
  const [showPaidFrom, setShowPaidFrom] = useState(
    initialStructure?.type === "payByTransfer",
  );
  const [spendMode, setSpendMode] = useState<SpendMode>(
    initialStructure?.type === "transfer" ? "transfer" : "spend",
  );
  const [applyReplacementEffects, setApplyReplacementEffects] = useState(false);

  const showAlert = useAlert();
  const transactionCache = useOptionalTransactionCache();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const contributeToBoiler = useMutation(api.transactions.contributeToBoiler);
  const editTransaction = useMutation(api.transactions.editTransaction);
  const { allPipes, pipesById: catalogById } = usePipeCatalog();
  const pipesById: Readonly<Record<string, PipeModel>> = catalogById ?? EMPTY_PIPES_BY_ID;
  const recentTitles = useQuery(api.transactions.listRecentTitles, pipeId ? { pipeId } : "skip");

  const isFeed =
    variant === "feed" ||
    isBoiler ||
    initialStructure?.type === "feed";
  const canEditStructure =
    initialStructure?.type === "expense" ||
    initialStructure?.type === "transfer";

  const isValidAmount = useMemo(() => {
    if (value === "" || value === "-") return false;
    try {
      const amount = parseMoney(value);
      return isBoiler ? amount >= 0 : isFeed ? amount > 0 : amount !== 0;
    } catch {
      return false;
    }
  }, [isBoiler, isFeed, value]);

  const parsedCurrentFed = useMemo(() => {
    if (!isBoiler || currentFedValue === "" || currentFedValue === "-") {
      return null;
    }
    try {
      return parseMoney(currentFedValue);
    } catch {
      return null;
    }
  }, [currentFedValue, isBoiler]);
  const currentFedChanged = parsedCurrentFed !== null && parsedCurrentFed !== currentFed;
  const boilerContributionAmount = isBoiler && isValidAmount ? parseMoney(value) : 0;

  const isValid = !!pipeId &&
    (isBoiler
      ? boilerContributionAmount === 0 || title.trim() !== ""
      : title.trim() !== "") &&
    isValidAmount &&
    (!isBoiler ||
      (parsedCurrentFed !== null &&
        (boilerContributionAmount > 0 || currentFedChanged))) &&
    (isFeed || spendMode !== "transfer" || sentToPipeId !== null) &&
    (initialStructure?.type !== "payByTransfer" || intent !== "edit" || paidFromPipeId !== null);

  const isNegative = value.startsWith("-");
  const buttonStyle = getButtonStyle(intent, isNegative);
  const buttonIcon = getButtonIcon(intent, isFeed, spendMode);

  const handleModeChange = useCallback(
    (newMode: string) => {
      const nextState = transitionSpendMode(
        { spendMode, sentToPipeId, paidFromPipeId, showPaidFrom },
        newMode as SpendMode,
      );
      setSpendMode(nextState.spendMode);
      setSentToPipeId(nextState.sentToPipeId);
      setPaidFromPipeId(nextState.paidFromPipeId);
      setShowPaidFrom(nextState.showPaidFrom);
    },
    [paidFromPipeId, sentToPipeId, showPaidFrom, spendMode],
  );

  const pipeItems = useMemo(
    () => pipeId ? buildPipeItems(allPipes, pipeId) : [],
    [allPipes, pipeId],
  );
  const paidFromPipeItems = useMemo(
    () => pipeId ? buildPaidFromPipeItems(allPipes, pipeId, isNegative) : [],
    [allPipes, isNegative, pipeId],
  );

  const invalidPreviousPipeIds = useMemo(() => {
    if (intent !== "edit" || !initialStructure || !allPipes) return [];
    const roles = initialStructure as { from?: Id<"pipes">; to?: Id<"pipes">; paidFrom?: Id<"pipes"> };
    return (["from", "to", "paidFrom"] as const).flatMap(role => {
      const id = roles[role];
      if (!id) return [];
      const pipe = pipesById[id];
      const hasChildren = (idToCheck: Id<"pipes">) => allPipes.some(item => item.parentId === idToCheck);
      const invalid = !pipe || !!pipe.deletionJobId ||
        (role === "from" && hasChildren(id)) ||
        (role === "to" && initialStructure.type === "transfer" && !!pipe.parentId) ||
        (role === "paidFrom" && ((initialTransaction?.value ?? "-").startsWith("-") ? hasChildren(id) : !!pipe.parentId));
      return invalid ? [id] : [];
    });
  }, [allPipes, initialStructure, initialTransaction?.value, intent, pipesById]);

  const editWarning = useMemo(() => {
    if (intent !== "edit" || !initialStructure || !pipeId || !isValidAmount) return null;
    const originalPrimary = initialStructure.type === "feed" ? initialStructure.to : initialStructure.from;
    if (invalidPreviousPipeIds.length === 0 && originalPrimary === pipeId &&
      (initialStructure.type !== "transfer" || initialStructure.to === sentToPipeId) &&
      (initialStructure.type !== "payByTransfer" || initialStructure.paidFrom === paidFromPipeId)) return null;
    const next: TransactionStructure<Id<"pipes">> = isFeed
      ? { type: "feed", to: pipeId }
      : spendMode === "transfer" && sentToPipeId
        ? { type: "transfer", from: pipeId, to: sentToPipeId }
        : paidFromPipeId
          ? { type: "payByTransfer", from: pipeId, paidFrom: paidFromPipeId }
          : { type: "expense", from: pipeId };
    const plan = planTransactionEdit(initialStructure, parseMoney(initialTransaction?.value ?? "0"), next, parseMoney(value), {
      invalidPreviousPipeIds, applyReplacementEffects,
    });
    const lines = plan.deltas.map(delta => {
      const pipe = pipesById[delta.pipeId];
      const fields = [
        ["fed", delta.fedDelta], ["spent", delta.spentDelta],
        ["pending", delta.pendingFedAdjustmentDelta], ["contributed", pipe?.sourceType === "boiler" ? delta.contributedFedDelta : 0],
      ] as const;
      return `${pipe?.name ?? initialTransaction?.pipeName ?? "Previous pipe"}: ${fields.filter(([, amount]) => amount !== 0).map(([field, amount]) => `${field} ${amount > 0 ? "+" : ""}${formatAmount(amount)}`).join(", ")}`;
    });
    if (invalidPreviousPipeIds.length) {
      lines.push(applyReplacementEffects
        ? "Replacement pipes receive the transaction effect. Invalid original pipes are not reversed."
        : "Replacement pipes receive no accounting update. Invalid original pipes are not reversed.");
    }
    lines.push("Rules may run; final balances can differ.");
    return lines;
  }, [applyReplacementEffects, initialStructure, initialTransaction?.pipeName, initialTransaction?.value, invalidPreviousPipeIds, intent, isFeed, isValidAmount, paidFromPipeId, pipeId, pipesById, sentToPipeId, spendMode, value]);

  useEffect(() => {
    if (
      allPipes && pipeId &&
      paidFromPipeId &&
      !paidFromPipeItems.some((item) => item.id === paidFromPipeId)
    ) {
      setPaidFromPipeId(null);
    }
  }, [allPipes, paidFromPipeId, paidFromPipeItems, pipeId]);

  useEffect(() => {
    if (allPipes && pipeId && sentToPipeId && !pipeItems.some(item => item.id === sentToPipeId)) setSentToPipeId(null);
  }, [allPipes, pipeId, sentToPipeId, pipeItems]);

  const destinationPipeName = getDestinationPipeName(allPipes, sentToPipeId);
  const actionLabel =
    intent === "edit"
      ? "Update transaction"
      : getButtonLabel(
          isFeed ? "feed" : "spend",
          isNegative,
          destinationPipeName,
        );

  const resetForm = useCallback(() => {
    setTitle("");
    setValue(isBoiler ? "0" : isFeed ? "" : "-");
    setCurrentFedValue(initialCurrentFedValue);
    setDate(new Date());
    setSentToPipeId(null);
    setPaidFromPipeId(null);
    setShowPaidFrom(false);
    setSpendMode("spend");
  }, [initialCurrentFedValue, isBoiler, isFeed]);

  const handleEditSubmit = useCallback(async () => {
    if (!initialTransaction?.transactionId) return;
    const transaction = await editTransaction(
      buildEditTransactionCommand({
        transactionId: initialTransaction.transactionId,
        title,
        amount: parseMoney(value),
        date: date.getTime(),
        primaryPipeId: pipeId,
        originalPrimaryPipeId: initialStructure?.type === "feed" ? initialStructure.to : initialStructure?.from,
        applyReplacementEffects: invalidPreviousPipeIds.length ? applyReplacementEffects : undefined,
        initialStructure,
        spendMode,
        sentToPipeId,
        paidFromPipeId,
      }),
    );
    await transactionCache?.updateTransaction(transaction);
    resetForm();
    onSuccess?.();
  }, [applyReplacementEffects, date, editTransaction, initialStructure, initialTransaction, invalidPreviousPipeIds, onSuccess, paidFromPipeId, pipeId, resetForm, sentToPipeId, spendMode, title, transactionCache, value]);

  const handleRepeatSubmit = useCallback(async () => {
    if (!pipeId) return;
    const amount = parseMoney(value);
    if (isBoiler) {
      const transaction = await contributeToBoiler({
        pipeId,
        title: title.trim(),
        value: amount,
        date: date.getTime(),
        ...(currentFedChanged && parsedCurrentFed !== null
          ? { currentFed: parsedCurrentFed }
          : {}),
      });
      if (transaction) await transactionCache?.addTransaction(transaction);
      resetForm();
      onSuccess?.();
      return;
    }
    const transaction = await createTransaction(
      buildCreateTransactionCommand({
        title,
        amount,
        date: date.getTime(),
        pipeId,
        isFeed,
        spendMode,
        sentToPipeId,
        paidFromPipeId,
      }),
    );
    await transactionCache?.addTransaction(transaction);
    resetForm();
    onSuccess?.();
  }, [contributeToBoiler, createTransaction, currentFedChanged, date, isBoiler, isFeed, onSuccess, paidFromPipeId, parsedCurrentFed, pipeId, resetForm, sentToPipeId, spendMode, title, transactionCache, value]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      if (intent === "edit") await handleEditSubmit();
      else await handleRepeatSubmit();
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [handleEditSubmit, handleRepeatSubmit, intent, isValid, loading, showAlert]);

  const draft: AmountFormDraft = {
    sourcePipeId: pipeId, title, value, date, currentFed: currentFedValue,
    sentTo: sentToPipeId, paidFrom: paidFromPipeId,
  };

  function updateDraft(next: Partial<AmountFormDraft>) {
    if (next.title !== undefined) setTitle(next.title);
    if (next.value !== undefined) setValue(next.value);
    if (next.date !== undefined) setDate(next.date);
    if (next.currentFed !== undefined) setCurrentFedValue(next.currentFed);
    if (next.sentTo !== undefined) setSentToPipeId(next.sentTo ? pipesById[next.sentTo]?.id ?? null : null);
    if (next.paidFrom !== undefined) setPaidFromPipeId(next.paidFrom ? pipesById[next.paidFrom]?.id ?? null : null);
  }

  return {
    pipesById,
    draft,
    updateDraft,
    action: {
      icon: buttonIcon,
      isValid,
      label: actionLabel,
      loading,
      style: buttonStyle,
      submit: handleSubmit,
    },
    editWarning,
    replacementChoice: intent === "edit" && invalidPreviousPipeIds.length > 0
      ? { value: applyReplacementEffects, onChange: setApplyReplacementEffects }
      : null,
    boiler: props.variant === "boiler"
      ? {
          contributionAmount: boilerContributionAmount,
          currentFedChanged,
          name: props.boilerName,
        }
      : null,
    common: {
      loading,
      recentTitles: recentTitles ?? [],
      reset: resetForm,
    },
    isFeed,
    spend: !isFeed && (!isTransaction || intent !== "edit" || canEditStructure)
      ? {
          isNegative,
          mode: spendMode,
          paidFromPipeItems,
          pipeItems,
          setShowPaidFrom,
          showPaidFrom,
          updateMode: handleModeChange,
        }
      : null,
    transaction: initialTransaction
      ? {
          initial: initialTransaction,
          intent,
          paidFrom:
            intent === "edit" && initialStructure?.type === "payByTransfer"
            ? {
                items: paidFromPipeItems,
                label: isNegative ? "Paid from" : "Refunded to",
              }
            : null,
        }
      : null,
  };
}
