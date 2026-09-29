import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { Liquidity } from "@features/pipes/components/PipeBox/components";
import type { Pipe } from "./PipesList";

type Props = {
  pipe: Pipe;
  onPress: () => void;
  onLongPress: () => void;
};

export function MinimizedPipe({ pipe, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={pipe.name}
      accessibilityActions={[{ name: "longpress", label: `Options for ${pipe.name}` }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "longpress") onLongPress();
      }}
      className="w-16 h-12 rounded-md border border-border bg-surface overflow-hidden items-center justify-center p-1 gap-0.5"
    >
      <View style={{ pointerEvents: "none" }} className="absolute inset-0 opacity-40">
        <Liquidity
          capacity={pipe.sourceType === "boiler" ? (pipe.contributedFed ?? 0) : pipe.capacity}
          fed={pipe.fed}
          spent={pipe.spent}
        />
      </View>
      <Icon name={pipe.icon as IconName} size={16} color={colors.text} />
      <Text className="text-text font-medium text-xs text-center" numberOfLines={1} ellipsizeMode="tail">{pipe.name}</Text>
    </Pressable>
  );
}
