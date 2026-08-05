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
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import {
  buildPipeItems,
  buildPaidFromPipeItems,
  getButtonIcon,
  getButtonLabel,
  getButtonStyle,
  getDestinationPipeName,
} from "./helpers";

type SpentMode = "spend" | "transfer";

type Props = {
  pipeId: Id<"pipes">;
  variant?: "feed" | "spend" | "transaction";
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

export function AmountForm({ pipeId, variant = "spend", initState, onSuccess }: Props) {
  const [title, setTitle] = useState(initState?.title ?? "");
  const [value, setValue] = useState(initState?.value ?? "");
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
  const createTransaction = useMutation(api.transactions.createTransaction);
  const { allPipes } = usePipeSelection();
  const recentTitles = useQuery(api.transactions.listRecentTitles, { pipeId });

  const isFeed = variant === "feed" || (variant === "transaction" && initState?.isFeed === true);
  const isTransactionVariant = variant === "transaction";

  const isValidAmount = useMemo(() => {
    if (value === "" || value === "-") return false;
    const n = parseFloat(value);
    if (isNaN(n)) return false;
    return isFeed ? n > 0 : n !== 0;
  }, [value, isFeed]);

  const isValid =
    title.trim() !== "" &&
    isValidAmount &&
    (isFeed || isTransactionVariant || spendMode !== "transfer" || sentToPipeId !== null);

  const isNegative = value === "" ? !isFeed : value.startsWith("-");

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
    setSpendMode(newMode as SpentMode);
    if (newMode === "spend") {
      setSentToPipeId(null);
    } else {
      setPaidFromPipeId(null);
      setShowPaidFrom(false);
    }
  }, []);

  const handleIntentChange = useCallback((newIntent: string) => {
    setIntent(newIntent as "repeat" | "edit");
    if (newIntent === "edit" && initState?.date) {
      setDate(new Date(initState.date));
    } else if (newIntent === "repeat") {
      setDate(new Date());
    }
  }, [initState?.date]);

  const handleValueChange = useCallback((text: string) => {
    setValue((prev) => {
      if (!isFeed && prev === "" && text !== "" && !text.startsWith("-")) {
        return "-" + text;
      }
      return text;
    });
  }, [isFeed]);

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

  const resetForm = useCallback(() => {
    setTitle("");
    setValue("");
    setDate(new Date());
    setSentToPipeId(null);
    setPaidFromPipeId(null);
    setShowPaidFrom(false);
    setSpendMode("spend");
    setIntent("repeat");
  }, []);

  const editTransaction = useMutation(api.transactions.editTransaction);

  const handleEditSubmit = useCallback(async () => {
    const parsedValue = parseFloat(value);
    await editTransaction({
      transactionId: initState?.transactionId!,
      title,
      value: parsedValue,
      date: date.getTime(),
    });
    resetForm();
    onSuccess?.();
  }, [title, value, date, initState?.transactionId, onSuccess, resetForm, editTransaction]);

  const handleRepeatSubmit = useCallback(async () => {
    const parsedValue = parseFloat(value);
    if (isFeed) {
      await createTransaction({
        title: title.trim(),
        value: parsedValue,
        date: date.getTime(),
        to: pipeId,
      });
    } else {
      await createTransaction({
        title,
        value: parsedValue,
        date: date.getTime(),
        from: pipeId,
        ...(spendMode === "transfer" && sentToPipeId ? { to: sentToPipeId } : {}),
        ...(spendMode === "spend" && paidFromPipeId
          ? {
              paidFrom: paidFromPipeId,
            }
          : {}),
      });
    }
    resetForm();
    onSuccess?.();
  }, [isFeed, value, title, date, pipeId, spendMode, sentToPipeId, paidFromPipeId, onSuccess, resetForm, createTransaction]);

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
          {isTransactionVariant && (
            <SlideToggle
              options={[
                { value: "repeat", icon: "repeat-once" },
                { value: "edit", icon: "pencil-outline" },
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
              { value: "repeat", icon: "repeat-once" },
              { value: "edit", icon: "pencil-outline" },
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
              { value: "spend", icon: "upload" },
              { value: "transfer", icon: "repeat" },
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
            onChange={handleValueChange}
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
          onPress={handleSubmit}
          disabled={!isValid || loading}
          className={cn(
            "rounded-lg border px-5 py-3 flex-row items-center gap-2",
            isValid && !loading ? "" : "opacity-50",
            buttonStyle.border,
          )}
        >
          {loading ? (
            <ActivityIndicator color={buttonStyle.iconColor} />
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
                {intent === "edit" ? "Update transaction" : getButtonLabel(isFeed ? "feed" : "spend", isNegative, destinationPipeName)}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
