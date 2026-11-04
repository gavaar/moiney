import type { IconName } from "@ui/Icon";

export const destinations = [
  { name: "pipes", title: "Pipes", icon: "pipe-valve", href: "/pipes" },
  { name: "history", title: "History", icon: "history", href: "/history" },
  { name: "statistics", title: "Statistics", icon: "bar-chart-outline", href: "/statistics" },
  { name: "profile", title: "Profile", icon: "person-outline", href: "/profile" },
] as const satisfies readonly { name: string; title: string; icon: IconName; href: string }[];
