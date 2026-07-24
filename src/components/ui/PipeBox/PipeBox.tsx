import { Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { Liquidity, MiniChildBox } from './components';

export type ChildSnapshot = {
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type PipeBoxProps = {
  name: string;
  icon: string;
  priority?: number;
  description?: string;
  capacity: number;
  fed: number;
  spent: number;
  children?: ChildSnapshot[];
  onPress?: () => void;
};

export function PipeBox({ name, icon, priority, capacity, fed, spent, children, onPress }: PipeBoxProps) {
  return (
    <View className="flex-1">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row rounded-md overflow-hidden min-h-15"
      >
        {priority !== undefined && (
          <Text className="absolute top-1 left-1 text-muted text-[10px] z-10">{priority}</Text>
        )}
        <View className="w-16 rounded-bl-md rounded-tl-md border border-border bg-surface items-center justify-center p-1 gap-0.5">
          <Icon name={icon as IconName} size={16} color={colors.text} />
          <Text className="text-text font-medium text-xs text-center" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        </View>

        <View className="flex-1 relative">
          <Liquidity capacity={capacity} fed={fed} spent={spent} />
          {children && children.length > 0 && (
            <View className="absolute bottom-0 left-0 right-0 flex-row items-end gap-0.5 px-1" style={{ height: 20 }}>
              {children.map((child, idx) => (
                <View key={idx} className="h-full" style={{ aspectRatio: 1 }}>
                  <MiniChildBox {...child} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="absolute flex right-1 top-1 p-1 items-end justify-center rounded-md">
          <Text className="text-text font-semibold text-sm">
            {spent.toFixed(1)} / {fed.toFixed(1)}
          </Text> 
          <Text className="text-text text-xs">
            (goal: {capacity.toFixed(1)})
          </Text> 
        </View>
      </TouchableOpacity>
    </View>
  );
}
