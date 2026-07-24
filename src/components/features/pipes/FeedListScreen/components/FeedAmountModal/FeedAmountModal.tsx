import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { Button } from "@ui/Button";
import { Icon, type IconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { FromPickerOverlay } from "./components/FromPickerOverlay";
import { toTwoDecimals, isValidAmount } from "./helpers";

type Props = {
  pipeId: Id<"pipes">;
  feedName: string;
};

export function FeedAmountModal({ pipeId, feedName }: Props) {
  const [visible, setVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromFeedId, setFromFeedId] = useState<string | null>(null);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);

  const showAlert = useAlert();
  const feedPipe = useMutation(api.pipes.feedPipe);
  const { allPipes, childrenByParent, pipesById } = usePipeSelection();

  const allPipesFlat = allPipes ?? [];

  const [expandedIds, setExpandedIds] = useState<Set<Id<"pipes">>>(() => {
    const initial = new Set<Id<"pipes">>();
    for (const key of childrenByParent.keys()) {
      if (key !== pipeId) initial.add(key);
    }
    return initial;
  });

  const roots = allPipesFlat.filter(
    (p) => !p.parentId && p._id !== pipeId,
  );

  const selectedPipe = fromFeedId
    ? (pipesById?.[fromFeedId as Id<"pipes">] ?? null)
    : null;

  const toggleExpanded = (id: Id<"pipes">) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parsedAmount = inputText === "" ? 0 : parseFloat(inputText);
  const canSubmit = isValidAmount(inputText);

  const reset = () => {
    setInputText("");
    setFromFeedId(null);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;

    if (fromFeedId) {
      const amount = toTwoDecimals(parsedAmount);
      console.log({ fromFeedId, pipeId, amount });
      setVisible(false);
      reset();
      return;
    }

    setLoading(true);
    try {
      const amount = toTwoDecimals(parsedAmount);
      await feedPipe({ pipeId, amount });
      showAlert.success("Feed added");
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

          <View className="gap-1">
            <Text className="text-sm font-medium text-text">From (optional)</Text>
            <Pressable
              testID="from-trigger"
              onPress={() => setFromPickerOpen(true)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 flex-row items-center gap-2"
            >
              {selectedPipe ? (
                <View className="flex-row items-center gap-2 flex-1">
                  <Icon name={selectedPipe.icon as IconName} size={16} color={colors.text} />
                  <Text className="text-base text-text">{selectedPipe.name}</Text>
                </View>
              ) : (
                <Text className="text-base text-muted">Take from somewhere?</Text>
              )}
            </Pressable>
          </View>

          <FromPickerOverlay
            open={fromPickerOpen}
            roots={roots}
            pipeId={pipeId}
            fromFeedId={fromFeedId}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onSelect={setFromFeedId}
            onToggle={toggleExpanded}
            onClose={() => setFromPickerOpen(false)}
          />

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
              variant="primary"
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
