import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Form } from "@ui/Form";
import { ModalShell } from "@ui/Modal";
import { useAddFeedForm } from "./useAddFeedForm";

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const form = useAddFeedForm(() => setVisible(false));

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
        {visible ? <Form {...form} /> : null}
      </ModalShell>
    </>
  );
}
