import { useState } from "react";
import { Pressable, View } from "react-native";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { CreateModal } from "./CreateModal";

export function CreateTabAction() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="flex-1 items-center justify-center overflow-visible">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={() => setIsOpen(true)}
        className="absolute -top-3 h-14 w-14 items-center justify-center rounded-full bg-surface"
      >
        <Icon name="add" size={32} color={colors.text} />
      </Pressable>
      {isOpen ? (
        <PipeCatalogProvider>
          <CreateModal onClose={() => setIsOpen(false)} />
        </PipeCatalogProvider>
      ) : null}
    </View>
  );
}
