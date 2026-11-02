import { Link, useSegments } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { destinations } from "../../../navigation";
import { CreateTabAction } from "@features/creation/CreateTabAction/CreateTabAction";

export function ExpandedNavigation() {
  const segments: readonly string[] = useSegments();
  const active = segments[1] === "(tabs)" ? segments[2] : undefined;

  return <SafeAreaView edges={["top", "bottom", "left"]} className="w-48 shrink-0">
    <ScrollView className="flex-1" contentContainerClassName="p-2 gap-2" accessibilityLabel="Main navigation">
      {destinations.map(destination => <Link key={destination.name} href={destination.href} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={destination.title}
          accessibilityState={{ selected: active === destination.name }}
          aria-current={active === destination.name ? "page" : undefined}
          className={cn("flex-row items-center gap-3 rounded-lg p-3 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary",
            active === destination.name && "bg-surface")}>
          <Icon name={destination.icon} size={24} color={active === destination.name ? colors.text : colors.muted} />
          <Text className={active === destination.name ? "text-text" : "text-muted"}>{destination.title}</Text>
        </Pressable>
      </Link>)}
    </ScrollView>
    <View className="shrink-0 p-2">
      <CreateTabAction sidebar />
    </View>
  </SafeAreaView>;
}
