import { View } from "react-native";
import { Form } from "@ui/Form";
import type { AmountFormDraft, AmountFormProps } from "./types";
import { useAmountFormController } from "./useAmountFormController";
import { buildAmountForm } from "./amountForm.config";
import { AmountFormHeader } from "./AmountFormHeader";
import { AmountFormActions } from "./AmountFormActions";

export function AmountForm(props: AmountFormProps) {
  const form = useAmountFormController(props);
  const picker = props.sourcePicker;

  function handleFormChange(next: AmountFormDraft) {
    form.updateDraft(next);
    if (picker?.activeStep === 0) {
      const pipe = picker.pipes.find(pipe => pipe.id === next.sourcePipeId);
      if (pipe) picker.onSelect(pipe.id);
    }
  }

  return (
    <View className="px-4 py-4" style={props.fill ? { flex: 1 } : { flexShrink: 1 }}>
      <Form
        fill={props.fill}
        form={buildAmountForm(form, picker)}
        value={form.draft}
        onChange={handleFormChange}
        activeStep={picker?.activeStep}
        onStepChange={picker?.onStepChange}
        header={form.transaction || form.spend ? (
          <AmountFormHeader transaction={form.transaction} sourceSelected={props.pipeId !== null}
            spend={form.spend} showMode={!picker || picker.activeStep === 1} loading={form.common.loading} />
        ) : undefined}
        finalAction={<AmountFormActions action={form.action} onReset={form.common.reset} alongsideNavigation={!!picker} />}
      />
    </View>
  );
}
