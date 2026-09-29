import { memo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { PipeBox, type ChildSnapshot } from "@features/pipes/components/PipeBox";
import { Popover } from "@ui/Popover";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
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
  const { ready, minimized, minimize, maximize } = usePipeViewPreferences(allPipes?.map((pipe) => pipe.id));
  const [menuPipe, setMenuPipe] = useState<Pipe | null>(null);
  const anchorRef = useRef<View>(null);
  const rowRefs = useRef(new Map<Pipe["id"], View>());
  const minimizedPipes = pipes.filter((pipe) => minimized.has(pipe.id));
  const fullPipes = pipes.filter((pipe) => !minimized.has(pipe.id));
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
    onKeyDown: (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
      event.preventDefault();
      openMenu(pipe);
    },
  } : {};

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow:1, gap: 8 }}>
      {ready && fullPipes.map((item, idx) => {
        const childBoxes: ChildSnapshot[] | undefined = (childrenByParent.get(item.id) ?? []).map((child) => ({
          icon: child.icon,
          capacity: child.capacity ?? 0,
          fed: child.fed ?? 0,
          spent: child.spent ?? 0,
        }));

        return (
          <View
            key={item.id}
            className="flex-row items-center"
            ref={(view) => { if (view) rowRefs.current.set(item.id, view); else rowRefs.current.delete(item.id); }}
            {...webMenuEvents(item)}
          >
            {leading?.(item)}
            <PipeBox
              name={item.name}
              icon={item.icon}
              priority={item.priority}
              capacity={
                item.sourceType === "boiler"
                  ? (item.contributedFed ?? 0)
                  : item.capacity
              }
              fed={item.fed}
              spent={item.spent}
              showPriority={priority && item.priority !== fullPipes[idx - 1]?.priority}
              {...{ children: childBoxes }}
              onPress={() => onSelectPipe?.(item.id)}
              onLongPress={() => openMenu(item)}
            />
            {trailing?.(item)}
          </View>
        );
      })}

      {ready && minimizedPipes.length > 0 && (
        <View testID="minimized-pipes" className="flex-row flex-wrap gap-2">
          {minimizedPipes.map((item) => (
            <View
              key={item.id}
              ref={(view) => { if (view) rowRefs.current.set(item.id, view); else rowRefs.current.delete(item.id); }}
              {...webMenuEvents(item)}
            >
              <MinimizedPipe pipe={item} onPress={() => onSelectPipe?.(item.id)} onLongPress={() => openMenu(item)} />
            </View>
          ))}
        </View>
      )}

      {footer}
      <Popover visible={menuPipe !== null} onClose={closeMenu} anchorRef={anchorRef as RefObject<View>}>
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
    </ScrollView>
  );
});
