import { Tabs } from "expo-router";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { useLayoutMode } from "@/lib/styles/useLayoutMode";
import { CreateTabAction } from "@features/creation/CreateTabAction/CreateTabAction";
import { destinations } from "../navigation";
import { useOpenPipes } from "../PipesNavigationProvider/PipesNavigationProvider";

const tabs = [destinations[0], destinations[1], { name: "create", title: "Create" }, ...destinations.slice(2)] as const;

export function AppTabs() {
  const expanded = useLayoutMode() === "expanded";
  const openPipes = useOpenPipes();
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarShowLabel: false,
    tabBarStyle: {
      display: expanded ? "none" : "flex",
      backgroundColor: colors.background,
      borderTopColor: colors.muted,
    },
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.muted,
  }}>
    {tabs.map(tab => <Tabs.Screen
      key={tab.name}
      name={tab.name}
      listeners={tab.name === "pipes" ? { tabPress: event => { event.preventDefault(); openPipes(); } } : undefined}
      options={"icon" in tab
        ? {
          title: tab.title,
          tabBarIcon: ({ color, size }) => <Icon name={tab.icon} size={size} color={color} />,
        }
        : {
          title: tab.title,
          tabBarButton: () => expanded ? null : <CreateTabAction />,
        }
      }
    />)}
  </Tabs>;
}
