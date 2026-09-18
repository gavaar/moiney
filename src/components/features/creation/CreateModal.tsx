import { ModalShell } from "@ui/Modal";
import { TransactionForm } from "@features/transactions/TransactionForm/TransactionForm";
import { useState } from "react";
import { Keyboard, View } from "react-native";
import { PillGroup } from "@ui/PillGroup/PillGroup";
import { Form } from "@ui/Form";
import { AddPipeForm } from "@features/pipes/InnerPipesScreen/components/AddPipeModal/AddPipeModal";
import { useAddFeedForm } from "@features/pipes/FeedListScreen/components/AddFeedButton/useAddFeedForm";

type Props = { onClose: () => void };
type CreateMode = "transaction" | "pipe" | "root";
const modes = [
  { value: "transaction", label: "transaction" },
  { value: "pipe", label: "pipe" },
  { value: "root", label: "root" },
] as const;

export function CreateModal({ onClose }: Props) {
  const [mode, setMode] = useState<CreateMode>("transaction");
  const rootForm = useAddFeedForm(onClose);
  return <ModalShell visible onClose={onClose} bottomAccessory={
    <PillGroup options={modes} value={mode} accessibilityLabel="Create" onChange={next => {
      Keyboard.dismiss();
      setMode(next);
    }} />
  }>
    <View style={{ display: mode === "transaction" ? "flex" : "none", flexShrink: 1 }}>
      <TransactionForm onSuccess={onClose} />
    </View>
    <View style={{ display: mode === "pipe" ? "flex" : "none", flexShrink: 1 }}>
      <AddPipeForm onClose={onClose} />
    </View>
    <View style={{ display: mode === "root" ? "flex" : "none", flexShrink: 1 }}>
      <Form {...rootForm} />
    </View>
  </ModalShell>;
}
