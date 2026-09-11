import { Text, View } from "react-native";
import { cn } from "@/lib/styles";
import type { IconName } from "@ui/Icon";
import { SlideToggle } from "@ui/SlideToggle";

type ToggleOption = { label: string; icon: IconName };

type Props = {
  value: boolean;
  onChange?: (value: boolean) => void;
  options: readonly [ToggleOption, ToggleOption];
  error?: string;
  disabled?: boolean;
};

export function ToggleInput({ value, onChange, options, error, disabled }: Props) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <SlideToggle
          options={[
            { ...options[0], value: "false" },
            { ...options[1], value: "true" },
          ]}
          value={value ? "true" : "false"}
          onChange={(selected) => onChange?.(selected === "true")}
          disabled={disabled}
        />
        <Text className={cn("text-sm font-medium text-text", disabled && "opacity-50")}>{options[value ? 1 : 0].label}</Text>
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
