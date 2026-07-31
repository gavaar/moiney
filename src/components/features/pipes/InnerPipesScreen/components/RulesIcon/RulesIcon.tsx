import { TouchableOpacity, Alert } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { useMemo } from 'react';

type Props = {
  rule?: "spend_overflow" | "any_spend" | "cron";
  fed: number;
  capacity: number;
};

export function RulesIcon({ rule, fed, capacity }: Props) {
  const handlePress = () => {
    Alert.alert("Rules", "Rules modal open");
  };

  const color = useMemo(() => {
    if (rule !== "cron" && fed >= capacity) return colors.secondary;
    return colors.text;
  }, [rule, fed, capacity]);

  const icon = useMemo(() => {
    if (rule == "cron") return "timer-outline";
    if (fed >= capacity) return "lock-closed-outline";
    return "lock-open-outline";
  }, [rule, fed, capacity]);

  return (
    <TouchableOpacity onPress={handlePress}>
      <Icon name={icon} size={16} color={color} />
    </TouchableOpacity>
  );
}
