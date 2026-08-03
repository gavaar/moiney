import { useCallback, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import { ICON_REGISTRY, type IconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const showAlert = useAlert();
  const addFeed = useMutation(api.pipes.addFeed);

  const validateName = useCallback((value: string): string | undefined => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 2) return "Name must be at least 2 characters";
    return undefined;
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setNameError(undefined);
  }, []);

  const handleNameBlur = useCallback(() => {
    setNameError(validateName(name));
  }, [name, validateName]);

  const resetForm = useCallback(() => {
    setName("");
    setIcon("");
    setDescription("");
    setNameError(undefined);
  }, []);

  const canSubmit = useMemo(
    () =>
      validateName(name) === undefined &&
      icon !== "" &&
      icon in ICON_REGISTRY,
    [name, icon, validateName],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await addFeed({
        name,
        icon,
        description: description || undefined,
      });
      showAlert.success("Feed added");
      setVisible(false);
      resetForm();
    } catch (error) {
      showAlert.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }, [
    canSubmit,
    loading,
    addFeed,
    name,
    icon,
    description,
    showAlert,
    resetForm,
  ]);

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
            onChangeText={handleNameChange}
            onBlur={handleNameBlur}
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
          <View className="mt-2">
            <Button
              className="ml-auto min-w-40"
              title="Add"
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              testID="add-feed-submit"
            />
          </View>
        </View>
      </ModalShell>
    </>
  );
}
