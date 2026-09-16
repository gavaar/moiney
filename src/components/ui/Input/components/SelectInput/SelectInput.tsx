import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";
import { InputError, useInputValidation } from "../../useInputValidation";

type CommonSelectInputProps = {
  label: string;
  hideLabel?: boolean;
  items: readonly ({ id: string } & Record<string, any>)[];
  renderItem: (item: CommonSelectInputProps["items"][number]) => React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  onError?: (error?: string) => void;
};

export type SelectInputProps = CommonSelectInputProps &
  (
    | {
        multiple?: false;
        value: string | null;
        onChange?: (id: string) => void;
        validator?: (value: string | null) => string | undefined;
      }
    | {
        multiple: true;
        value: readonly string[];
        onChange?: (ids: string[]) => void;
        validator?: (value: readonly string[]) => string | undefined;
      }
  );

export function SelectInput({ label, hideLabel, items, renderItem, value, disabled, placeholder, validator, multiple, onChange, onError }: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const validateValue = useCallback((next: string | null | readonly string[]) => {
    if (multiple) return typeof next !== "string" && next !== null ? validator?.(next) : undefined;
    return typeof next === "string" || next === null ? validator?.(next) : undefined;
  }, [multiple, validator]);
  const { error, markAsDirty } = useInputValidation(value, validateValue, onError);

  const selectedItem = !multiple && value
    ? items.find((item) => item.id === value) ?? null
    : null;

  const handleTriggerPress = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleItemPress = (id: string) => {
    if (disabled) return;
    if (multiple) {
      const next = value.includes(id)
          ? value.filter((selectedId) => selectedId !== id)
          : [...value, id];
      onChange?.(next);
    } else {
      markAsDirty();
      onChange?.(id);
      setOpen(false);
    }
  };

  return (
    <View className={cn("gap-1", disabled && "opacity-60")}>
      {!hideLabel ? <Text className="text-sm font-medium text-text">{label}</Text> : null}
      <Pressable
        testID="select-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        aria-expanded={open}
        onPress={handleTriggerPress}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2 flex-row items-center gap-2",
          error !== undefined ? "border-error" : "border-border",
        )}
      >
        {multiple && value.length > 0 ? (
          <Text className="text-base text-text">{value.length} selected</Text>
        ) : selectedItem ? (
          <View className="flex-1">{renderItem(selectedItem)}</View>
        ) : (
          <Text className="text-base text-muted">{placeholder ?? "Select..."}</Text>
        )}
      </Pressable>
      <InputError error={error} />

      <ModalShell visible={open} onClose={() => {
        if (multiple && !disabled) markAsDirty();
        setOpen(false);
      }}>
        <ScrollView className="max-h-64">
          {items.length === 0 ? (
            <Text className="text-center text-sm text-muted py-4">No options</Text>
          ) : (
            items.map((item) => {
              const checked = multiple && value.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={multiple ? "checkbox" : "button"}
                  accessibilityState={multiple ? { checked } : undefined}
                  aria-checked={multiple ? checked : undefined}
                  onPress={() => handleItemPress(item.id)}
                  style={
                    checked
                      ? { backgroundColor: `${colors.success}33`, borderRadius: 8 }
                      : undefined
                  }
                  className="px-3 py-3 border-b border-border/30 last:border-b-0 active:opacity-70"
                >
                  {renderItem(item)}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </ModalShell>
    </View>
  );
}
