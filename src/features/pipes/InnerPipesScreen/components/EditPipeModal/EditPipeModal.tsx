import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { type IconName, Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { type Id } from "@convex/_generated/dataModel";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
import { colors } from "@/lib/styles";

type EditPipeModalProps = {
  visible: boolean;
  onClose: () => void;
  pipeId: Id<"pipes">;
};

export function EditPipeModal({ visible, onClose, pipeId }: EditPipeModalProps) {
  const { pipesById } = usePipeSelection();
  const pipe = pipesById?.[pipeId];

  const [name, setName] = useState(pipe?.name ?? "");
  const [icon, setIcon] = useState<IconName | "">((pipe?.icon as IconName) ?? "pipe");
  const [description, setDescription] = useState(pipe?.description ?? "");
  const [priority, setPriority] = useState(pipe?.priority ?? 0);
  const [capacity, setCapacity] = useState(pipe?.capacity?.toString() ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 3) return "Name must be at least 3 characters";
    return undefined;
  };

  const handleSubmit = () => {
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }

    console.log({
      pipeId,
      name: name.trim(),
      icon: icon || "pipe",
      description: description || undefined,
      priority,
      capacity: capacity ? Number(capacity) : undefined,
    });

    onClose();
  };

  if (!pipe) return null;

  return (
    <ModalShell visible={visible} closeOnBackdropPress={false} onClose={onClose}>
      <ScrollView>
        <View className="gap-4">
          <View className="flex-row items-center gap-2">
            <Icon name={pipe.icon as IconName} size={20} color={colors.muted} />
            <Text className="text-muted text-lg">{pipe.name}</Text>
          </View>

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

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Input
                type="decimal"
                label="capacity"
                value={capacity}
                onChange={setCapacity}
                placeholder="0.00"
                allowNegative={false}
              />
            </View>
            <View className="flex-1">
              <Input
                type="number"
                label="Priority"
                value={priority}
                onChange={setPriority}
                min={0}
                step={1}
              />
            </View>
          </View>

          <Input type="icon" label="Icon" value={icon} onSelect={setIcon} />

          <Input
            label="Description"
            placeholder="Optional description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View className="flex-row gap-2 mt-4">
        <Button
          className="flex-1"
          title="Cancel"
          variant="muted"
          onPress={onClose}
        />
        <Button className="flex-[2_1_0]" title="Submit" onPress={handleSubmit} />
      </View>
    </ModalShell>
  );
}
