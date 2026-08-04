import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import {
  addMonths,
  buildUtcNoon,
  monthLabel,
  yearRangeLabel,
  type Cursor,
} from "../calendar";
import { DaysView } from "./DaysView";
import { MonthsView } from "./MonthsView";
import { YearsView } from "./YearsView";

type ViewMode = "days" | "months" | "years";

type Props = {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
};

const NEXT_VIEW: Record<ViewMode, ViewMode> = {
  days: "months",
  months: "years",
  years: "days",
};

const NAV_DELTA: Record<ViewMode, number> = {
  days: 1,
  months: 12,
  years: 10,
};

function cursorFromValue(value: Date): Cursor {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() };
}

export function Calendar({ visible, value, onChange, onClose }: Props) {
  const [view, setView] = useState<ViewMode>("days");
  const [cursor, setCursor] = useState<Cursor>(() => cursorFromValue(value));

  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, []);

  const title =
    view === "days"
      ? monthLabel(cursor.year, cursor.month)
      : view === "months"
        ? String(cursor.year)
        : yearRangeLabel(cursor.year);

  const handleTitlePress = useCallback(() => {
    setView((v) => NEXT_VIEW[v]);
  }, []);

  const handlePrev = useCallback(() => {
    setCursor((c) =>
      view === "years"
        ? { ...c, year: c.year - NAV_DELTA.years }
        : addMonths(c, -NAV_DELTA[view]),
    );
  }, [view]);

  const handleNext = useCallback(() => {
    setCursor((c) =>
      view === "years"
        ? { ...c, year: c.year + NAV_DELTA.years }
        : addMonths(c, NAV_DELTA[view]),
    );
  }, [view]);

  const handleSelectDay = useCallback(
    (day: number) => {
      onChange(buildUtcNoon(cursor.year, cursor.month, day));
      onClose();
    },
    [cursor, onChange, onClose],
  );

  const handleSelectMonth = useCallback((month: number) => {
    setCursor((c) => ({ ...c, month }));
    setView("days");
  }, []);

  const handleSelectYear = useCallback((year: number) => {
    setCursor((c) => ({ ...c, year }));
    setView("months");
  }, []);

  const handleToday = useCallback(() => {
    onChange(buildUtcNoon(today.year, today.month, today.day));
    onClose();
  }, [today, onChange, onClose]);

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View className="w-[280px]">
        <View className="flex-row items-center justify-between mb-2">
          <Pressable
            testID="calendar-prev"
            onPress={handlePrev}
            hitSlop={8}
            className="p-2 rounded-full"
          >
            <Icon name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            testID="calendar-title"
            onPress={handleTitlePress}
            hitSlop={8}
            className="px-2 py-1 rounded-lg"
          >
            <Text className="text-text font-semibold text-base">{title}</Text>
          </Pressable>
          <Pressable
            testID="calendar-next"
            onPress={handleNext}
            hitSlop={8}
            className="p-2 rounded-full"
          >
            <Icon name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {view === "days" ? (
          <DaysView cursor={cursor} value={value} today={today} onSelectDay={handleSelectDay} />
        ) : null}
        {view === "months" ? (
          <MonthsView cursor={cursor} value={value} onSelectMonth={handleSelectMonth} />
        ) : null}
        {view === "years" ? (
          <YearsView cursor={cursor} value={value} onSelectYear={handleSelectYear} />
        ) : null}

        <Pressable testID="calendar-today" onPress={handleToday} className="items-center py-1">
          <Text className="text-primary text-sm font-medium">Today</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}
