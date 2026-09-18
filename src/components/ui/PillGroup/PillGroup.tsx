import { Pressable, ScrollView, Text, View } from "react-native";
import { cn } from "@/lib/styles";

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  maxWidth?: number;
};

export function PillGroup<T extends string>({ options, value, onChange, accessibilityLabel, maxWidth = 360 }: Props<T>) {
  return (
    <View className="rounded-full bg-surface border border-border overflow-hidden" style={{ maxWidth, width: "100%" }}>
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ padding: 4, gap: 4, flexGrow: 1 }}
      >
        {options.map(option => (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: value === option.value }}
            aria-selected={value === option.value}
            onPress={() => onChange(option.value)}
            className={cn("rounded-full items-center justify-center px-4 py-2", value === option.value && "bg-muted/50")}
            style={{ minHeight: 44, flexGrow: 1, flexShrink: 0 }}
          >
            <Text className="text-text" numberOfLines={1}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
