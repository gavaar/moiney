import { memo, useRef, useState, type ReactNode } from "react";
import { FlatList, Platform, Pressable, Text, useWindowDimensions, View, type KeyDownEvent, type ViewInstance } from "react-native";
import { PipeBox, type ChildSnapshot } from "@features/pipes/components/PipeBox";
import { Popover } from "@ui/Popover";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { prepareContingencyPreview } from "@features/pipes/data/contingencyPreview";
import { usePipeViewPreferences } from "@features/pipes/preferences/usePipeViewPreferences";
import { MinimizedPipe } from "./MinimizedPipe";

export type Pipe = Pick<
  PipeModel,
  | "id"
  | "name"
  | "icon"
  | "priority"
  | "capacity"
  | "fed"
  | "spent"
  | "sourceType"
  | "contributedFed"
  | "deletionJobId"
  | "rule"
  | "cronNextDate"
  | "cronInterval"
>;

type PipesListProps = {
  pipes: Pipe[];
  onSelectPipe?: (id: PipeModel["id"]) => void;
  leading?: (pipe: Pipe) => ReactNode;
  trailing?: (pipe: Pipe) => ReactNode;
  priority?: boolean;
  footer?: ReactNode;
  compactAction?: {
    label: (pipe: Pipe) => string | null;
    onPress: (pipe: Pipe) => void;
  };
};

type ListRow =
  | { kind: "full"; key: string; pipe: Pipe; index: number }
  | { kind: "compact"; key: string; pipes: Pipe[] };

const TILE_WIDTH = 64;
const GAP = 8;

export const PipesList = memo(function PipesList({
  pipes,
  onSelectPipe,
  leading,
  trailing,
  priority = false,
  footer,
  compactAction,
}: PipesListProps) {
  const { childrenByParent, allPipes } = usePipeCatalog();
  const contingencyPreview = prepareContingencyPreview(allPipes ?? []);
  const { ready, minimized, minimize, maximize } = usePipeViewPreferences(allPipes?.map((pipe) => pipe.id));
  const [menuPipe, setMenuPipe] = useState<Pipe | null>(null);
  const anchorRef = useRef<ViewInstance>(null);
  const rowRefs = useRef(new Map<Pipe["id"], ViewInstance>());
  const minimizedPipes = pipes.filter((pipe) => minimized.has(pipe.id));
  const fullPipes = pipes.filter((pipe) => !minimized.has(pipe.id));
  const { width: windowWidth } = useWindowDimensions();
  const [listWidth, setListWidth] = useState(0);
  const columns = Math.max(1, Math.floor(((listWidth || windowWidth) + GAP) / (TILE_WIDTH + GAP)));
  const rows: ListRow[] = fullPipes.map((pipe, index) => ({ kind: "full", key: pipe.id, pipe, index }));
  // Compact rows share the same virtualizer; a footer grid would still mount every tile.
  for (let offset = 0; offset < minimizedPipes.length; offset += columns) {
    const group = minimizedPipes.slice(offset, offset + columns);
    rows.push({ kind: "compact", key: `compact:${group[0].id}`, pipes: group });
  }
  const openMenu = (pipe: Pipe) => {
    const anchor = rowRefs.current.get(pipe.id);
    if (!anchor) return;
    anchorRef.current = anchor;
    setMenuPipe(pipe);
  };
  const closeMenu = () => setMenuPipe(null);
  const webMenuEvents = (pipe: Pipe) => Platform.OS === "web" ? {
    onContextMenu: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      openMenu(pipe);
    },
    onKeyDown: (event: KeyDownEvent | { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      const { key, shiftKey } = "key" in event ? event : event.nativeEvent;
      if (key !== "ContextMenu" && !(key === "F10" && shiftKey)) return;
      event.preventDefault();
      openMenu(pipe);
    },
  } : {};

  return (
    <View className="flex-1" onLayout={({ nativeEvent }) => setListWidth(nativeEvent.layout.width)}>
      <FlatList
        data={ready ? rows : []}
        keyExtractor={row => row.key}
        contentContainerStyle={{ flexGrow: 1, gap: GAP }}
        renderItem={({ item: row }) => {
          if (row.kind === "compact") return (
            <View testID="minimized-pipes" className="flex-row gap-2">
              {row.pipes.map(item => (
                <View key={item.id}
                  ref={view => { if (view) rowRefs.current.set(item.id, view); else rowRefs.current.delete(item.id); }}
                  {...webMenuEvents(item)}>
                  <MinimizedPipe pipe={item} onPress={() => onSelectPipe?.(item.id)} onLongPress={() => openMenu(item)} />
                </View>
              ))}
            </View>
          );
          const { pipe: item, index: idx } = row;
          const coverage = contingencyPreview.forSource(item.id);
          const childBoxes: ChildSnapshot[] = (childrenByParent.get(item.id) ?? []).map((child) => ({
            icon: child.icon,
            capacity: child.capacity ?? 0,
            fed: child.fed ?? 0,
            spent: child.spent ?? 0,
          }));

          return (
            <View
              className="flex-row items-center"
              ref={(view) => { if (view) rowRefs.current.set(item.id, view); else rowRefs.current.delete(item.id); }}
              {...webMenuEvents(item)}
            >
              {leading?.(item)}
              <PipeBox
                name={item.name}
                icon={item.icon}
                priority={item.priority}
                capacity={item.sourceType === "boiler" ? (item.contributedFed ?? 0) : item.capacity}
                fed={item.fed}
                spent={item.spent}
                coverageDonor={coverage?.donor}
                coverageAmountCents={coverage?.amountCents}
                coverageProvidedCents={contingencyPreview.forDonor(item.id)?.amountCents}
                showPriority={priority && item.priority !== fullPipes[idx - 1]?.priority}
                {...{ children: childBoxes }}
                onPress={() => onSelectPipe?.(item.id)}
                onLongPress={() => openMenu(item)}
              />
              {trailing?.(item)}
            </View>
          );
        }}
        ListFooterComponent={footer ? <View>{footer}</View> : undefined}
      />
      <Popover visible={menuPipe !== null} onClose={closeMenu} anchorRef={anchorRef}>
        {menuPipe && (
          <View className="gap-2">
            <Pressable accessibilityRole="button" className="px-2 py-1" onPress={() => {
              if (minimized.has(menuPipe.id)) maximize(menuPipe.id);
              else minimize(menuPipe.id);
              closeMenu();
            }}>
              <Text className="text-text text-sm">{minimized.has(menuPipe.id) ? "Maximize" : "Minimize"}</Text>
            </Pressable>
            {minimized.has(menuPipe.id) && compactAction?.label(menuPipe) && (
              <Pressable accessibilityRole="button" className="px-2 py-1" onPress={() => {
                const pipe = menuPipe;
                closeMenu();
                compactAction.onPress(pipe);
              }}>
                <Text className="text-text text-sm">{compactAction.label(menuPipe)}</Text>
              </Pressable>
            )}
          </View>
        )}
      </Popover>
    </View>
  );
});
