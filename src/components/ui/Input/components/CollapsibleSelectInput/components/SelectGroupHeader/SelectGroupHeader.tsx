import { useRef, useState } from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { Popover } from "@ui/Popover";

export function SelectGroupHeader({ title, info }: { title: string; info?: string }) {
  const anchorRef = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(false);

  return <View className="gap-2 p-1">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-muted font-semibold">{title}</Text>
      {info ? <>
        <View ref={anchorRef} collapsable={false}>
          <Pressable accessibilityRole="button" accessibilityLabel={`About ${title}`}
            accessibilityState={{ expanded: open }} aria-expanded={open} aria-haspopup="dialog"
            className="p-2" onPress={() => setOpen(true)}>
            <Icon name="information-circle-outline" size={20} color={colors.muted} />
          </Pressable>
        </View>
        <Popover visible={open} onClose={() => setOpen(false)} anchorRef={anchorRef} anchorPosition="bottom-end">
          <Text className="text-text text-sm p-2">{info}</Text>
        </Popover>
      </> : null}
    </View>
  </View>;
}
