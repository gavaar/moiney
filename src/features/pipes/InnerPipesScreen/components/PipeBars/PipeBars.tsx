import { DimensionValue, Text, View } from "react-native";

type PipeBarsProps = {
  fed: number;
  spent: number;
  capacity: number;
  max: number;
};

export function PipeBars({ fed, spent, capacity, max }: PipeBarsProps) {
  const pct = (v: number) => (max > 0 ? `${(v / max) * 100}%` : "0%") as DimensionValue;

  return (
    <View className="gap-1 pb-3">
      <View className="flex-row items-center">
        <Text className="text-muted text-xs w-12">capacity</Text>
        <View className="flex-1 flex-row items-center">
          <View
            testID="bar-capacity-fill"
            className="h-0 border-t border-dashed border-primary"
            style={{ width: pct(capacity) }}
          />
        </View>
        <Text className="text-text text-xs w-16 text-right">{capacity}</Text>
      </View>

      <View className="flex-row items-center">
        <Text className="text-muted text-xs w-12">fed</Text>
        <View className="flex-1 flex-row items-center">
          <View
            testID="bar-fed-fill"
            className="h-px bg-primary"
            style={{ width: pct(fed) }}
          />
        </View>
        <Text className="text-text text-xs w-16 text-right">{fed}</Text>
      </View>

      <View className="flex-row items-center">
        <Text className="text-muted text-xs w-12">spent</Text>
        <View className="flex-1 flex-row items-center">
          <View
            testID="bar-spent-fill"
            className="h-px bg-error"
            style={{ width: pct(spent) }}
          />
        </View>
        <Text className="text-text text-xs w-16 text-right">{spent}</Text>
      </View>
    </View>
  );
}
