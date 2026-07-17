import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { type IconName } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";

export default function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");

  const addFeed = useMutation(api.pipes.addFeed);

  const resetForm = () => {
    setName("");
    setIcon("");
    setDescription("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await addFeed({
        name,
        icon,
        description: description || undefined,
      });
      Alert.alert("Success", "Feed added");
      setVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
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

      <ModalShell visible={visible} closeOnBackdropPress={false} onClose={() => setVisible(false)}>
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
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              title="Cancel"
              variant="mutedForeground"
              onPress={() => setVisible(false)}
              disabled={loading}
            />
            <Button className="flex-[2_1_0]" title="Add" onPress={handleSubmit} loading={loading} />
          </View>
        </View>
      </ModalShell>
    </>
  );
}
