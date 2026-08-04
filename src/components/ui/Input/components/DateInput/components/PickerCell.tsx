import { Pressable, Text } from "react-native";
import { cn } from "@/lib/styles";

const MONTH_CELL = "flex-1 items-center justify-center rounded-lg py-2";

type Props = {
  testID: string;
  selected: boolean;
  label: string;
  onPress: () => void;
};

export function PickerCell({ testID, selected, label, onPress }: Props) {
  return (
    <Pressable
      testID={testID}
      aria-selected={selected}
      onPress={onPress}
      className={cn(MONTH_CELL, selected ? "bg-primary" : "")}
    >
      <Text className={cn("text-sm", selected ? "text-background" : "text-text")}>
        {label}
      </Text>
    </Pressable>
  );
}
