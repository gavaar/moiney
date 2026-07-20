import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";

type Props = {
  pipeId: Id<"pipes">;
  feedName: string;
};

export function FeedAmountModal({ pipeId, feedName }: Props) {
  const [visible, setVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const feedPipe = useMutation(api.pipes.feedPipe);

  const parsedAmount = inputText === "" ? 0 : parseFloat(inputText);
  const canSubmit = parsedAmount > 0;

  const reset = () => {
    setInputText("");
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const amount = Math.round(parsedAmount * 100) / 100;
      await feedPipe({ pipeId, amount });
      Alert.alert("Success", "Feed added");
      setVisible(false);
      reset();
    } catch (error) {
      Alert.alert(
        "Error",
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
              title="Feed"
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
