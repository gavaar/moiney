import { useRef, useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import { Form } from "@ui/Form";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";
import { parseMoney } from "@domain/money";
import { ADD_FEED_DEFAULTS, buildAddFeedForm } from "./addFeedForm.config";

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(ADD_FEED_DEFAULTS);
  const submitting = useRef(false);
  const showAlert = useAlert();
  const addFeed = useMutation(api.pipes.addFeed);
  const form = buildAddFeedForm(draft, loading);
  const canSubmit = form.every((field) => field.key === "isBoiler"
    ? field.validator(draft.isBoiler) === null
    : field.validator(draft[field.key]) === null);

  async function handleSubmit() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
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
      setVisible(false);
      setDraft(ADD_FEED_DEFAULTS);
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

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
        {visible ? (
          <Form
            header={<Text className="text-lg font-semibold text-text">{draft.isBoiler ? "Create Boiler" : "Create Feed"}</Text>}
            form={form}
            value={draft}
            onChange={(value) => setDraft((previous) => ({ ...previous, ...value }))}
            finalAction={
              <Button
                className="ml-auto min-w-40"
                title={draft.isBoiler ? "Add boiler" : "Add feed"}
                onPress={handleSubmit}
                loading={loading}
                disabled={!canSubmit}
                testID="add-feed-submit"
              />
            }
          />
        ) : null}
      </ModalShell>
    </>
  );
}
