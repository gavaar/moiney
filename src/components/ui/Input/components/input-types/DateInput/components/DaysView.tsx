import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/styles";
import { WEEKDAY_LABELS, getMonthGrid, type Cursor } from "../calendar";

const CELL = "h-9 w-9 items-center justify-center rounded-full";
const COLUMN = "items-center";
const COLUMN_STYLE = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

type Today = { year: number; month: number; day: number };

type Props = {
  cursor: Cursor;
  value: Date;
  today: Today;
  onSelectDay: (day: number) => void;
};

type DayCellProps = {
  day: number;
  selected: boolean;
  isToday: boolean;
  onPress: (day: number) => void;
};

const DayCell = memo(function DayCell({ day, selected, isToday, onPress }: DayCellProps) {
  return (
    <Pressable
      testID={`day-${day}`}
      aria-selected={selected}
      aria-current={isToday ? "date" : undefined}
      onPress={() => onPress(day)}
      className={cn(CELL, selected ? "bg-primary" : isToday ? "border border-primary" : "")}
    >
      <Text
        className={cn(
          "text-sm",
          selected ? "text-background" : isToday ? "text-primary" : "text-muted",
        )}
      >
        {day}
      </Text>
    </Pressable>
  );
});

export function DaysView({ cursor, value, today, onSelectDay }: Props) {
  const grid = useMemo(
    () => getMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const selectedYear = value.getUTCFullYear();
  const selectedMonth = value.getUTCMonth();
  const selectedDay = value.getUTCDate();

  return (
    <View className="w-full flex-row">
      {WEEKDAY_LABELS.map((weekday, index) => (
        <View key={index} className={COLUMN} style={COLUMN_STYLE}>
          <View className="h-9 mb-1 items-center justify-center">
            <Text className="text-primary font-bold text-xs">{weekday}</Text>
          </View>
          <View className="gap-1 items-center">
            {Array.from({ length: 6 }, (_, week) => {
              const idx = week * 7 + index;
              const cell = grid[idx];
              if (cell === null) {
                return <View key={`empty-${idx}`} className="h-9" />;
              }
              const isSelected =
                selectedYear === cursor.year &&
                selectedMonth === cursor.month &&
                selectedDay === cell;
              const isToday =
                today.year === cursor.year &&
                today.month === cursor.month &&
                today.day === cell;
              return (
                <DayCell
                  key={`day-${cell}`}
                  day={cell}
                  selected={isSelected}
                  isToday={isToday}
                  onPress={onSelectDay}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
