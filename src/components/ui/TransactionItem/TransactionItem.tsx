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
  pipeId: Id<"pipes">;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function TransactionItem({ transaction, pipeId }: TransactionItemProps) {
  const isNegative = transaction.value < 0;
  const [showForm, setShowForm] = useState(false);
  const { pipesById } = usePipeSelection();
  const pipe = pipesById?.[pipeId];

  return (
    <Pressable
      className={cn(
        "flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
        isNegative ? "bg-error/30" : "bg-primary/30",
      )}
      onPress={() => setShowForm(true)}
    >
      <Icon name={pipe?.icon as IconName} size={16} color={colors.muted} />

      <Text className="text-text font-bold text-sm flex-1 ml-0.5" numberOfLines={1}>
        {transaction.title.charAt(0).toUpperCase() + transaction.title.slice(1)}
      </Text>
      <Text className="text-muted text-xs mr-4">
        {new Date(transaction.date).toLocaleDateString("en-US", DATE_FORMAT)}
      </Text>
      <Text className="text-sm font-bold text-white w-16 mr-2" style={{ textAlign: 'right' }}>
        {transaction.value.toFixed(2)}
      </Text>

      <ModalShell visible={showForm} closeOnBackdropPress={true} onClose={() => setShowForm(false)}>
        {pipe && (
          <SpentForm
            pipeId={pipeId}
            initState={{
              pipeIcon: pipe.icon,
              pipeName: pipe.name,
              title: transaction.title,
              value: `${transaction.value * -1}`,
            }}
          />
        )}
      </ModalShell>
    </Pressable>
  );
}
