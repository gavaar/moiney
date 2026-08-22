import { DimensionValue, Text, View } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";

type PipeBarsProps = {
  fed: number;
  spent: number;
  capacity: number;
  pendingFedAdjustment?: number;
  rule?: "spend_overflow" | "instant_settlement" | "cron";
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

function FedBarRow({
  fed,
  pendingFedAdjustment,
  maxAbs,
}: {
  fed: number;
  pendingFedAdjustment: number;
  maxAbs: number;
}) {
  const fedWidth = (Math.abs(fed) / maxAbs) * 100;
  const adjustmentWidth =
    (Math.min(Math.abs(pendingFedAdjustment), Math.abs(fed)) / maxAbs) * 100;
  const fedStart = fed < 0 ? 100 - fedWidth : 0;
  const adjustmentStart =
    pendingFedAdjustment > 0 ? fedStart : fedStart + fedWidth - adjustmentWidth;

  return (
    <View className="flex-row items-center">
      <Text className="text-muted text-xs w-12">fed</Text>
      <View className="flex-1 relative h-1">
        <View
          testID="bar-fed-fill"
          className={`absolute ${fed < 0 ? "right-0" : "left-0"}`}
          style={{
            width: `${fedWidth}%`,
            top: 0,
            bottom: 0,
            backgroundColor: fed < 0 ? colors.error : colors.primary,
            borderRadius: 1,
          }}
        />
        {pendingFedAdjustment !== 0 && adjustmentWidth > 0 ? (
          <View
            testID="bar-fed-adjustment-fill"
            className="absolute"
            style={{
              left: `${adjustmentStart}%`,
              width: `${adjustmentWidth}%`,
              top: 0,
              bottom: 0,
              backgroundColor: colors.accent,
              borderRadius: 1,
            }}
          />
        ) : null}
      </View>
      <Text className="text-xs w-16 text-right text-text">
        {formatAmount(fed)}
      </Text>
    </View>
  );
}

export function PipeBars({
  fed,
  spent,
  capacity,
  pendingFedAdjustment = 0,
  rule,
}: PipeBarsProps) {
  const maxAbs = Math.max(
    1,
    Math.abs(fed),
    Math.abs(capacity),
    Math.abs(spent),
  );
  return (
    <View className="gap-1 pb-3">
      <BarRow
        label="capacity"
        value={capacity}
        maxAbs={maxAbs}
        color={capacity < 0 ? colors.errorDark : colors.primary}
        dashed
      />
      <FedBarRow
        fed={fed}
        pendingFedAdjustment={pendingFedAdjustment}
        maxAbs={maxAbs}
      />
      {rule !== "instant_settlement" ? (
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
