import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { PIPE_KINDS } from "@features/pipes/rules/config";
import { HistoryEventMarker } from "../components/HistoryEventMarker/HistoryEventMarker";
import type { HistoryEntry } from "./event-groups";
import type { EventArchiveSummary } from "./event-archives";

type LifecycleEntry = Extract<HistoryEntry, { type: "pipe_creation" | "pipe_deletion" }>;
type Props = { event: LifecycleEntry; expanded: boolean; onPress?: () => void; summary?: EventArchiveSummary; date?: number; archived?: boolean; pipeColor?: string };
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function PipeHistoryRow({ event, expanded, onPress, summary, date = event.occurredAt, archived = false, pipeColor = PIPE_KINDS[event.pipeType === "pipe" ? "none" : event.pipeType].color }: Props) {
  const deleted = archived || event.type === "pipe_deletion" || summary !== undefined;
  const expandable = deleted && summary !== undefined && summary.count > 0;
  const borderColor = deleted ? colors.muted : pipeColor;
  const eventLabel = event.type === "pipe_creation" ? "pipe created" : "pipe deleted";
  const recordLabel = [
    event.name,
    eventLabel,
    event.parentName ? `parent ${event.parentName}` : undefined,
    dateFormatter.format(date),
    deleted && event.type === "pipe_creation" ? "pipe now deleted" : undefined,
  ].filter(Boolean).join(", ");
  const rowClass = "flex-1 rounded-2xl border bg-surface px-2 py-2 gap-1";
  const content = <>
    <View className="flex-row items-center gap-1">
      {event.parentName ? <>
        {event.parentIcon ? <Icon name={safeIconName(event.parentIcon)} size={14} color={colors.muted} /> : null}
        <Text numberOfLines={1} className="text-muted text-xs max-w-24">{event.parentName} ›</Text>
      </> : null}
      <Icon name={safeIconName(event.icon)} size={16} color={borderColor} />
      <Text numberOfLines={1} className={`${deleted && !expandable ? "text-muted" : "text-text"} font-bold text-sm flex-1`}>{event.name}</Text>
      {deleted ? <Text className="text-muted text-xs">Deleted</Text> : null}
      <Text className="text-muted text-xs">{dateFormatter.format(date)}</Text>
    </View>
    {expandable && summary ? <View className="flex-row items-center justify-between gap-2">
      <Text className="text-muted text-xs flex-1">{summary.oldestDate !== null && summary.latestDate !== null
        ? `${dateFormatter.format(summary.oldestDate)} – ${dateFormatter.format(summary.latestDate)}` : "No loaded transactions"}</Text>
      <Text className="text-text font-bold text-sm">Spent: {formatAmount(summary.spent)}</Text>
    </View> : null}
  </>;
  return <View className="flex-row gap-1">
    <HistoryEventMarker eventType={event.type} size={16} color={event.type === "pipe_creation" ? pipeColor : colors.error} />

    {!expandable
      ? <View accessible accessibilityLabel={recordLabel} className={rowClass} style={{ borderColor }}>
          {content}
        </View>
       : <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${event.name} archived history`}
          accessibilityHint={eventLabel}
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={onPress}
          className={rowClass}
          style={{ borderColor }}>
            {content}
        </Pressable>}
    {expandable && <Pressable accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${event.name} history`}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      className="self-stretch rounded-full border border-border px-2 flex-row items-center justify-center gap-0.5 bg-surface">
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={12} color={colors.muted} />
        <Text className="text-muted text-xs font-bold">
          x{summary.count}
        </Text>
    </Pressable>}
  </View>;
}
