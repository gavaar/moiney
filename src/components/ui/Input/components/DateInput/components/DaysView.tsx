import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/styles";
import { WEEKDAY_LABELS, getMonthGrid, type Cursor } from "../calendar";

const CELL = "h-9 w-9 items-center justify-center rounded-full";

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
    <>
      <View className="flex-row gap-1 mb-1">
        {WEEKDAY_LABELS.map((w, index) => (
          <View key={index} className={CELL}>
            <Text className="text-muted text-xs">{w}</Text>
          </View>
        ))}
      </View>
      <View className="gap-1">
        {Array.from({ length: 6 }, (_, week) => {
          const cells = grid.slice(week * 7, week * 7 + 7);
          return (
            <View key={week} className="flex-row gap-1">
              {cells.map((cell, index) => {
                const idx = week * 7 + index;
                if (cell === null) {
                  return <View key={`empty-${idx}`} className={CELL} />;
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
          );
        })}
      </View>
    </>
  );
}
