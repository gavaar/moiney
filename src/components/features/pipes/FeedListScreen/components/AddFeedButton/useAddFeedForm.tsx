import { useState } from "react";
import { Text } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import type { FormProps } from "@ui/Form";
import { useAlert } from "@ui/Alert";
import { parseMoney } from "@domain/money";
import { ADD_FEED_DEFAULTS, buildAddFeedForm, type AddFeedDraft } from "./addFeedForm.config";

export function useAddFeedForm(onSuccess: () => void): FormProps<AddFeedDraft> {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(ADD_FEED_DEFAULTS);
  const showAlert = useAlert();
  const addFeed = useMutation(api.pipes.addFeed);
  const form = buildAddFeedForm(draft, loading);
  const canSubmit = form.every((field) => {
    if (field.key === "isBoiler" || field.key === "description") return true;
    return field.input.validator(draft[field.key]) === undefined;
  }) && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await addFeed({
        name: draft.name,
        icon: draft.icon,
        description: draft.description || undefined,
        sourceType: draft.isBoiler ? "boiler" : "feed",
        ...(draft.amount ? { initialFed: parseMoney(draft.amount) } : {}),
        ...(draft.isBoiler && draft.contributed
          ? { contributedFed: parseMoney(draft.contributed) } : {}),
      });
      showAlert.success(draft.isBoiler ? "Boiler added" : "Feed added");
      onSuccess();
      setDraft(ADD_FEED_DEFAULTS);
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return {
    header: <Text accessibilityRole="header" className="text-lg font-semibold text-text">{draft.isBoiler ? "Create Boiler" : "Create Feed"}</Text>,
    form,
    value: draft,
    onChange: value => setDraft(previous => ({ ...previous, ...value })),
    finalAction: (
      <Button
        className="ml-auto min-w-40"
        title={draft.isBoiler ? "Add boiler" : "Add feed"}
        onPress={handleSubmit}
        loading={loading}
        disabled={!canSubmit}
        testID="add-feed-submit"
      />
    ),
  };
}
