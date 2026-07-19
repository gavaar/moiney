type IconFamily = "Ionicons" | "MaterialCommunityIcons";

type CuratedIcon = {
  name: string;
  family: IconFamily;
};

const CURATED_ICONS = [
  { name: "add-circle-outline", family: "Ionicons" as const },
  { name: "airplane-outline", family: "Ionicons" as const },
  { name: "arrow-back", family: "Ionicons" as const },
  { name: "bank", family: "MaterialCommunityIcons" as const },
  { name: "bar-chart-outline", family: "Ionicons" as const },
  { name: "calendar-outline", family: "Ionicons" as const },
  { name: "camera-outline", family: "Ionicons" as const },
  { name: "car-sport-outline", family: "Ionicons" as const },
  { name: "card-outline", family: "Ionicons" as const },
  { name: "cart-outline", family: "Ionicons" as const },
  { name: "cash-outline", family: "Ionicons" as const },
  { name: "chatbubble-outline", family: "Ionicons" as const },
  { name: "checkmark", family: "Ionicons" as const },
  { name: "checkmark-circle", family: "Ionicons" as const },
  { name: "checkmark-done-outline", family: "Ionicons" as const },
  { name: "close", family: "Ionicons" as const },
  { name: "close-circle", family: "Ionicons" as const },
  { name: "document-text-outline", family: "Ionicons" as const },
  { name: "download-outline", family: "Ionicons" as const },
  { name: "ellipsis-vertical", family: "Ionicons" as const },
  { name: "eye", family: "Ionicons" as const },
  { name: "eye-off", family: "Ionicons" as const },
  { name: "film-outline", family: "Ionicons" as const },
  { name: "filter", family: "Ionicons" as const },
  { name: "fitness-outline", family: "Ionicons" as const },
  { name: "flash-outline", family: "Ionicons" as const },
  { name: "game-controller-outline", family: "Ionicons" as const },
  { name: "gift-outline", family: "Ionicons" as const },
  { name: "home-outline", family: "Ionicons" as const },
  { name: "home-sharp", family: "Ionicons" as const },
  { name: "laptop-outline", family: "Ionicons" as const },
  { name: "location-outline", family: "Ionicons" as const },
  { name: "lock-closed-outline", family: "Ionicons" as const },
  { name: "log-out", family: "Ionicons" as const },
  { name: "medkit-outline", family: "Ionicons" as const },
  { name: "musical-notes-outline", family: "Ionicons" as const },
  { name: "notifications-outline", family: "Ionicons" as const },
  { name: "paw-outline", family: "Ionicons" as const },
  { name: "pencil-outline", family: "Ionicons" as const },
  { name: "person-outline", family: "Ionicons" as const },
  { name: "phone-portrait-outline", family: "Ionicons" as const },
  { name: "piggy-bank", family: "MaterialCommunityIcons" as const },
  { name: "pipe", family: "MaterialCommunityIcons" as const },
  { name: "pipe-valve", family: "MaterialCommunityIcons" as const },
  { name: "reload-outline", family: "Ionicons" as const },
  { name: "restaurant-outline", family: "Ionicons" as const },
  { name: "school-outline", family: "Ionicons" as const },
  { name: "search", family: "Ionicons" as const },
  { name: "settings-outline", family: "Ionicons" as const },
  { name: "share-outline", family: "Ionicons" as const },
  { name: "shirt-outline", family: "Ionicons" as const },
  { name: "trash-outline", family: "Ionicons" as const },
  { name: "trending-down-outline", family: "Ionicons" as const },
  { name: "trending-up-outline", family: "Ionicons" as const },
  { name: "tv-outline", family: "Ionicons" as const },
  { name: "wallet-outline", family: "Ionicons" as const },
  { name: "water-outline", family: "Ionicons" as const },
] satisfies CuratedIcon[];

type IconName = (typeof CURATED_ICONS)[number]["name"];

const ICON_REGISTRY: Record<string, IconFamily> = {};
for (const icon of CURATED_ICONS) {
  ICON_REGISTRY[icon.name] = icon.family;
}

export { CURATED_ICONS, ICON_REGISTRY };
export type { IconFamily, IconName };
