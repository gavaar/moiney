import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { type IconName } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";

export function AddPipeButton() {
  const [visible, setVisible] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("pipe");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [capacity, setCapacity] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 3) return "Name must be at least 3 characters";
    return undefined;
  };

  const resetForm = () => {
    setName("");
    setIcon("pipe");
    setDescription("");
    setPriority(0);
    setCapacity("");
    setNameError(undefined);
  };

  const handleSubmit = () => {
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }
    console.log({
      name: name.trim(),
      icon: icon || "pipe",
      description: description || undefined,
      priority,
      capacity: capacity ? Number(capacity) : undefined,
    });
    setVisible(false);
    resetForm();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className="my-2 self-center border-dashed border-2 border-text opacity-60 rounded-xl px-8 py-2 items-center justify-center"
        activeOpacity={0.5}
      >
        <Text className="text-text text-base">Add pipe</Text>
      </TouchableOpacity>

      <ModalShell visible={visible} closeOnBackdropPress={false} onClose={() => setVisible(false)}>
        <ScrollView>
          <View className="gap-4">
            <Input
              label="Name"
              placeholder="Pipe name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameError(undefined);
              }}
              onBlur={() => setNameError(validateName(name))}
              error={nameError}
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
              min={0}
              step={1}
            />
            <Input
              type="decimal"
              label="Initial capacity?"
              value={capacity}
              onChange={setCapacity}
              placeholder="0.00"
            />
          </View>
        </ScrollView>
        <View className="flex-row gap-2 mt-4">
          <Button
            className="flex-1"
            title="Cancel"
            variant="muted"
            onPress={() => {
              setVisible(false);
              resetForm();
            }}
          />
          <Button className="flex-[2_1_0]" title="Submit" onPress={handleSubmit} />
        </View>
      </ModalShell>
    </>
  );
}
