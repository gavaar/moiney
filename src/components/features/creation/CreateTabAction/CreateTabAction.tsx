import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { useCreationFlow } from "../creation-flow";

export function CreateTabAction({ sidebar = false }: { sidebar?: boolean }) {
  const { open, registerTrigger } = useCreationFlow();

  return (
    <View className={sidebar ? "w-full" : "flex-1 items-center justify-center overflow-visible"}>
      <Pressable
        ref={trigger => trigger ? registerTrigger(trigger) : undefined}
        accessibilityRole="button"
        accessibilityLabel={sidebar ? "Add" : "Create"}
        onPress={open}
        className={cn("bg-surface web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary",
          sidebar ? "flex-row items-center gap-3 rounded-lg p-3" : "absolute -top-3 h-14 w-14 items-center justify-center rounded-full")}
      >
        <Icon name="add" size={sidebar ? 24 : 32} color={colors.text} />
        {sidebar ? <Text className="text-text">Add</Text> : null}
      </Pressable>
    </View>
  );
}
