import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { Button } from "@ui/Button";
import { Icon } from "@ui/Icon";
import { Input } from "@ui/Input";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";

type Props = {
  pipeId: Id<"pipes">;
  feedName: string;
};

export function FeedAmountModal({ pipeId, feedName }: Props) {
  const [visible, setVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const showAlert = useAlert();
  const feedPipe = useMutation(api.pipes.feedPipe);

  const parsedAmount = inputText === "" ? 0 : parseFloat(inputText);
  const isNegative = parsedAmount < 0;
  const canSubmit = inputText !== "" && parsedAmount !== 0 && !Number.isNaN(parsedAmount);

  const reset = () => {
    setInputText("");
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const amount = Math.round(parsedAmount * 100) / 100;
      await feedPipe({ pipeId, amount });
      showAlert.success(`${isNegative ? "Debt" : "Feed"} added`);
      setVisible(false);
      reset();
    } catch (error) {
      showAlert.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Pressable
        className="p-2 rounded-full"
        onPress={() => setVisible(true)}
        testID="feed-amount-trigger"
      >
        <Icon name="add-circle-outline" size={24} color="white" />
      </Pressable>

      <ModalShell visible={visible} closeOnBackdropPress={false} onClose={() => setVisible(false)}>
        <View className="gap-4">
          <Text className="text-lg font-semibold text-text">Feed {feedName}</Text>
          <Input
            type="decimal"
            label="Amount"
            placeholder="100.53"
            value={inputText}
            onChange={setInputText}
            allowNegative
          />
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              title="Cancel"
              variant="muted"
              onPress={() => setVisible(false)}
              disabled={loading}
            />
            <Button
              className="flex-[2_1_0]"
              title={isNegative ? "Debt" : "Feed"}
              variant={isNegative ? "error" : "primary"}
              onPress={handleConfirm}
              disabled={!canSubmit}
              loading={loading}
            />
          </View>
        </View>
      </ModalShell>
    </>
  );
}
