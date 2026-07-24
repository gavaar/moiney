import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { cn } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";

type SelectInputProps = {
  label: string;
  items: readonly ({ id: string } & Record<string, any>)[];
  renderItem: (item: SelectInputProps['items'][number]) => React.ReactNode;
  value: string | null;
  onSelect: (id: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function SelectInput({
  label,
  items,
  renderItem,
  value,
  onSelect,
  error,
  disabled,
  placeholder,
}: SelectInputProps) {
  const [open, setOpen] = useState(false);

  const selectedItem = value ? items.find((i) => i.id === value) ?? null : null;

  const handleTriggerPress = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleItemPress = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <View className={cn("gap-1", disabled && "opacity-60")}>
      <Text className="text-sm font-medium text-text">{label}</Text>
      <Pressable
        testID="select-trigger"
        onPress={handleTriggerPress}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2.5 flex-row items-center gap-2",
          error ? "border-error" : "border-border",
        )}
      >
        {selectedItem ? (
          <View className="flex-1">{renderItem(selectedItem)}</View>
        ) : (
          <Text className="text-base text-muted">{placeholder ?? "Select..."}</Text>
        )}
      </Pressable>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}

      <ModalShell visible={open} onClose={() => setOpen(false)}>
        <ScrollView className="max-h-64">
          {items.length === 0 ? (
            <Text className="text-center text-sm text-muted py-4">No options</Text>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleItemPress(item.id)}
                className="px-3 py-3 border-b border-border/30 last:border-b-0 active:opacity-70"
              >
                {renderItem(item)}
              </Pressable>
            ))
          )}
        </ScrollView>
      </ModalShell>
    </View>
  );
}