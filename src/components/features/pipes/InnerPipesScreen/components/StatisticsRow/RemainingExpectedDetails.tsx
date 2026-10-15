import { Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";

type Props = {
  expected: number;
  spent: number;
  fed: number;
  pendingFedAdjustment: number;
};

export function RemainingExpectedDetails({
  expected,
  spent,
  fed,
  pendingFedAdjustment,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const rowHeight = 20 * fontScale;
  // These are net current-cycle amounts, not a replay of historical expenses.
  const simple = spent - pendingFedAdjustment;
  const spending = [
    { value: pendingFedAdjustment, color: colors.accent },
    { value: simple, color: colors.error },
  ];
  const negativeExtent = Math.max(
    -Math.min(expected, 0),
    spending.reduce((sum, segment) => sum - Math.min(segment.value, 0), 0),
  );
  const positiveExtent = Math.max(
    expected,
    spending.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0),
  );
  const range = negativeExtent + positiveExtent || 1;
  const zero = (negativeExtent / range) * 100;
  const funding = fed - spent + pendingFedAdjustment;

  function segmentStyle(start: number, value: number): ViewStyle {
    return {
      position: "absolute",
      left: `${((negativeExtent + start + Math.min(value, 0)) / range) * 100}%`,
      width: `${(Math.abs(value) / range) * 100}%`,
      height: 8,
      top: (rowHeight - 8) / 2,
    };
  }

  let positiveStart = 0;
  let negativeStart = 0;
  const spentSegments = spending.map(({ value, color }) => {
    const start = value < 0 ? negativeStart : positiveStart;
    if (value < 0) negativeStart += value;
    else positiveStart += value;
    return value === 0 ? null : (
      <View key={color} style={[segmentStyle(start, value), { backgroundColor: color }]} />
    );
  });

  return (
    <View style={{ width: Math.min(320, width * 0.85 - 18) }}>
      <View className="flex-row items-center gap-2 my-2">
        <View className="gap-2">
          <Text className="text-text text-sm" style={{ lineHeight: 20 }}>expected</Text>
          <Text className="text-text text-sm" style={{ lineHeight: 20 }}>spent</Text>
        </View>
        <View className="flex-1 gap-2">
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Expected ${formatAmount(expected)}`}
            style={{ height: rowHeight }}
          >
            {expected !== 0 ? (
              <View style={[
                segmentStyle(0, expected),
                { backgroundColor: colors.errorDark },
              ]} />
            ) : null}
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Spent ${formatAmount(spent)}: paid elsewhere ${formatAmount(pendingFedAdjustment)}, simple ${formatAmount(simple)}`}
            style={{ height: rowHeight }}
          >
            {spentSegments}
          </View>
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: `${zero}%`, top: 0, bottom: 0, width: 1, backgroundColor: colors.muted, transform: [{ translateX: zero === 100 ? -1 : 0 }] }}
          />
        </View>
        <View className="gap-2 items-end">
          <Text className="text-errorMuted text-sm" style={{ lineHeight: 20 }}>{formatAmount(expected)}</Text>
          <Text className="text-error text-sm" style={{ lineHeight: 20 }}>{formatAmount(spent)}</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-3 mb-2">
        <Text className="text-accent text-sm">Paid elsewhere</Text>
        <Text className="text-error text-sm">Paid here</Text>
      </View>
      <Text className="text-text text-sm">
        The monthly expected amount is <Text className="text-errorMuted">{formatAmount(expected)}</Text>.
      </Text>
      <Text className="text-text text-sm mt-2">
        {"After "}<Text className="text-error">{formatAmount(spent)}</Text> in currently tracked spending,
        {" "}<Text className="text-primaryDark">{formatAmount(expected - spent)}</Text> remains.
        {" Spending before the last settlement is not included."}
      </Text>
      <Text className="text-text text-sm mt-2">
        {funding < 0 ? "This pipe should have a funding shortfall of " : "This pipe should have "}
        <Text className="text-primaryDark">{formatAmount(Math.abs(funding))}</Text>
        {funding < 0 ? "." : " of funding left after settlement."}
      </Text>
    </View>
  );
}
