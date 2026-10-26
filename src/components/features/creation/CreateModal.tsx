import { ModalShell } from "@ui/Modal";
import { TransactionForm } from "@features/transactions/TransactionForm/TransactionForm";
import { useCallback, useState } from "react";
import { Keyboard, View } from "react-native";
import { PillGroup } from "@ui/PillGroup/PillGroup";
import { PipeForm } from "@features/pipes/PipeForm/PipeForm";
import { OptionListScope } from "@ui/OptionList";
import { useFormDismissal } from "@ui/Form/use-form-dismissal";

type Props = { onClose: () => void };
type CreateMode = "transaction" | "pipe";
const modes = [
  { value: "transaction", label: "transaction" },
  { value: "pipe", label: "pipe" },
] as const;

export function CreateModal({ onClose }: Props) {
  const [mode, setMode] = useState<CreateMode>("transaction");
  const dismissal = useFormDismissal(onClose);
  const { onDismissStateChange } = dismissal;
  const transactionDismissal = useCallback((dirty: boolean, busy: boolean) => onDismissStateChange(dirty, busy, "transaction"), [onDismissStateChange]);
  const pipeDismissal = useCallback((dirty: boolean, busy: boolean) => onDismissStateChange(dirty, busy, "pipe"), [onDismissStateChange]);
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
      <OptionListScope active={mode === "pipe"}>
        <PipeForm mode="create" onClose={onClose} onDismissStateChange={pipeDismissal} />
      </OptionListScope>
    </View>
  </ModalShell>;
}
