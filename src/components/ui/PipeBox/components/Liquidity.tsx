/**
 * Show the liquidity values in a bar ux.
 * It receives fed, capacity and spent.
 * The bar will take as a 100% the biggest of these three values.
 * 
 * If fed is bigger than capacity, it will fill the capacity bar with a color, and then the overfed value will be in light blue.
 * If spent is bigger than fed, it will change its color to red. The fed bar has opacity.
 * All three bars are positioned overlaying one another. If any of these values is 0, that bar is not shown.
 */

import { colors } from '@/lib/styles';
import { View } from 'react-native';

function FedBar({ fed, capacity, biggest }: { fed: number; capacity: number; biggest: number }) {
  const overfed = Math.max(0, fed - capacity);
  const limitedFed = Math.min(fed, capacity);
  const overfedW = overfed / biggest;
  const limitedFedW = limitedFed / biggest;
  const fedW = limitedFedW + overfedW;

  return (
    <View testID="fed-bar" className="flex flex-row absolute top-0 left-0 right-0 bottom-0">
      <View
        testID="fed-bar-filled"
        style={{
          flexGrow: limitedFedW,
          backgroundColor: colors.primary,
        }}
      />
      <View
        testID="fed-bar-overfed"
        style={{
          flexGrow: overfedW,
          backgroundColor: colors.secondary,
        }}
      />
      <View
        style={{
          flexGrow: 1 - fedW,
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
};

function SpentBar({ spent, biggest, fed }: { spent: number; biggest: number; fed: number; }) {
  const spentW = spent / biggest;
  const spentColor = spent > fed ? colors.error : colors.primaryDark;

  return (
    <View testID="spent-bar" className="flex flex-row absolute top-0 left-0 right-0 bottom-0">
      <View
        testID="spent-bar-filled"
        style={{
          flexGrow: spentW,
          backgroundColor: `${spentColor}BF`,
        }}
      />
      <View
        style={{
          flexGrow: 1 - spentW,
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
};

function CapacityBar({ capacity, biggest }: { capacity: number; biggest: number }) {
  const capacityW = capacity / biggest;

  return (
    <View testID="capacity-bar" className="flex flex-row absolute top-0 left-0 right-0 bottom-0">
      <View
        testID="capacity-bar-filled"
        style={{
          flexGrow: capacityW,
          borderColor: `${colors.primary}`,
          borderStyle: "dashed",
          borderRightWidth: 2,
          backgroundColor: `${colors.primary}11`,
        }}
      />
      <View
        style={{
          flexGrow: 1 - capacityW,
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
}

export function Liquidity({ fed, capacity, spent }: { fed: number; capacity: number; spent: number }) {
  const biggest = Math.max(fed, capacity, spent);

  return <View testID="liquidity" className="flex-1 relative">
    {fed !== 0 &&
      <FedBar fed={fed} capacity={capacity} biggest={biggest} />
    }
    {spent !== 0 &&
      <SpentBar spent={spent} biggest={biggest} fed={fed} />
    }
    {capacity !== 0 &&
      <CapacityBar capacity={capacity} biggest={biggest} />
    }
  </View>;
};
