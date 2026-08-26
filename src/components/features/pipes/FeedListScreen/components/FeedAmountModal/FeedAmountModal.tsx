import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { Icon } from "@ui/Icon";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from "@features/components/AmountForm";

type Props = {
  pipeId: Id<"pipes">;
  feedName: string;
  sourceType?: "feed" | "boiler";
  fed?: number;
};

export function FeedAmountModal({
  pipeId,
  feedName,
  sourceType,
  fed = 0,
}: Props) {
  const [visible, setVisible] = useState(false);
  const showAlert = useAlert();

  return (
    <>
      <Pressable
        className="p-2 rounded-full"
        accessibilityRole="button"
        accessibilityLabel={`Add money to ${feedName}`}
        onPress={() => setVisible(true)}
        testID="feed-amount-trigger"
      >
        <Icon name="add-circle-outline" size={24} color="white" />
      </Pressable>

      <ModalShell visible={visible} onClose={() => setVisible(false)}>
        <View className="gap-4">
          <Text className="text-lg font-semibold text-text">Feed {feedName}</Text>
          <AmountForm
            variant={sourceType === "boiler" ? "boiler" : "feed"}
            pipeId={pipeId}
            boilerName={sourceType === "boiler" ? feedName : undefined}
            currentFed={sourceType === "boiler" ? fed : undefined}
            onSuccess={() => {
              showAlert.success(
                sourceType === "boiler" ? "Boiler updated" : "Feed added",
              );
              setVisible(false);
            }}
          />
        </View>
      </ModalShell>
    </>
  );
}
