import { View } from "react-native";
import { colors } from "@/lib/styles";
import type { FormPageDefinition } from "./FormPage";

type Props = {
  pages: readonly Pick<FormPageDefinition, "key" | "hasError">[];
  activeIndex: number;
};

export function PagerIndicator({ pages, activeIndex }: Props) {
  return <View className="flex-row justify-center gap-2">
    {pages.map((page, index) => {
      const selected = index === activeIndex;
      const backgroundColor = page.hasError
        ? selected ? colors.error : colors.errorDark
        : selected ? colors.text : colors.muted;
      return (
        <View key={page.key} accessible accessibilityRole="image"
          accessibilityLabel={`Step ${index + 1} of ${pages.length}${page.hasError ? ", has errors" : ""}`}
          accessibilityState={{ selected }} aria-selected={selected}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor }} />
      );
    })}
  </View>;
}
