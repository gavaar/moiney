import { Pressable, View } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";

type ToggleOption = {
  value: string;
  label: string;
  icon: IconName;
};

type Props = {
  options: [ToggleOption, ToggleOption];
  value: string;
  onChange: (value: string) => void;
};

export function SlideToggle({ options, value, onChange }: Props) {
  return (
    <View className="flex-row rounded-lg border border-border bg-surface">
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={"slide-toggle-" + option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            onPress={() => onChange(option.value)}
            className={cn(
              "flex-row items-center justify-center py-1 px-2",
              index === 0 && "rounded-l-[7px]",
              index === options.length - 1 && "rounded-r-[7px]",
              isActive ? "bg-primary" : "",
            )}
          >
            <Icon name={option.icon} size={16} color={isActive ? colors.text : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}
