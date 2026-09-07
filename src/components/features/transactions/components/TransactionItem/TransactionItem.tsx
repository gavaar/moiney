import { Animated, PanResponder, Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { AmountForm } from '@features/components/AmountForm';
import { useMemo, useRef, useState } from 'react';
import { usePipeCatalog } from '@features/pipes/context/PipeCatalogContext';
import { formatAmount } from "@/lib/format";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { getTransactionItemModel } from "./transactionItem.model";

type TransactionItemProps = {
  transaction: TransactionModel;
  onShowEditHistory?: (transactionId: TransactionModel["id"]) => void;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};
const EDIT_ACTION_WIDTH = 72;
const EDIT_SWIPE_THRESHOLD = 40;

export function TransactionItem({ transaction, onShowEditHistory }: TransactionItemProps) {
  const { pipesById, childrenByParent, isPaidFromEligible } = usePipeCatalog();

  const [formIntent, setFormIntent] = useState<"repeat" | "edit" | null>(null);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const model = useMemo(
    () => getTransactionItemModel(transaction, { pipesById, childrenByParent, isPaidFromEligible }),
    [transaction, pipesById, childrenByParent, isPaidFromEligible],
  );

  function openForm(intent: "repeat" | "edit") {
    if (model.disabled) {
      setShowDisabledInfo(true);
    } else {
      setFormIntent(intent);
    }
  }

  function resetSwipe() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      !model.disabled &&
      gesture.dx < -8 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      translateX.setValue(Math.max(-EDIT_ACTION_WIDTH, Math.min(0, gesture.dx)));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx <= -EDIT_SWIPE_THRESHOLD) openForm("edit");
      resetSwipe();
    },
    onPanResponderTerminate: resetSwipe,
  });

  return (
    <View className="flex-row gap-1 items-center">
      <View className="relative flex-1 rounded-2xl">
        {!model.disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${transaction.title}`}
            onPress={() => openForm("edit")}
            className="absolute inset-y-0 right-0 w-[92px] rounded-tr-2xl rounded-br-2xl items-center justify-center bg-secondary"
          >
            <Icon name="pencil-outline" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        <Animated.View
          style={{
            width: "100%",
            zIndex: 1,
            backgroundColor: colors.background,
            transform: [{ translateX }],
            borderRadius: 12,
          }}
          {...panResponder.panHandlers}
        >
          <Pressable
            className={cn(
              "w-full flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
              model.bgClass,
            )}
            onPress={() => openForm("repeat")}
          >
            {model.uiIcons.map((icon, index) => (<Icon key={index} name={icon.name} size={icon.size} color={icon.color} />))}

            <Text
              className={cn(
                "font-bold text-sm flex-1 ml-0.5",
                model.disabled ? "text-muted" : "text-text",
              )}
              numberOfLines={1}
            >
              {transaction.title.charAt(0).toUpperCase() + transaction.title.slice(1)}
            </Text>
            <Text className={cn("text-xs mr-4", model.disabled ? "text-muted" : "text-white")}>
              {new Date(transaction.date).toLocaleDateString("en-US", DATE_FORMAT)}
            </Text>
            <Text
              className={cn(
                "text-sm font-bold w-16 mr-2 text-right",
                model.disabled ? "text-muted" : "text-white",
              )}
            >
              {formatAmount(transaction.value)}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {transaction.editedAt && onShowEditHistory ? (
        <Pressable
          testID="transaction-edit-history"
          className="items-center justify-center rounded-2xl border border-border bg-surface px-2"
          accessibilityRole="button"
          accessibilityLabel={`View edit history for ${transaction.title}`}
          onPress={() => onShowEditHistory(transaction.id)}
        >
          <Icon name="history" size={15} color={colors.muted} />
          <Text className="text-muted text-[10px]">Edited</Text>
        </Pressable>
      ) : null}

      <ModalShell visible={formIntent !== null} onClose={() => setFormIntent(null)}>
        {formIntent && model.primaryPipeId && model.formInitState ? (
          <AmountForm
            variant="transaction"
            pipeId={model.primaryPipeId}
            initState={{ ...model.formInitState, intent: formIntent }}
            onSuccess={() => setFormIntent(null)}
          />
        ) : null}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            {model.viewOnly
              ? "This is preserved history from a deleted pipe. Preserved history is view-only."
              : "This transaction was from a pipe that does not exist or cannot accept transactions anymore (probably due to now having children pipes)."}
          </Text>
        </View>
      </ModalShell>
    </View>
  );
}
