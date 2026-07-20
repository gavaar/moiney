import { Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { Liquidity } from './components/Liquidity';

type PipeBoxProps = {
  name: string;
  icon: string;
  description?: string;
  capacity: number;
  fed: number;
  spent: number;
  onPress?: () => void;
};

export function PipeBox({ name, icon, capacity, fed, spent, onPress }: PipeBoxProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row rounded-md overflow-hidden flex-1"
    >
      <View className="w-16 rounded-bl-md rounded-tl-md border border-border bg-surface items-center justify-center p-1 gap-0.5">
        <Icon name={icon as IconName} size={16} color={colors.primary} />
        <Text className="text-text font-medium text-xs text-center" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
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
