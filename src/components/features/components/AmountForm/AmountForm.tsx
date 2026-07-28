import { useState, useMemo } from "react";
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

type SpentMode = "upload" | "transfer";

type Props = {
  pipeId: Id<"pipes">;
  mode?: "spend" | "feed";
  initState?: {
    pipeIcon: string;
    pipeName: string;
    title: string;
    value: string;
    sentToPipeId?: Id<"pipes">;
  };
  onSuccess?: () => void;
};

export function getButtonLabel(
  mode: "feed" | "spend",
  isNegative: boolean,
  destinationPipeName: string | null,
  spendMode: SpentMode,
): string {
  if (mode === "feed") return "Feed";
  if (destinationPipeName) {
    return isNegative ? `Send to ${destinationPipeName}` : `Take from ${destinationPipeName}`;
  }
  return isNegative ? "Add expense" : "Add return";
}

export function AmountForm({ pipeId, mode = "spend", initState, onSuccess }: Props) {
  const [title, setTitle] = useState(initState?.title ?? "");
  const [value, setValue] = useState(initState?.value ?? "");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [sentToPipeId, setSentToPipeId] = useState<Id<"pipes"> | null>(
    initState?.sentToPipeId ?? null,
  );
  const [spendMode, setSpendMode] = useState<SpentMode>(
    initState?.sentToPipeId ? "transfer" : "upload",
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

  const handleModeChange = (newMode: string) => {
    setSpendMode(newMode as SpentMode);
    if (newMode === "upload") {
      setSentToPipeId(null);
    }
  };

  const handleValueChange = (text: string) => {
    if (!isFeed && value === "" && text !== "" && !text.startsWith("-")) {
      setValue("-" + text);
    } else {
      setValue(text);
    }
  };

  const pipeItems = useMemo(() => {
    const allPipesList = allPipes ?? [];

    const ancestorIds = new Set<Id<"pipes">>();
    let currentId: Id<"pipes"> | undefined = pipeId;
    while (currentId) {
      ancestorIds.add(currentId);
      const pipe = allPipesList.find((p) => p._id === currentId);
      currentId = pipe?.parentId;
    }

    const feeds = allPipesList.filter(
      (p) => !p.parentId && !ancestorIds.has(p._id),
    );
    return [
      { id: "", name: "None", icon: "close-circle" },
      ...feeds.map((p) => ({ id: p._id, name: p.name, icon: p.icon })),
    ];
  }, [allPipes, pipeId]);

  const destinationPipeName = useMemo(() => {
    if (!sentToPipeId || !allPipes) return null;
    const pipe = allPipes.find((p) => p._id === sentToPipeId);
    return pipe?.name ?? null;
  }, [sentToPipeId, allPipes]);

  const resetForm = () => {
    setTitle("");
    setValue("");
    setDate(new Date());
    setSentToPipeId(null);
    setSpendMode("upload");
  };

  const handleSubmit = async () => {
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
  };

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
            {spendMode === "upload" ? "Add transaction" : "Transfer"}
          </Text>
          <SlideToggle
            options={[
              { value: "upload", icon: "upload" },
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
          renderItem={(item: any) => (
            <View className="flex-row items-center gap-2">
              <Icon name={item.icon as IconName} size={16} color={colors.text} />
              <Text className="text-text">{item.name}</Text>
            </View>
          )}
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
          <Icon name="eraser" size={20} color="#9CA3AF" />
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
            <ActivityIndicator color={isNegative ? "#C05959" : "#46AE82"} />
          ) : (
            <>
              <Icon
                name={isFeed ? "add-circle-outline" : spendMode === "upload" ? "upload" : "repeat"}
                size={20}
                color={isNegative ? "#C05959" : "#46AE82"}
              />
              <Text
                className={cn(
                  "font-semibold text-base",
                  isNegative ? "text-error" : "text-success",
                )}
              >
                {getButtonLabel(mode, isNegative, destinationPipeName, spendMode)}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
