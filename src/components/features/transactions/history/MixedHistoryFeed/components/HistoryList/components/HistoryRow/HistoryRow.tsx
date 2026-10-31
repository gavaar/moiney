import { memo } from "react";
import { Text } from "react-native";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeCatalogContextValue } from "@features/pipes/context/PipeCatalogContext";
import { PIPE_KINDS } from "@features/pipes/rules/config";
import { colors } from "@/lib/styles";
import { StackedTransactionItem } from "@features/transactions/components/StackedTransactionItem";
import { EventTransactionItem } from "./components/EventTransactionItem/EventTransactionItem";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";
import type { HistoryRowItem } from "../../history-rows";
import { PipeHistoryRow } from "./components/PipeHistoryRow/PipeHistoryRow";
import { SettlementHistoryRow } from "./components/SettlementHistoryRow/SettlementHistoryRow";

type Props = {
  item: HistoryRowItem;
  expanded: boolean;
  pipesById: PipeCatalogContextValue["pipesById"];
  childrenByParent: PipeCatalogContextValue["childrenByParent"];
  deletedPipeIcons: ReadonlyMap<Id<"pipes">, string>;
  onToggle: (key: string) => void;
  onShowEditHistory: (id: Id<"events">, title: string) => void;
  onShowSettlement: (event: SettlementEntry) => void;
};
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export const HistoryRow = memo(function HistoryRow({ item, expanded, pipesById, childrenByParent, deletedPipeIcons, onToggle, onShowEditHistory, onShowSettlement }: Props) {
  if (item.kind === "month") return <Text className="text-sm text-muted mt-3 mb-1">{monthFormatter.format(new Date(`${item.month}-01T00:00:00Z`))}</Text>;
  if (item.kind === "archive") return <PipeHistoryRow event={item.archive.event} expanded={expanded}
    summary={item.archive.loadedSummary} date={item.archive.latestDate} onPress={() => onToggle(item.key)} />;
  const row = item.row;
  if (row.kind === "settlement") {
    const pipe = pipesById?.[row.event.pipeId];
    const event = pipe ? { ...row.event, name: pipe.name, icon: pipe.icon } : row.event;
    return <SettlementHistoryRow event={event} onPress={() => onShowSettlement(event)} />;
  }
  if (row.kind === "lifecycle") {
    const pipe = pipesById?.[row.event.pipeId];
    const parent = pipe?.parentId ? pipesById?.[pipe.parentId] : undefined;
    const event = pipe ? { ...row.event, name: pipe.name, icon: pipe.icon, parentName: parent?.name, parentIcon: parent?.icon } : row.event;
    const pipeKind = pipe ? pipe.parentId ? pipe.rule ?? "none" : pipe.sourceType ?? "feed" : undefined;
    const pipeColor = pipe?.parentId && (childrenByParent.get(pipe.id)?.length ?? 0) > 0
      ? colors.muted : pipeKind ? PIPE_KINDS[pipeKind].color : undefined;
    return <PipeHistoryRow event={event} expanded={false} pipeColor={pipeColor} archived={deletedPipeIcons.has(event.pipeId)} />;
  }
  return row.kind === "group"
    ? <StackedTransactionItem group={{ ...row, snapshotIcon: deletedPipeIcons.get(row.visiblePipeIds[0]) }}
        expanded={expanded} onToggle={() => onToggle(item.key)} />
    : <EventTransactionItem operation={row.operation} deletedPipeIcons={deletedPipeIcons}
        onShowEditHistory={id => onShowEditHistory(id, row.operation.title)} />;
});
