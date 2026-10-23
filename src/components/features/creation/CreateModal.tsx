import { ModalShell } from "@ui/Modal";
import { TransactionForm } from "@features/transactions/TransactionForm/TransactionForm";
import { useCallback, useState } from "react";
import { Keyboard, View } from "react-native";
import { PillGroup } from "@ui/PillGroup/PillGroup";
import { Form } from "@ui/Form";
import { AddPipeForm } from "@features/pipes/InnerPipesScreen/components/AddPipeModal/AddPipeModal";
import { useAddFeedForm } from "@features/pipes/FeedListScreen/components/AddFeedButton/useAddFeedForm";
import { useFormDismissal } from "@ui/Form/use-form-dismissal";

type Props = { onClose: () => void };
type CreateMode = "transaction" | "pipe" | "root";
const modes = [
  { value: "transaction", label: "transaction" },
  { value: "pipe", label: "pipe" },
  { value: "root", label: "root" },
] as const;

export function CreateModal({ onClose }: Props) {
  const [mode, setMode] = useState<CreateMode>("transaction");
  const dismissal = useFormDismissal(onClose);
  const { onDismissStateChange } = dismissal;
  const transactionDismissal = useCallback((dirty: boolean, busy: boolean) => onDismissStateChange(dirty, busy, "transaction"), [onDismissStateChange]);
  const pipeDismissal = useCallback((dirty: boolean, busy: boolean) => onDismissStateChange(dirty, busy, "pipe"), [onDismissStateChange]);
  const rootDismissal = useCallback((dirty: boolean, busy: boolean) => onDismissStateChange(dirty, busy, "root"), [onDismissStateChange]);
  const rootForm = useAddFeedForm(onClose, rootDismissal);
  const { resetVersion, ...rootFormProps } = rootForm;
  return <ModalShell visible onClose={() => void dismissal.requestClose()} bottomAccessory={
    <PillGroup options={modes} value={mode} accessibilityLabel="Create" onChange={next => {
      Keyboard.dismiss();
      setMode(next);
    }} />
  }>
    <View style={{ display: mode === "transaction" ? "flex" : "none", flexShrink: 1 }}>
      <TransactionForm onSuccess={onClose} onDismissStateChange={transactionDismissal} />
    </View>
    <View style={{ display: mode === "pipe" ? "flex" : "none", flexShrink: 1 }}>
      <AddPipeForm onClose={onClose} onDismissStateChange={pipeDismissal} />
    </View>
    <View style={{ display: mode === "root" ? "flex" : "none", flexShrink: 1 }}>
      <Form key={resetVersion} {...rootFormProps} />
    </View>
  </ModalShell>;
}
