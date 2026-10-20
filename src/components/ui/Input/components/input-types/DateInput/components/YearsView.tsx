import { useMemo } from "react";
import { View } from "react-native";
import { getYearRange, type Cursor } from "../calendar";
import { PickerCell } from "./PickerCell";

type Props = {
  cursor: Cursor;
  value: Date;
  onSelectYear: (year: number) => void;
};

export function YearsView({ cursor, value, onSelectYear }: Props) {
  const yearRange = useMemo(() => getYearRange(cursor.year), [cursor.year]);
  const selectedYear = value.getUTCFullYear();

  return (
    <View className="gap-2">
      {Array.from({ length: 5 }, (_, row) => (
        <View key={row} className="flex-row gap-2">
          {yearRange.slice(row * 2, row * 2 + 2).map((year) => {
            const isSelected = selectedYear === year;
            return (
              <PickerCell
                key={year}
                testID={`year-${year}`}
                selected={isSelected}
                label={String(year)}
                onPress={() => onSelectYear(year)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
