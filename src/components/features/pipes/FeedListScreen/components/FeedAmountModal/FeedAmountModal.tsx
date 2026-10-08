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
  visible?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
};

export function FeedAmountModal({
  pipeId,
  feedName,
  sourceType,
  fed = 0,
  visible: controlledVisible,
  onClose,
  hideTrigger = false,
}: Props) {
  const [localVisible, setVisible] = useState(false);
  const visible = controlledVisible ?? localVisible;
  const close = () => { setVisible(false); onClose?.(); };
  const showAlert = useAlert();

  function handleSuccess() {
    showAlert.success(
      sourceType === "boiler" ? "Boiler updated" : "Feed added",
    );
    close();
  }

  return (
    <>
      {!hideTrigger && <Pressable
        className="p-2 rounded-full"
        accessibilityRole="button"
        accessibilityLabel={`Add money to ${feedName}`}
        onPress={() => setVisible(true)}
        testID="feed-amount-trigger"
      >
        <Icon name="add-circle-outline" size={24} color="white" />
      </Pressable>}

      <ModalShell visible={visible} onClose={close}>
        {visible ? sourceType === "boiler" ? (
          <View className="gap-4" style={{ flexShrink: 1 }}>
            <Text className="text-lg font-semibold text-text">Feed {feedName}</Text>
            <AmountForm
              variant="boiler"
              pipeId={pipeId}
              boilerName={feedName}
              currentFed={fed}
              onSuccess={handleSuccess}
            />
          </View>
        ) : (
          <AmountForm variant="feed" pipeId={pipeId} onSuccess={handleSuccess} />
        ) : null}
      </ModalShell>
    </>
  );
}
