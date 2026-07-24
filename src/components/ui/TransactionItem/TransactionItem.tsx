import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { ModalShell } from '../Modal';
import { SpentForm } from '@features/components/SpentForm';
import { useState } from 'react';
import { usePipeSelection } from '@features/pipes/context/PipeSelectionContext';

type TransactionItemProps = {
  transaction: Doc<"transactions">;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isNegative = transaction.value < 0;
  const [showForm, setShowForm] = useState(false);
  const [showDisabledInfo, setShowDisabledInfo] = useState(false);
  const { pipesById, childrenByParent } = usePipeSelection();
  const pipe = pipesById?.[transaction.pipeId];
  const disabled = !pipe || (childrenByParent.get(pipe._id)?.length ?? 0) > 0;

  function handlePress() {
    if (disabled) {
      setShowDisabledInfo(true);
    } else {
      setShowForm(true);
    }
  }

  return (
    <Pressable
      className={cn(
        "flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
        isNegative ? "bg-error/30" : "bg-primary/30",
      )}
      onPress={handlePress}
    >
      <Icon name={pipe?.icon as IconName ?? "pipe"} size={16} color={colors.muted} />

      <Text
        className={cn(
          "font-bold text-sm flex-1 ml-0.5",
          disabled ? "text-muted" : "text-text",
        )}
        numberOfLines={1}
      >
        {transaction.title.charAt(0).toUpperCase() + transaction.title.slice(1)}
      </Text>
      <Text className={cn("text-xs mr-4", disabled ? "text-muted" : "text-white")}>
        {new Date(transaction.date).toLocaleDateString("en-US", DATE_FORMAT)}
      </Text>
      <Text
        className={cn(
          "text-sm font-bold w-16 mr-2",
          disabled ? "text-muted" : "text-white",
        )}
        style={{ textAlign: 'right' }}
      >
        {transaction.value.toFixed(2)}
      </Text>

      <ModalShell visible={showForm} closeOnBackdropPress={true} onClose={() => setShowForm(false)}>
        {pipe && (
          <SpentForm
            pipeId={transaction.pipeId}
            initState={{
              pipeIcon: pipe.icon,
              pipeName: pipe.name,
              title: transaction.title,
              value: `${transaction.value * -1}`,
            }}
          />
        )}
      </ModalShell>

      <ModalShell visible={showDisabledInfo} closeOnBackdropPress={true} onClose={() => setShowDisabledInfo(false)}>
        <View className="p-4">
          <Text className="text-text font-bold text-lg mb-2">Cannot repeat transaction</Text>
          <Text className="text-muted text-sm leading-5">
            This transaction was from a pipe that does not exist or cannot accept transactions anymore
            (probably due to now having child pipes).
          </Text>
        </View>
      </ModalShell>
    </Pressable>
  );
}
