import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { type IconName } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";

export default function AddFeedButton() {
  const [visible, setVisible] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);

  const handleSubmit = () => {
    console.log({ name, icon, description, priority });
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className="border-dashed border-2 border-primary opacity-60 rounded-xl px-8 py-2 items-center justify-center"
        activeOpacity={0.5}
      >
        <Text className="text-primary text-base">Add new Feed</Text>
      </TouchableOpacity>

      <ModalShell visible={visible} onClose={() => setVisible(false)}>
        <View className="gap-4">
          <Input
            label="Name"
            placeholder="Feed name"
            value={name}
            onChangeText={setName}
          />
          <Input type="icon" label="Icon" value={icon} onSelect={setIcon} />
          <Input
            label="Description"
            placeholder="Optional description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
          <Input
            type="number"
            label="Priority"
            value={priority}
            onChange={setPriority}
          />
          <Button title="Add" onPress={handleSubmit} />
        </View>
      </ModalShell>
    </>
  );
}
