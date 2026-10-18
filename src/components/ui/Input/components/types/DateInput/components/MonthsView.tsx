import { View } from "react-native";
import { MONTH_LABELS, type Cursor } from "../calendar";
import { PickerCell } from "./PickerCell";

type Props = {
  cursor: Cursor;
  value: Date;
  onSelectMonth: (month: number) => void;
};

export function MonthsView({ cursor, value, onSelectMonth }: Props) {
  const selectedYear = value.getUTCFullYear();
  const selectedMonth = value.getUTCMonth();

  return (
    <View className="gap-2">
      {Array.from({ length: 3 }, (_, row) => (
        <View key={row} className="flex-row gap-2">
          {Array.from({ length: 4 }, (_, col) => {
            const month = row * 4 + col;
            const isSelected = selectedYear === cursor.year && selectedMonth === month;
            return (
              <PickerCell
                key={month}
                testID={`month-${month}`}
                selected={isSelected}
                label={MONTH_LABELS[month]}
                onPress={() => onSelectMonth(month)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
