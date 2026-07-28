import { useCallback, useState, useMemo } from "react";
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
  getButtonLabel,
  getDestinationPipeName,
} from "./helpers";

type SpentMode = "spend" | "transfer";

type Props = {
  pipeId: Id<"pipes">;
  mode?: "spend" | "feed";
  initState?: {
    pipeIcon: string;
    pipeName: string;
    title: string;
    value: string;
    to?: Id<"pipes">;
  };
  onSuccess?: () => void;
};

export function AmountForm({ pipeId, mode = "spend", initState, onSuccess }: Props) {
  const [title, setTitle] = useState(initState?.title ?? "");
  const [value, setValue] = useState(initState?.value ?? "");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [sentToPipeId, setSentToPipeId] = useState<Id<"pipes"> | null>(
    initState?.to ?? null,
  );
  const [spendMode, setSpendMode] = useState<SpentMode>(
    initState?.to ? "transfer" : "spend",
  );

  const showAlert = useAlert();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const feedPipeMutation = useMutation(api.pipes.feedPipe);
  const { allPipes } = usePipeSelection();
  const recentTitles = useQuery(api.transactions.listRecentTitles, { pipeId });

  const isFeed = mode === "feed";

  const isValidAmount = useMemo(() => {
    if (value === "" || value === "-") return false;
    const n = parseFloat(value);
    if (isNaN(n)) return false;
    return isFeed ? n > 0 : n !== 0;
  }, [value, isFeed]);

  const isValid =
    title.trim() !== "" &&
    isValidAmount &&
    (isFeed || spendMode !== "transfer" || sentToPipeId !== null);

  const isNegative = value === "" ? !isFeed : value.startsWith("-");

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
    }
  }, []);

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

  const destinationPipeName = useMemo(
    () => getDestinationPipeName(allPipes, sentToPipeId),
    [allPipes, sentToPipeId],
  );

  const resetForm = useCallback(() => {
    setTitle("");
    setValue("");
    setDate(new Date());
    setSentToPipeId(null);
    setSpendMode("spend");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const parsedValue = parseFloat(value);
      if (isFeed) {
        await feedPipeMutation({
          pipeId,
          amount: parsedValue,
          title: title.trim(),
          date: date.getTime(),
        });
      } else {
        await createTransaction({
          title,
          value: parsedValue,
          date: date.getTime(),
          from: pipeId,
          ...(spendMode === "transfer" && sentToPipeId ? { to: sentToPipeId } : {}),
        });
      }
      resetForm();
      onSuccess?.();
    } catch (error) {
      showAlert.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }, [
    isValid,
    loading,
    isFeed,
    value,
    title,
    date,
    spendMode,
    sentToPipeId,
    pipeId,
    onSuccess,
    feedPipeMutation,
    createTransaction,
    showAlert,
    resetForm,
  ]);

  return (
    <View className="px-4 py-4 gap-2">
      {initState && (
        <View className="flex-row gap-4 items-center justify-center border-b border-muted/20 p-2">
          <Icon name={initState.pipeIcon} size={24} color={colors.muted} />
          <Text className="text-md font-medium text-muted">{initState.pipeName}</Text>
        </View>
      )}

      {!isFeed && (
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
      )}

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
            type="datetime"
            label="Date"
            value={date}
            onChange={setDate}
            disabled={loading}
          />
        </View>
      </View>

      {!isFeed && spendMode === "transfer" && (
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
            isNegative ? "border-error" : "border-success",
          )}
        >
          {loading ? (
            <ActivityIndicator color={isNegative ? colors.error : colors.primary} />
          ) : (
            <>
              <Icon
                name={isFeed ? "add-circle-outline" : spendMode === "spend" ? "upload" : "repeat"}
                size={20}
                color={isNegative ? colors.error : colors.success}
              />
              <Text
                className={cn(
                  "font-semibold text-base",
                  isNegative ? "text-error" : "text-success",
                )}
              >
                {getButtonLabel(mode, isNegative, destinationPipeName)}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
