import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, CURATED_ICONS, type IconName } from "@/components/ui/Icon";

type Props = {
  label: string;
  value: IconName | "";
  onSelect: (name: IconName) => void;
  error?: string;
};

function filterIcons(search: string, icons: { name: string }[]) {
  return search
    ? icons.filter((icon) =>
        icon.name.toLowerCase().includes(search.toLowerCase()),
      )
    : icons;
}

export function IconInput({ label, value, onSelect, error }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = filterIcons(search, CURATED_ICONS);

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <Pressable
        testID="icon-picker-trigger"
        onPress={() => setOpen(true)}
        className={cn(
          "rounded-lg border bg-surface px-3 py-2.5 flex-row items-center gap-2",
          error ? "border-error" : "border-border",
        )}
      >
        {value ? (
          <>
            <Icon name={value} size={20} color={colors.text} />
            <Text className="text-base text-text">{value}</Text>
          </>
        ) : (
          <Text className="text-base text-mutedForeground">---</Text>
        )}
      </Pressable>
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <Pressable
            className="absolute inset-0"
            onPress={() => setOpen(false)}
          />
          <View className="bg-surface rounded-xl p-4 mx-4 min-w-[300px] max-h-[80%]">
            <View className="items-end mb-2">
              <Pressable onPress={() => setOpen(false)}>
                <Icon name="close" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
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
                        onPress={() => {
                          onSelect(icon.name);
                          setOpen(false);
                          setSearch("");
                        }}
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
        </View>
      </Modal>
    </View>
  );
}
