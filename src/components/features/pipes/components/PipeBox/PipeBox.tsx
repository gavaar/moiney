import { Text, TouchableOpacity, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { Liquidity, MiniChildBox } from './components';
import type { PipeModel } from "@features/pipes/data/pipes";

export type ChildSnapshot = {
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type PipeBoxProps = Pick<PipeModel, 'name'|'icon'|'priority'|'fed'|'capacity'|'spent'> & {
  showPriority: boolean;
  children?: ChildSnapshot[];
  coverageDonor?: Pick<PipeModel, "name" | "icon">;
  coverageAmountCents?: number;
  coverageProvidedCents?: number;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function PipeBox({ name, icon, priority, capacity, fed, spent, showPriority, children, coverageDonor, coverageAmountCents = 0, coverageProvidedCents = 0, onPress, onLongPress }: PipeBoxProps) {
  return (
    <View className="flex-1">
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={coverageDonor ? `${name}, contingency donor ${coverageDonor.name}` : name}
        accessibilityHint={coverageProvidedCents > 0 ? `Spending shows ${formatAmount(spent)} actual and ${formatAmount(coverageProvidedCents)} possible coverage provided.` : undefined}
        accessibilityActions={[{ name: "longpress", label: `Options for ${name}` }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "longpress") onLongPress?.();
        }}
        activeOpacity={0.7}
        className="flex-row rounded-md overflow-hidden min-h-12"
      >
        {showPriority && (
          <Text className="absolute top-1 left-1 text-muted text-[10px] z-10">{priority}</Text>
        )}
        <View className="w-16 rounded-bl-md rounded-tl-md border border-border bg-surface items-center justify-center p-1 gap-0.5">
          <Icon name={safeIconName(icon)} size={16} color={colors.text} />
          <Text className="text-text font-medium text-xs text-center" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        </View>

        <View className="flex-1 relative">
          <Liquidity capacity={capacity} fed={fed} spent={spent} coverageProvidedCents={coverageProvidedCents} />
          {coverageDonor ? (
            <View style={{ pointerEvents: "none" }} className="absolute left-1 top-0 bottom-0 justify-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View className="relative items-center justify-center" style={{ width: 30, height: 30 }}>
                <Icon testID="coverage-shield" name="shield" size={30} color={coverageAmountCents > 0 ? colors.warning : colors.secondaryMuted} />
                <View className="absolute inset-0 items-center justify-center">
                  <Icon testID="coverage-donor-icon" name={safeIconName(coverageDonor.icon)} size={13} color={colors.text} />
                </View>
              </View>
            </View>
          ) : null}
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
          <Text className={`font-semibold text-sm ${fed < 0 ? "text-errorDark" : "text-text"}`}>
            {spent + coverageProvidedCents ? `${formatAmount(spent + coverageProvidedCents)} / ` : ''}{formatAmount(fed)}
          </Text>
          <Text className={`text-xs ${capacity < 0 ? "text-errorDark" : "text-text"}`}>
            ({capacity < 0 ? "debt cap" : "goal"}: {formatAmount(capacity)})
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
