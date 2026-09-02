import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseMoney } from "@domain/money";
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
import type { AmountFormProps } from "./types";

type SpendMode = "spend" | "transfer";

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

  const showAlert = useAlert();
  const transactionCache = useOptionalTransactionCache();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const contributeToBoiler = useMutation(api.transactions.contributeToBoiler);
  const editTransaction = useMutation(api.transactions.editTransaction);
  const { allPipes } = usePipeCatalog();
  const recentTitles = useQuery(api.transactions.listRecentTitles, { pipeId });

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

  const isValid =
    (isBoiler
      ? boilerContributionAmount === 0 || title.trim() !== ""
      : title.trim() !== "") &&
    isValidAmount &&
    (!isBoiler ||
      (parsedCurrentFed !== null &&
        (boilerContributionAmount > 0 || currentFedChanged))) &&
    (isFeed || spendMode !== "transfer" || sentToPipeId !== null);

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
    () => buildPipeItems(allPipes, pipeId),
    [allPipes, pipeId],
  );
  const paidFromPipeItems = useMemo(
    () => buildPaidFromPipeItems(allPipes, pipeId, isNegative),
    [allPipes, isNegative, pipeId],
  );

  useEffect(() => {
    if (
      allPipes &&
      paidFromPipeId &&
      !paidFromPipeItems.some((item) => item.id === paidFromPipeId)
    ) {
      setPaidFromPipeId(null);
    }
  }, [allPipes, paidFromPipeId, paidFromPipeItems]);

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
        initialStructure,
        spendMode,
        sentToPipeId,
        paidFromPipeId,
      }),
    );
    await transactionCache?.updateTransaction(transaction);
    resetForm();
    onSuccess?.();
  }, [date, editTransaction, initialStructure, initialTransaction?.transactionId, onSuccess, paidFromPipeId, resetForm, sentToPipeId, spendMode, title, transactionCache, value]);

  const handleRepeatSubmit = useCallback(async () => {
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

  return {
    action: {
      icon: buttonIcon,
      isValid,
      label: actionLabel,
      loading,
      style: buttonStyle,
      submit: handleSubmit,
    },
    boiler: isBoiler
      ? {
          contributionAmount: boilerContributionAmount,
          currentFedChanged,
          name: props.boilerName,
          setValue: setCurrentFedValue,
          value: currentFedValue,
        }
      : null,
    common: {
      date,
      loading,
      recentTitles: recentTitles ?? [],
      reset: resetForm,
      setDate,
      setTitle,
      setValue,
      title,
      value,
    },
    isFeed,
    spend: !isFeed && (!isTransaction || intent !== "edit" || canEditStructure)
      ? {
          isNegative,
          mode: spendMode,
          paidFromPipeId,
          paidFromPipeItems,
          pipeItems,
          sentToPipeId,
          setPaidFromPipeId,
          setSentToPipeId,
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
                setValue: setPaidFromPipeId,
                value: paidFromPipeId,
              }
            : null,
        }
      : null,
  };
}
