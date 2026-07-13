import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { type IconName } from "@/components/ui/Icon";
import { IconPicker } from "@/components/ui/IconPicker";
import { InputText } from "@/components/ui/InputText";
import { useModal } from "@/components/ui/Modal";

export default function AddFeedButton() {
  const { open, close } = useModal();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("0");

  const handleSubmit = () => {
    console.log({ name, icon, description, priority: Number(priority) });
    close();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() =>
          open(
            <ScrollView className="gap-4">
              <InputText
                label="Name"
                placeholder="Feed name"
                value={name}
                onChangeText={setName}
              />
              <View>
                <Text className="text-sm text-mutedForeground mb-2">
                  Icon
                </Text>
                <IconPicker value={icon} onSelect={setIcon} />
              </View>
              <InputText
                label="Description"
                placeholder="Optional description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              <InputText
                label="Priority"
                placeholder="0"
                value={priority}
                onChangeText={setPriority}
                keyboardType="numeric"
              />
              <Button title="Add" onPress={handleSubmit} />
            </ScrollView>,
          )
        }
        className="border-dashed border-2 border-primary opacity-60 rounded-xl px-8 py-2 items-center justify-center"
        activeOpacity={0.5}
      >
        <Text className="text-primary text-base">Add new Feed</Text>
      </TouchableOpacity>
    </>
  );
}
