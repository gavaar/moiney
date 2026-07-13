import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/styles";
import { Icon, CURATED_ICONS, type IconName } from "@/components/Icon";

type Props = {
  value: IconName | "";
  onSelect: (name: IconName) => void;
};

export function IconPicker({ value, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? CURATED_ICONS.filter(
        (icon) =>
          icon.label.toLowerCase().includes(search.toLowerCase()) ||
          icon.name.toLowerCase().includes(search.toLowerCase()),
      )
    : CURATED_ICONS;

  return (
    <View>
      <TextInput
        placeholder="Search icons..."
        placeholderTextColor={colors.mutedForeground}
        value={search}
        onChangeText={setSearch}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-base text-text mb-3"
      />
      {filtered.length === 0 ? (
        <Text className="text-center text-sm text-mutedForeground mt-4">
          No icons found
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap" }}>
          {filtered.map((icon) => {
            const selected = value === icon.name;
            return (
              <View key={icon.name} className="w-1/4 p-1 items-center">
                <Pressable
                  onPress={() => onSelect(icon.name)}
                  className="items-center py-2 px-1 rounded-lg"
                  style={selected && { backgroundColor: "rgba(70, 174, 130, 0.1)" }}
                >
                  <Icon
                    name={icon.name}
                    size={24}
                    color={selected ? colors.primary : colors.text}
                  />
                  <Text
                    className="text-[10px] text-mutedForeground text-center mt-1"
                    numberOfLines={1}
                  >
                    {icon.name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
