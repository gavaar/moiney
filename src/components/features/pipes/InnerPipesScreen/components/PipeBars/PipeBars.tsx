import { DimensionValue, Text, View } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import type { PipeRule } from "@domain/pipes/rules";

type PipeBarsProps = {
  fed: number;
  spent: number;
  capacity: number;
  expected: number;
  pendingFedAdjustment?: number;
  rule?: PipeRule;
  sourceType?: "feed" | "boiler";
  coverageProvidedCents?: number;
};

// todo: unify BarRow and FedBarRow into a single component that can handle both cases, since they share a lot of logic and styling.
function BarRow({
  label,
  value,
  maxAbs,
  color,
  dashed,
  coverageProvidedCents = 0,
}: {
  label: string;
  value: number;
  maxAbs: number;
  color: string;
  dashed?: boolean;
  coverageProvidedCents?: number;
}) {
  const w = `${(Math.abs(value) / maxAbs) * 100}%` as DimensionValue;
  const anchorClass = value < 0 ? "right-0" : "left-0";

  return (
    <View className="flex-row items-center" accessible={coverageProvidedCents > 0} accessibilityLabel={coverageProvidedCents > 0 ? `${formatAmount(value)} spent, ${formatAmount(coverageProvidedCents)} possible coverage provided` : undefined}>
      <Text className="text-muted text-xs w-16">{label}</Text>
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
        {coverageProvidedCents > 0 ? (
          <View
            testID={`bar-${label}-coverage-fill`}
            className="absolute"
            style={{
              left: `${(Math.max(0, value) / maxAbs) * 100}%`,
              width: `${(coverageProvidedCents / maxAbs) * 100}%`,
              top: 0,
              bottom: 0,
              backgroundColor: colors.warningMuted,
              borderRadius: 1,
            }}
          />
        ) : null}
      </View>
      <Text className="text-xs w-16 text-right text-text">
        {formatAmount(value + coverageProvidedCents)}
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
      <Text className="text-muted text-xs w-16">fed</Text>
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
  expected,
  pendingFedAdjustment = 0,
  rule,
  sourceType,
  coverageProvidedCents = 0,
}: PipeBarsProps) {
  const showSpent = rule !== "instant_settlement" || coverageProvidedCents > 0;
  const maxAbs = Math.max(
    1,
    Math.abs(fed),
    sourceType === "boiler" ? Math.abs(capacity) : 0,
    showSpent ? Math.abs(spent) : 0,
    showSpent && coverageProvidedCents > 0 ? Math.abs(spent) + coverageProvidedCents : 0,
    Math.abs(expected),
  );
  return (
    <View className="gap-1 pb-3">
      <FedBarRow
        fed={fed}
        pendingFedAdjustment={pendingFedAdjustment}
        maxAbs={maxAbs}
      />
      {expected !== 0 ? (
        <BarRow
          label="expected"
          value={expected}
          maxAbs={maxAbs}
          color={expected < 0 ? colors.errorDark : colors.error}
          dashed
        />
      ) : null}
      {sourceType === "boiler" && capacity !== 0 ? (
        <BarRow
          label="contributed"
          value={capacity}
          maxAbs={maxAbs}
          color={capacity < 0 ? colors.errorDark : colors.primary}
          dashed
        />
      ) : null}
      {showSpent ? (
        <BarRow
          label="spent"
          value={spent}
          maxAbs={maxAbs}
          color={spent < 0 ? colors.primary : colors.error}
          coverageProvidedCents={coverageProvidedCents}
        />
      ) : null}
    </View>
  );
}
