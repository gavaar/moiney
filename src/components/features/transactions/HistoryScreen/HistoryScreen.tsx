import { useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "@convex/_generated/dataModel";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import {
  PipeCatalogProvider,
  usePipeCatalog,
} from "@features/pipes/context/PipeCatalogContext";
import { MixedHistoryFeed } from "@features/transactions/history/mixed-history-feed";
import type { HistoryFilters } from "@features/transactions/history/history-filters";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { useUtcMonthStart } from "@/lib/useUtcMonthStart";

type FilterDraft = {
  fromDate: Date | null;
  toDate: Date | null;
  pipeIds: Id<"pipes">[];
  title: string;
};

function emptyDraft(): FilterDraft {
  return { fromDate: null, toDate: null, pipeIds: [], title: "" };
}

function HistoryFilterControls({
  onApply,
  initialFromDate,
}: {
  onApply: (filters: HistoryFilters) => void;
  initialFromDate: number;
}) {
  const { allPipes } = usePipeCatalog();
  const [draft, setDraft] = useState<FilterDraft>(() => ({
    ...emptyDraft(),
    fromDate: new Date(initialFromDate),
  }));
  const previousDefault = useRef(initialFromDate);
  useEffect(() => {
    if (previousDefault.current === initialFromDate) return;
    const oldDefault = previousDefault.current;
    previousDefault.current = initialFromDate;
    setDraft((current) =>
      current.fromDate?.getTime() === oldDefault &&
      current.toDate === null && current.pipeIds.length === 0 && !current.title
        ? { ...current, fromDate: new Date(initialFromDate) }
        : current,
    );
  }, [initialFromDate]);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
      setError("From date must not be after to date.");
      return;
    }
    setError(null);
    const title = draft.title.trim().toLowerCase();
    onApply({
      ...(draft.fromDate
        ? {
            fromDate: Date.UTC(
              draft.fromDate.getUTCFullYear(),
              draft.fromDate.getUTCMonth(),
              draft.fromDate.getUTCDate(),
            ),
          }
        : {}),
      ...(draft.toDate
        ? {
            toDate: Date.UTC(
              draft.toDate.getUTCFullYear(),
              draft.toDate.getUTCMonth(),
              draft.toDate.getUTCDate(),
              23,
              59,
              59,
              999,
            ),
          }
        : {}),
      ...(draft.pipeIds.length > 0 ? { pipeIds: draft.pipeIds } : {}),
      ...(title ? { title } : {}),
    });
  };

  const clear = () => {
    setDraft(emptyDraft());
    setError(null);
    onApply({});
  };

  return (
    <View className="border-b border-border pb-3 gap-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-3 px-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-48">
          <Input
            type="text"
            hideLabel
            label="Title contains"
            value={draft.title}
            onChange={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="Any title"
          />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-32">
            <Input
              type="date"
              hideLabel
              label="From date"
              value={draft.fromDate}
              onChange={(fromDate) => setDraft((current) => ({ ...current, fromDate }))}
              placeholder="From"
            />
          </View>
          <Text className="text-muted">-</Text>
          <View className="w-32">
            <Input
              type="date"
              hideLabel
              label="To date"
              value={draft.toDate}
              onChange={(toDate) => setDraft((current) => ({ ...current, toDate }))}
              placeholder="To"
            />
          </View>
        </View>
        <View className="w-40">
          <Input
            type="select"
            multiple
            hideLabel
            label="Pipes"
            items={allPipes ?? []}
            renderItem={(pipe) => <Text className="text-text">{pipe.name}</Text>}
            value={draft.pipeIds}
            onChange={(pipeIds) =>
              setDraft((current) => ({ ...current, pipeIds: pipeIds as Id<"pipes">[] }))
            }
            placeholder="Any pipe"
          />
        </View>
        <Button
          title="Clear"
          accessibilityLabel="Clear filters"
          variant="muted"
          onPress={clear}
        />
        <Button title="Apply" accessibilityLabel="Apply filters" onPress={apply} />
      </ScrollView>
      {error ? (
        <Text accessibilityRole="alert" className="px-4 text-sm text-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function HistoryScreen() {
  const initialFromDate = useUtcMonthStart(useIsFocused());
  const [customFilters, setCustomFilters] = useState<HistoryFilters | null>(null);
  const filters = useMemo(() => customFilters ?? { fromDate: initialFromDate }, [customFilters, initialFromDate]);

  return (
    <PipeCatalogProvider>
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
        <AppScreenHeader title="History" />
        <HistoryFilterControls onApply={setCustomFilters} initialFromDate={initialFromDate} />

        <MixedHistoryFeed filters={filters} />
      </SafeAreaView>
    </PipeCatalogProvider>
  );
}
