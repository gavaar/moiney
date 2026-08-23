import { colors } from '@/lib/styles';
import { View } from 'react-native';

export function Liquidity({ fed, capacity, spent }: { fed: number; capacity: number; spent: number }) {
  const biggest = Math.max(1, Math.abs(fed), Math.abs(capacity), Math.abs(spent));
  const hasNegative = fed < 0 || capacity < 0;
  const hasPositive = fed > 0 || capacity > 0;

  return (
    <View testID="liquidity" className="flex-1 relative">
      <View className="flex-row flex-1">
        {hasNegative && (
          <View
            testID="liquidity-left"
            className="flex-1 overflow-hidden relative"
            style={{ flex: hasPositive ? 1 : undefined }}
          >
            {capacity < 0 && (
              <View
                testID="debt-cap-bar"
                style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: `${(Math.abs(capacity) / biggest) * 100}%`,
                  borderColor: colors.errorDark,
                  borderStyle: 'dashed',
                  borderLeftWidth: 2,
                  backgroundColor: `${colors.errorDark}11`,
                }}
              />
            )}
            {fed < 0 && (
              <View
                testID="debt-bar"
                style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: `${(Math.abs(fed) / biggest) * 100}%`,
                  backgroundColor: colors.error,
                }}
              />
            )}
            {fed < 0 && spent > 0 && (
              <View
                testID="debt-spent-bar"
                style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: `${(spent / biggest) * 100}%`,
                  backgroundColor: `${colors.errorBright}CC`,
                }}
              />
            )}
          </View>
        )}

        {hasNegative && hasPositive && (
          <View style={{ width: 1, backgroundColor: colors.text }} />
        )}

        {hasPositive && (
          <View
            testID="liquidity-right"
            className="flex-1 overflow-hidden relative"
            style={{ flex: hasNegative ? 1 : undefined }}
          >
            {capacity > 0 && (
              <View
                testID="capacity-bar"
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(capacity / biggest) * 100}%`,
                  borderColor: colors.primary,
                  borderStyle: 'dashed',
                  borderRightWidth: 2,
                  backgroundColor: `${colors.primary}11`,
                }}
              />
            )}
            {fed > 0 && capacity > 0 && fed > capacity && (
              <View
                testID="fed-bar-overfed"
                style={{
                  position: 'absolute', left: `${(capacity / biggest) * 100}%`, top: 0, bottom: 0,
                  width: `${((fed - capacity) / biggest) * 100}%`,
                  backgroundColor: colors.secondary,
                }}
              />
            )}
            {fed > 0 && (
              <View
                testID="fed-bar"
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(Math.min(fed, capacity > 0 ? capacity : fed) / biggest) * 100}%`,
                  backgroundColor: colors.primary,
                }}
              />
            )}
            {spent > 0 && fed >= 0 && (
              <View
                testID="spent-bar"
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(spent / biggest) * 100}%`,
                  backgroundColor: `${spent > Math.max(fed, 0) ? colors.error : colors.surface}CC`,
                }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}
