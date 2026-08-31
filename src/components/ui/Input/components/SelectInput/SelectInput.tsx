import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { ModalShell } from "@ui/Modal";

type CommonSelectInputProps = {
  label: string;
  hideLabel?: boolean;
  items: readonly ({ id: string } & Record<string, any>)[];
  renderItem: (item: CommonSelectInputProps["items"][number]) => React.ReactNode;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
};

export type SelectInputProps = CommonSelectInputProps &
  (
    | {
        multiple?: false;
        value: string | null;
        onSelect: (id: string) => void;
      }
    | {
        multiple: true;
        value: readonly string[];
        onChange: (ids: string[]) => void;
      }
  );

export function SelectInput(props: SelectInputProps) {
  const { label, hideLabel, items, renderItem, value, error, disabled, placeholder } = props;
  const [open, setOpen] = useState(false);

  const selectedItem = !props.multiple && value
    ? items.find((item) => item.id === value) ?? null
    : null;

  const handleTriggerPress = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleItemPress = (id: string) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(id)
          ? props.value.filter((selectedId) => selectedId !== id)
          : [...props.value, id],
      );
    } else {
      props.onSelect(id);
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
          error ? "border-error" : "border-border",
        )}
      >
        {props.multiple && props.value.length > 0 ? (
          <Text className="text-base text-text">{props.value.length} selected</Text>
        ) : selectedItem ? (
          <View className="flex-1">{renderItem(selectedItem)}</View>
        ) : (
          <Text className="text-base text-muted">{placeholder ?? "Select..."}</Text>
        )}
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
          {error}
        </Text>
      ) : null}

      <ModalShell visible={open} onClose={() => setOpen(false)}>
        <ScrollView className="max-h-64">
          {items.length === 0 ? (
            <Text className="text-center text-sm text-muted py-4">No options</Text>
          ) : (
            items.map((item) => {
              const checked = props.multiple && props.value.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={props.multiple ? "checkbox" : "button"}
                  accessibilityState={props.multiple ? { checked } : undefined}
                  aria-checked={props.multiple ? checked : undefined}
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
