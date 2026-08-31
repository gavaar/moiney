import { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { SlideToggle } from "@ui/SlideToggle";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useOptionalTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import { parseMoney } from "@domain/money";
import { formatAmount } from "@/lib/format";
import {
  buildCreateTransactionCommand,
  buildEditTransactionCommand,
  buildPipeItems,
  buildPaidFromPipeItems,
  getButtonIcon,
  getButtonLabel,
  getButtonStyle,
  getDestinationPipeName,
  getIntentDate,
  transitionSpendMode,
} from "./helpers";

type SpentMode = "spend" | "transfer";

type Props = {
  pipeId: Id<"pipes">;
  variant?: "feed" | "boiler" | "spend" | "transaction";
  boilerName?: string;
  currentFed?: number;
  initState?: {
    pipeIcon: string;
    pipeName: string;
    title: string;
    value: string;
    to?: Id<"pipes">;
    paidFrom?: Id<"pipes">;
    isFeed?: boolean;
    transactionId?: Id<"transactions">;
    date?: number;
  };
  onSuccess?: () => void;
};

export function AmountForm({
  pipeId,
  variant = "spend",
  boilerName,
  currentFed = 0,
  initState,
  onSuccess,
}: Props) {
  const isBoiler = variant === "boiler";
  const [title, setTitle] = useState(initState?.title ?? "");
  const [value, setValue] = useState(initState?.value ?? (isBoiler ? "0" : variant === "feed" ? "" : "-"));
  const initialCurrentFedValue = (currentFed / 100).toFixed(2);
  const [currentFedValue, setCurrentFedValue] = useState(initialCurrentFedValue);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [sentToPipeId, setSentToPipeId] = useState<Id<"pipes"> | null>(
    initState?.to ?? null,
  );
  const [paidFromPipeId, setPaidFromPipeId] = useState<Id<"pipes"> | null>(
    initState?.paidFrom ?? null,
  );
  const [showPaidFrom, setShowPaidFrom] = useState(Boolean(initState?.paidFrom));
  const [spendMode, setSpendMode] = useState<SpentMode>(
    initState?.to ? "transfer" : "spend",
  );
  const [intent, setIntent] = useState<"repeat" | "edit">("repeat");

  const showAlert = useAlert();
  const transactionCache = useOptionalTransactionCache();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const contributeToBoiler = useMutation(
    api.transactions.contributeToBoiler,
  );
  const { allPipes } = usePipeCatalog();
  const recentTitles = useQuery(api.transactions.listRecentTitles, { pipeId });

  const isFeed =
    variant === "feed" ||
    isBoiler ||
    (variant === "transaction" && initState?.isFeed === true);
  const isTransactionVariant = variant === "transaction";

  const isValidAmount = useMemo(() => {
    if (value === "" || value === "-") return false;
    try {
      const amount = parseMoney(value);
      return isBoiler ? amount >= 0 : isFeed ? amount > 0 : amount !== 0;
    } catch {
      return false;
    }
  }, [value, isBoiler, isFeed]);

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
  const boilerContributionAmount =
    isBoiler && isValidAmount ? parseMoney(value) : 0;

  const isValid =
    (isBoiler
      ? boilerContributionAmount === 0 || title.trim() !== ""
      : title.trim() !== "") &&
    isValidAmount &&
    (!isBoiler ||
      (parsedCurrentFed !== null &&
        (boilerContributionAmount > 0 || currentFedChanged))) &&
    (isFeed || isTransactionVariant || spendMode !== "transfer" || sentToPipeId !== null);

  const isNegative = value.startsWith("-");

  const buttonStyle = useMemo(() => getButtonStyle(intent, isNegative), [intent, isNegative]);
  const buttonIcon = useMemo(() => getButtonIcon(intent, isFeed, spendMode), [intent, isFeed, spendMode]);

  const renderPipeItem = useCallback(
    (item: any) => (
      <View className="flex-row items-center gap-2">
        <Icon name={item.icon as IconName} size={16} color={colors.text} />
        <Text className="text-text">{item.name}</Text>
      </View>
    ),
    [],
  );

  const handleModeChange = useCallback((newMode: string) => {
    const nextState = transitionSpendMode(
      {
        spendMode,
        sentToPipeId,
        paidFromPipeId,
        showPaidFrom,
      },
      newMode as SpentMode,
    );
    setSpendMode(nextState.spendMode);
    setSentToPipeId(nextState.sentToPipeId);
    setPaidFromPipeId(nextState.paidFromPipeId);
    setShowPaidFrom(nextState.showPaidFrom);
  }, [paidFromPipeId, sentToPipeId, showPaidFrom, spendMode]);

  const handleIntentChange = useCallback((newIntent: string) => {
    const intentValue = newIntent as "repeat" | "edit";
    setIntent(intentValue);
    const nextDate = getIntentDate(intentValue, initState?.date, new Date());
    if (nextDate) setDate(nextDate);
  }, [initState?.date]);

  const pipeItems = useMemo(
    () => buildPipeItems(allPipes, pipeId),
    [allPipes, pipeId],
  );

  const paidFromPipeItems = useMemo(
    () => buildPaidFromPipeItems(allPipes, pipeId, isNegative),
    [allPipes, pipeId, isNegative],
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

  const destinationPipeName = useMemo(
    () => getDestinationPipeName(allPipes, sentToPipeId),
    [allPipes, sentToPipeId],
  );
  const actionLabel = intent === "edit"
    ? "Update transaction"
    : getButtonLabel(isFeed ? "feed" : "spend", isNegative, destinationPipeName);

  const resetForm = useCallback(() => {
    setTitle("");
    setValue(isBoiler ? "0" : isFeed ? "" : "-");
    setCurrentFedValue(initialCurrentFedValue);
    setDate(new Date());
    setSentToPipeId(null);
    setPaidFromPipeId(null);
    setShowPaidFrom(false);
    setSpendMode("spend");
    setIntent("repeat");
  }, [initialCurrentFedValue, isBoiler, isFeed]);

  const editTransaction = useMutation(api.transactions.editTransaction);

  const handleEditSubmit = useCallback(async () => {
    const amount = parseMoney(value);
    const transaction = await editTransaction(
      buildEditTransactionCommand({
        transactionId: initState?.transactionId!,
        title,
        amount,
        date: date.getTime(),
      }),
    );
    await transactionCache?.updateTransaction(transaction);
    resetForm();
    onSuccess?.();
  }, [title, value, date, initState?.transactionId, onSuccess, resetForm, editTransaction, transactionCache]);

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
  }, [isBoiler, isFeed, value, title, date, pipeId, spendMode, sentToPipeId, paidFromPipeId, currentFedChanged, parsedCurrentFed, onSuccess, resetForm, contributeToBoiler, createTransaction, transactionCache]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      if (intent === "edit") {
        await handleEditSubmit();
      } else {
        await handleRepeatSubmit();
      }
    } catch (error) {
      showAlert.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }, [isValid, loading, intent, handleEditSubmit, handleRepeatSubmit, showAlert]);

  return (
    <View className="px-4 py-4 gap-2">
      {initState && (
        <View className="flex-row items-center border-b border-muted/20 p-2">
          <View className="flex-row gap-4 items-center flex-1">
            <Icon name={initState.pipeIcon} size={24} color={colors.muted} />
            <Text className="text-md font-medium text-muted">{initState.pipeName}</Text>
          </View>
          {isTransactionVariant && initState?.transactionId && (
            <SlideToggle
              options={[
                { value: "repeat", label: "Repeat transaction", icon: "repeat-once" },
                { value: "edit", label: "Edit transaction", icon: "pencil-outline" },
              ]}
              value={intent}
              onChange={handleIntentChange}
            />
          )}
        </View>
      )}

      {isTransactionVariant && !initState ? (
        <View className="flex-row items-center justify-center pt-2">
          <SlideToggle
            options={[
              { value: "repeat", label: "Repeat transaction", icon: "repeat-once" },
              { value: "edit", label: "Edit transaction", icon: "pencil-outline" },
            ]}
            value={intent}
            onChange={handleIntentChange}
          />
        </View>
      ) : null}

      {!isTransactionVariant && !isFeed ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-text">
            {spendMode === "spend" ? "Add transaction" : "Transfer"}
          </Text>
          <SlideToggle
            options={[
              { value: "spend", label: "Spend", icon: "upload" },
              { value: "transfer", label: "Transfer", icon: "repeat" },
            ]}
            value={spendMode}
            onChange={handleModeChange}
          />
        </View>
      ) : null}

      <Input
        type="text-select"
        value={title}
        onChangeText={setTitle}
        onOptionSelect={setTitle}
        options={recentTitles ?? []}
        maxLength={140}
        multiline
        placeholder="What was this for?"
        disabled={loading}
      />

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Input
            type="decimal"
            label={isFeed ? "Amount" : "Value"}
            value={value}
            onChange={setValue}
            placeholder="0.00"
            allowNegative={!isFeed}
            disabled={loading}
          />
        </View>
        <View className="flex-1">
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={setDate}
            disabled={loading}
          />
        </View>
      </View>

      {isBoiler ? (
        <View className="gap-1">
          <Input
            type="decimal"
            label={`Current in ${boilerName ?? "boiler"}`}
            value={currentFedValue}
            onChange={setCurrentFedValue}
            allowNegative={false}
            disabled={loading}
          />
          {boilerContributionAmount > 0 && !currentFedChanged ? (
            <Text
              testID="boiler-growth-hint"
              className="text-xs text-muted"
            >
              <Text testID="boiler-growth-amount" className="font-bold">
                +{formatAmount(boilerContributionAmount)}:
              </Text>{" "}
              current will also grow by {formatAmount(boilerContributionAmount)} after this operation, unless manually modified
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isFeed && !isTransactionVariant && spendMode === "transfer" && (
        <Input
          type="select"
          label="Transfer to"
          value={sentToPipeId}
          onSelect={(id) => setSentToPipeId(id ? (id as Id<"pipes">) : null)}
          items={pipeItems}
          renderItem={renderPipeItem}
          placeholder="None"
        />
      )}

      {!isFeed && !isTransactionVariant && spendMode === "spend" && (
        showPaidFrom ? (
          <Input
            type="select"
            label={isNegative ? "Paid from" : "Refunded to"}
            value={paidFromPipeId}
            onSelect={(id) => setPaidFromPipeId(id ? (id as Id<"pipes">) : null)}
            items={paidFromPipeItems}
            renderItem={renderPipeItem}
            placeholder="None"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paid from another pipe?"
            onPress={() => setShowPaidFrom(true)}
            className="self-start flex-row items-center gap-1 py-1 opacity-50"
          >
            <Icon name="wallet-outline" size={14} color={colors.muted} />
            <Text className="text-xs text-muted">Paid from another pipe?</Text>
          </Pressable>
        )
      )}

      <View className="flex-row items-center justify-between gap-3 pt-2">
        <TouchableOpacity
          testID="eraser-button"
          accessibilityRole="button"
          accessibilityLabel="Clear form"
          accessibilityState={{ disabled: loading }}
          onPress={resetForm}
          disabled={loading}
          className={cn(
            "p-3 border border-muted rounded-full",
            loading && "opacity-50",
          )}
        >
          <Icon name="eraser" size={20} color={colors.muted} />
        </TouchableOpacity>

        <Pressable
          testID="submit-button"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityState={{ disabled: !isValid || loading, busy: loading }}
          aria-busy={loading}
          onPress={handleSubmit}
          disabled={!isValid || loading}
          className={cn(
            "rounded-lg border px-5 py-3 flex-row items-center gap-2",
            isValid && !loading ? "" : "opacity-50",
            buttonStyle.border,
          )}
        >
          {loading ? (
            <ActivityIndicator
              accessibilityLabel={`Submitting ${actionLabel}`}
              color={buttonStyle.iconColor}
            />
          ) : (
            <>
              <Icon
                name={buttonIcon as IconName}
                size={20}
                color={buttonStyle.iconColor}
              />
              <Text
                className={cn(
                  "font-semibold text-base",
                  buttonStyle.textColor,
                )}
              >
                {actionLabel}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
