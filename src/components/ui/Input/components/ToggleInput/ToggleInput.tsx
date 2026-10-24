import { Text, View } from "react-native";
import type { IconName } from "@ui/Icon";
import { SlideToggle } from "@ui/SlideToggle";
import type { InputInteraction, InputValueProps } from "../../input.types";

type ToggleOption = { label?: string; icon: IconName; selectedBackgroundClassName?: string };

export type ToggleInputProps = InputValueProps<boolean> & {
  options: readonly [ToggleOption, ToggleOption];
};

type Props = ToggleInputProps & InputInteraction;

export function ToggleInput({ value, onChange, options, disabled, accessibilityLabel, onInteractionEnd }: Props) {
  return (
    <View accessibilityLabel={accessibilityLabel} className="flex-row items-center justify-between gap-2">
      {options[value ? 1 : 0].label ? <Text className="min-w-0 flex-1 text-lg font-medium text-text">{options[value ? 1 : 0].label}</Text> : null}
      <SlideToggle
        options={[
          { ...options[0], label: options[0].label ?? (accessibilityLabel ? `${accessibilityLabel}: Off` : "Off"), value: "false" },
          { ...options[1], label: options[1].label ?? (accessibilityLabel ? `${accessibilityLabel}: On` : "On"), value: "true" },
        ]}
        value={value ? "true" : "false"}
        onChange={(selected) => {
          if (disabled) return;
          const next = selected === "true";
          onInteractionEnd();
          onChange?.(next);
        }}
        disabled={disabled}
      />
    </View>
  );
}
