import { DimensionValue, View } from "react-native";
import { colors } from "@/lib/styles";

const BAR_WIDTH = 100;

export function MiniBar({
  fed,
  spent,
  capacity,
  maxVal,
}: {
  fed: number;
  spent: number;
  capacity: number;
  maxVal: number;
}) {
  const hasNegative = fed < 0 || capacity < 0;
  const hasPositive = fed > 0 || capacity > 0 || spent > 0;

  const pHalf = (v: number) => `${(v / maxVal) * 100}%` as DimensionValue;

  return (
    <View
      className="flex-row rounded-sm overflow-hidden"
      style={{ width: BAR_WIDTH, height: 8 }}
    >
      {hasNegative && (
        <View
          className="relative overflow-hidden"
          style={{ flex: 1, flexDirection: "row-reverse" }}
        >
          {capacity < 0 && (
            <View
              testID="mini-bar-negative-capacity"
              style={{
                width: pHalf(Math.abs(capacity)),
                backgroundColor: colors.errorDark,
                height: 8,
              }}
            />
          )}
          {fed < 0 && (
            <View
              testID="mini-bar-negative-fed"
              style={{
                position: "absolute", right: 0, top: 0,
                width: pHalf(Math.abs(fed)),
                backgroundColor: colors.error,
                height: 8,
              }}
            />
          )}
          {fed < 0 && spent > 0 && (
            <View
              testID="mini-bar-negative-spent"
              style={{
                position: "absolute", right: 0, top: 0,
                width: pHalf(spent),
                backgroundColor: `${colors.errorBright}CC`,
                height: 8,
              }}
            />
          )}
        </View>
      )}

      <View style={{ width: 1, backgroundColor: colors.text }} />

      {hasPositive && (
        <View
          className="flex-row overflow-hidden"
          style={{ flex: 1 }}
        >
          {spent > 0 && (
            <View
              testID="mini-bar-spent"
              style={{ width: pHalf(spent), backgroundColor: colors.error, height: 8 }}
            />
          )}
          {fed >= 0 && (
            <View
              testID="mini-bar-fed"
              style={{
                width: pHalf(Math.max(0, fed - spent)),
                backgroundColor: colors.success,
                height: 8,
              }}
            />
          )}
          {capacity > 0 && (
            <View
              testID="mini-bar-capacity"
              style={{
                width: pHalf(Math.max(0, capacity - fed)),
                backgroundColor: "#413f3f",
                height: 8,
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
