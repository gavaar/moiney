import { Text, View } from "react-native";
import { cn } from "@/lib/styles";
import type { IconName } from "@ui/Icon";
import { SlideToggle } from "@ui/SlideToggle";
import { InputError, useInputValidation } from "../../useInputValidation";

type ToggleOption = { label: string; icon: IconName };

type Props = {
  value: boolean;
  options: readonly [ToggleOption, ToggleOption];
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  onError?: (error?: string) => void;
  validator?: (value: boolean) => string | undefined;
};

export function ToggleInput({ value, onChange, onError, options, validator, disabled }: Props) {
  const { error, markAsDirty } = useInputValidation(value, validator, onError);
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <SlideToggle
          options={[
            { ...options[0], value: "false" },
            { ...options[1], value: "true" },
          ]}
          value={value ? "true" : "false"}
          onChange={(selected) => {
            if (disabled) return;
            const next = selected === "true";
            markAsDirty();
            onChange?.(next);
          }}
          disabled={disabled}
        />
        <Text className={cn("text-sm font-medium text-text", disabled && "opacity-50")}>{options[value ? 1 : 0].label}</Text>
      </View>
      <InputError error={error} />
    </View>
  );
}
