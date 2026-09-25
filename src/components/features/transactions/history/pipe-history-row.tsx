import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import type { ArchiveSummary, PipeHistoryEvent } from "./history-data";

type Props = {
  event: PipeHistoryEvent; expanded: boolean; onPress: () => void;
  summary?: ArchiveSummary; summaryError?: boolean;
  onLoadSummary?: (event: PipeHistoryEvent) => void;
};
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function PipeHistoryRow({ event, expanded, onPress, summary, summaryError, onLoadSummary }: Props) {
  const deleted = event.deletedAt !== undefined;
  useEffect(() => {
    if (deleted) onLoadSummary?.(event);
  }, [deleted, event, onLoadSummary]);
  const emptyArchive = deleted && summary?.count === 0;
  const borderColor = emptyArchive ? colors.muted : event.pipeType === "boiler" ? colors.secondary : event.pipeType === "feed" ? colors.primary : colors.text;
  const toggleLabel = `${expanded ? "Collapse" : "Expand"} ${event.name} history`;
  const rowClass = "flex-1 rounded-2xl border bg-surface px-2 py-2 gap-1";
  const content = <>
    <View className="flex-row items-center gap-1">
      {event.parentName ? <>
        {event.parentIcon ? <Icon name={safeIconName(event.parentIcon)} size={14} color={colors.muted} /> : null}
        <Text numberOfLines={1} className="text-muted text-xs max-w-24">{event.parentName} ›</Text>
      </> : null}
      <Icon name={safeIconName(event.icon)} size={16} color={borderColor} />
      <Text numberOfLines={1} className={`${emptyArchive ? "text-muted" : "text-text"} font-bold text-sm flex-1`}>{event.name}</Text>
      {deleted ? <Text className="text-muted text-xs">Deleted</Text> : null}
      <Text className={emptyArchive ? "text-muted text-xs" : "text-text text-xs"}>{dateFormatter.format(emptyArchive ? event.deletedAt! : event.occurredAt)}</Text>
    </View>
    {deleted && !emptyArchive ? (
      <View className="flex-row items-center justify-between gap-2">
        {summary ? <>
          <Text className="text-muted text-xs flex-1">{summary.oldestDate !== null && summary.latestDate !== null
            ? `${dateFormatter.format(summary.oldestDate)} – ${dateFormatter.format(summary.latestDate)}` : "No retained transactions"}</Text>
          <Text className="text-text font-bold text-sm">Spent: {formatAmount(summary.spent)}</Text>
        </> : <Text className="text-muted text-xs">{summaryError ? "Totals unavailable · pull to refresh" : "Loading totals…"}</Text>}
      </View>
    ) : null}
  </>;
  return (
    <View className="flex-row gap-1">
      {deleted && !emptyArchive ? (
        <Pressable accessibilityRole="button" accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded }} onPress={onPress}
          className="self-stretch rounded-full border border-border px-2 flex-row items-center justify-center gap-0.5 bg-surface">
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={12} color={colors.muted} />
          <Text className="text-muted text-xs font-bold">{summary ? `x${summary.count}` : "x…"}</Text>
        </Pressable>
      ) : null}
      {emptyArchive ? <View className={rowClass} style={{ borderColor }}>{content}</View> :
        <Pressable accessibilityRole="button" accessibilityLabel={deleted ? `${event.name} archived history` : `Open ${event.name}`}
          accessibilityState={deleted ? { expanded } : undefined} onPress={onPress}
          className={rowClass} style={{ borderColor }}>{content}</Pressable>}
    </View>
  );
}
