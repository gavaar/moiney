import { DimensionValue, Text, View } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";

type PipeBarsProps = {
  fed: number;
  spent: number;
  capacity: number;
  rule?: "spend_overflow" | "any_spend" | "cron";
};

function BarRow({
  label,
  value,
  maxAbs,
  color,
  dashed,
}: {
  label: string;
  value: number;
  maxAbs: number;
  color: string;
  dashed?: boolean;
}) {
  const w = `${(Math.abs(value) / maxAbs) * 100}%` as DimensionValue;
  const anchorClass = value < 0 ? "right-0" : "left-0";

  return (
    <View className="flex-row items-center">
      <Text className="text-muted text-xs w-12">{label}</Text>
      <View className="flex-1 relative h-1">
        <View
          testID={`bar-${label}-fill`}
          className={`absolute ${anchorClass}`}
          style={
            dashed
              ? {
                  width: w,
                  top: 1.5,
                  borderTopWidth: 1,
                  borderStyle: "dashed",
                  borderColor: color,
                }
              : {
                  width: w,
                  top: 0,
                  bottom: 0,
                  backgroundColor: color,
                  borderRadius: 1,
                }
          }
        />
      </View>
      <Text className="text-xs w-16 text-right text-text">
        {formatAmount(value)}
      </Text>
    </View>
  );
}

export function PipeBars({ fed, spent, capacity, rule }: PipeBarsProps) {
  const maxAbs = Math.max(1, Math.abs(fed), Math.abs(capacity), Math.abs(spent));
  return (
    <View className="gap-1 pb-3">
      <BarRow
        label="capacity"
        value={capacity}
        maxAbs={maxAbs}
        color={capacity < 0 ? colors.errorDark : colors.primary}
        dashed
      />
      <BarRow
        label="fed"
        value={fed}
        maxAbs={maxAbs}
        color={fed < 0 ? colors.error : colors.primary}
      />
      {rule !== "any_spend" ? (
        <BarRow
          label="spent"
          value={spent}
          maxAbs={maxAbs}
          color={spent < 0 ? colors.primary : colors.error}
        />
      ) : null}
    </View>
  );
}
