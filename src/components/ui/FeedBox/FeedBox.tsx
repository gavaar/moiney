import { Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { Liquidity } from './components/Liquidity';

type FeedBoxProps = {
  name: string;
  icon: string;
  description?: string;
  capacity: number;
  fed: number;
  spent: number;
  onPress?: () => void;
};

export function FeedBox({ name, icon, capacity, fed, spent, onPress }: FeedBoxProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row rounded-md overflow-hidden flex-1"
    >
      <View className="w-20 rounded-bl-md rounded-tl-md border border-border bg-surface items-center justify-center p-2 gap-1">
        <Icon name={icon as IconName} size={20} color={colors.primary} />
        <Text className="text-text font-medium text-sm text-center">{name}</Text>
      </View>

      <Liquidity capacity={capacity} fed={fed} spent={spent} />

      <View className="absolute flex right-1 top-1 p-1 items-end justify-center rounded-md">
        <Text className="text-text font-semibold text-sm">
          {spent.toFixed(1)} / {fed.toFixed(1)}
        </Text> 
        <Text className="text-text text-xs">
          (goal: {capacity.toFixed(1)})
        </Text> 
      </View>
    </TouchableOpacity>
  );
}
