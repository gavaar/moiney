import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { type IconName } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ModalShell } from "@/components/ui/Modal";
import { type Id } from "@convex/_generated/dataModel";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";

type AddPipeButtonProps = {
  parentId: Id<"pipes">;
};

export function AddPipeButton({ parentId }: AddPipeButtonProps) {
  const { pipesById, childrenByParent } = usePipeSelection();
  const parentPipe = pipesById?.[parentId];
  const parentName = parentPipe?.name ?? "";
  const hasChildren = (childrenByParent.get(parentId)?.length ?? 0) > 0;
  const showWarning = !hasChildren && ((parentPipe?.capacity ?? 0) > 0 || (parentPipe?.spent ?? 0) > 0);

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("pipe");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [capacity, setCapacity] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const addPipe = useMutation(api.pipes.addPipe);

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
    setSubmitError(undefined);
  };

  const handleSubmit = async () => {
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }

    setLoading(true);
    setSubmitError(undefined);

    try {
      await addPipe({
        name: name.trim(),
        icon: icon || "pipe",
        description: description || undefined,
        priority,
        capacity: capacity ? Number(capacity) : undefined,
        parentId,
      });
      setVisible(false);
      resetForm();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
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
            <Input label="Parent" value={parentName} disabled />

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
              <View className="flex-[3]">
                <Input
                  type="decimal"
                  label="Initial capacity?"
                  value={capacity}
                  onChange={setCapacity}
                  placeholder="0.00"
                  allowNegative={false}
                />
              </View>
              <View className="flex-[2]">
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

            {showWarning ? (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
                <Text className="text-warning text-sm">
                  Creating a child will remove current capacity and spent values.
                </Text>
              </View>
            ) : null}

            {submitError ? (
              <Text className="text-sm text-error">{submitError}</Text>
            ) : null}
          </View>
        </ScrollView>

        {!hasChildren ? (
          <View className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 mx-1 mt-2">
            <Text className="text-warning text-sm">
              Adding a pipe removes the ability to add transactions from this pipe. All transactions should happen from a childless pipe.
            </Text>
          </View>
        ) : null}

        <View className="flex-row gap-2 mt-4">
          <Button
            className="flex-1"
            title="Cancel"
            variant="muted"
            onPress={() => {
              setVisible(false);
              resetForm();
            }}
            disabled={loading}
          />
          <Button className="flex-[2_1_0]" title="Submit" onPress={handleSubmit} loading={loading} />
        </View>
      </ModalShell>
    </>
  );
}
