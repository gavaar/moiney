import { Switch, Text, View } from "react-native";
import { Form } from "@ui/Form";
import type { AmountFormDraft, AmountFormProps } from "./types";
import { useAmountFormController } from "./useAmountFormController";
import { buildAmountForm } from "./amountForm.config";
import { getAmountFormHeader } from "./amountFormHeader";
import { AmountFormActions } from "./AmountFormActions";

export function AmountForm(props: AmountFormProps) {
  const form = useAmountFormController(props);
  const picker = props.sourcePicker;
  const feedPipe = props.variant === "feed" && props.pipeId ? form.pipesById[props.pipeId] : undefined;
  const heading = form.transaction ?? (feedPipe ? {
    intent: "feed" as const,
    initial: { pipeName: feedPipe.name, pipeIcon: feedPipe.icon, spent: feedPipe.spent, capacity: feedPipe.capacity, title: "" },
  } : null);

  function handleFormChange(next: AmountFormDraft) {
    form.updateDraft(next);
    if (picker && next.sourcePipeId !== form.draft.sourcePipeId) {
      const pipe = picker.pipes.find(pipe => pipe.id === next.sourcePipeId);
      if (pipe) picker.onSelect(pipe.id);
    }
  }

  return (
    <View className="px-4 py-4" style={{ flexShrink: 1 }}>
      <Form
        pages={buildAmountForm(form, picker)}
        value={form.draft}
        onChange={handleFormChange}
        navigationStart={picker?.navigationStart}
        header={heading ? getAmountFormHeader(heading, props.pipeId !== null) : undefined}
        warnings={form.editWarning ? [form.editWarning.join("\n")] : undefined}
        actions={<View className="gap-2">
          {form.replacementChoice ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm text-text">Apply transaction accounting to replacement pipes</Text>
              <Switch accessibilityLabel="Apply accounting to replacement pipes" value={form.replacementChoice.value}
                onValueChange={form.replacementChoice.onChange} disabled={form.common.loading} />
            </View>
          ) : null}
          <AmountFormActions action={form.action} onReset={form.common.reset} />
        </View>}
      />
    </View>
  );
}
