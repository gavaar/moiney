import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import { ICON_REGISTRY, type IconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";
import { SlideToggle } from "@ui/SlideToggle";
import { parseMoney } from "@domain/money";

type SourceType = "feed" | "boiler";

const SOURCE_OPTIONS = [
  { value: "feed", label: "Feed", icon: "pipe" },
  { value: "boiler", label: "Boiler", icon: "water-boiler" },
] satisfies [
  { value: SourceType; label: string; icon: IconName },
  { value: SourceType; label: string; icon: IconName },
];

function parseOptionalMoney(value: string): number | null | undefined {
  if (!value) return undefined;
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("feed");
  const [amount, setAmount] = useState("");
  const [contributed, setContributed] = useState("");
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
    setSourceType("feed");
    setAmount("");
    setContributed("");
    setNameError(undefined);
  }, []);

  const initialFed = parseOptionalMoney(amount);
  const contributedFed = parseOptionalMoney(contributed);

  const canSubmit = useMemo(
    () =>
      validateName(name) === undefined &&
      icon !== "" &&
      icon in ICON_REGISTRY &&
      initialFed !== null &&
      (sourceType !== "boiler" || contributedFed !== null),
    [name, icon, initialFed, sourceType, contributedFed, validateName],
  );

  const handleSubmit = useCallback(async () => {
    if (
      !canSubmit ||
      loading ||
      initialFed === null ||
      contributedFed === null
    ) {
      return;
    }
    setLoading(true);
    try {
      await addFeed({
        name,
        icon,
        description: description || undefined,
        sourceType,
        ...(initialFed === undefined ? {} : { initialFed }),
        ...(sourceType !== "boiler" || contributedFed === undefined
          ? {}
          : { contributedFed }),
      });
      showAlert.success(sourceType === "boiler" ? "Boiler added" : "Feed added");
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
    sourceType,
    initialFed,
    contributedFed,
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
        <View className="gap-3 border-b border-muted/20 pb-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text accessibilityRole="header" className="text-lg font-semibold text-text">
              {sourceType === "boiler" ? "Create Boiler" : "Create Feed"}
            </Text>
            <SlideToggle
              options={SOURCE_OPTIONS}
              value={sourceType}
              onChange={(value) => setSourceType(value as SourceType)}
            />
          </View>
          <Text className="text-sm text-muted">
            {sourceType === "boiler"
              ? "A boiler tracks an asset's current value and contributed principal separately. Amount is its current value; Contributed is how much you put into it."
              : "A feed is a source for money entering your budget. Amount is the money currently available in it."}
          </Text>
        </View>
        <ScrollView
          className="flex-grow-0"
          contentContainerClassName="gap-4 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Name"
            placeholder="Feed name"
            value={name}
            onChangeText={handleNameChange}
            onBlur={handleNameBlur}
            error={nameError}
          />
          <Input
            type="decimal"
            label="Amount"
            placeholder="Current value?"
            value={amount}
            onChange={setAmount}
            allowNegative={false}
            error={initialFed === null ? "Enter a valid amount" : undefined}
          />
          {sourceType === "boiler" ? (
            <Input
              type="decimal"
              label="Contributed"
              placeholder="How much was put in it?"
              value={contributed}
              onChange={setContributed}
              allowNegative={false}
              error={
                contributedFed === null ? "Enter a valid contribution" : undefined
              }
            />
          ) : null}
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
              title={sourceType === "boiler" ? "Add boiler" : "Add feed"}
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              testID="add-feed-submit"
            />
          </View>
        </ScrollView>
      </ModalShell>
    </>
  );
}
