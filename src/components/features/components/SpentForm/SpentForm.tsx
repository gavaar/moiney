import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { cn, colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { Input } from "@ui/Input";
import { useAlert } from "@ui/Alert";

type Props = {
  pipeId: Id<"pipes">;
  initState?: {
    pipeIcon: string;
    pipeName: string;
    title: string;
    value: string;
  };
};

export function SpentForm({ pipeId, initState }: Props) {
  const [title, setTitle] = useState(initState?.title ?? "");
  const [value, setValue] = useState(initState?.value ?? "");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const showAlert = useAlert();
  const createTransaction = useMutation(api.transactions.createTransaction);

  const isValid = title.trim() !== "" && value !== "";
  const isNegative = value.startsWith("-");

  const resetForm = () => {
    setTitle("");
    setValue("");
    setDate(new Date());
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const parsedValue = parseFloat(value) * -1;
      await createTransaction({
        title,
        value: parsedValue,
        date: date.getTime(),
        pipeId,
      });
      resetForm();
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
      {initState &&
        <View className="flex-row gap-4 items-center justify-center border-b border-muted/20 p-2">
          <Icon name={initState.pipeIcon} size={24} color={colors.muted} />
          <Text className="text-md font-medium text-muted">{initState.pipeName}</Text>
        </View>
      }

      <Input
        type="text"
        label="Add transaction"
        value={title}
        onChangeText={setTitle}
        maxLength={140}
        multiline
        placeholder="What was this for?"
        disabled={loading}
      />

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Input
            type="decimal"
            label="Value"
            value={value}
            onChange={setValue}
            placeholder="0.00"
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
            isNegative ? "border-success" : "border-error",
          )}
        >
          {loading ? (
            <ActivityIndicator color={isNegative ? "#46AE82" : "#C05959"} />
          ) : (
            <>
              <Icon
                name="upload"
                size={20}
                color={isNegative ? "#46AE82" : "#C05959"}
              />
              <Text
                className={cn(
                  "font-semibold text-base",
                  isNegative ? "text-success" : "text-error"
                )}
              >
                {isNegative ? "Add return" : "Add expense"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
