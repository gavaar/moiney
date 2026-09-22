import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import { Form } from "@ui/Form";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { colors } from "@/lib/styles";
import { buildRuleFields, createRuleDraft, mergeRuleDraft, ruleDraftValues, validateRuleDraft } from "@features/pipes/rules/rule-form";
import { buildRuleUpdateCommand, getActionConfig, hasRuleDiff } from "@features/pipes/rules/helpers";

type Props = { visible: boolean; onClose: () => void; pipeId: PipeModel["id"] };

export function RuleModal({ visible, onClose, pipeId }: Props) {
  const { pipesById } = usePipeCatalog();
  const pipe = pipesById?.[pipeId];
  const showAlert = useAlert();
  const updatePipeRule = useMutation(api.pipes.updatePipeRule);
  const executePipeRuleNow = useMutation(api.pipes.executePipeRuleNow);
  const [draft, setDraft] = useState(() => createRuleDraft(pipe));
  const [isBusy, setIsBusy] = useState(false);
  const values = ruleDraftValues(draft);
  const isCron = values.selectedRule === "cron";
  const isSelfDestruct = values.selectedRule === "self_destruct";
  const hasDiff = hasRuleDiff({
    selectedRule: values.selectedRule, isCron, pipe, starting: values.starting,
    capNumber: values.effectiveCron.capUpdateValue,
    interval: values.effectiveCron.interval, unit: values.effectiveCron.unit,
  });
  const action = getActionConfig({ hasDiff, isCron, isSelfDestruct });
  const valid = validateRuleDraft(draft, Date.now()) === undefined;

  async function handleAction() {
    if (isBusy || action.disabled) return;
    const validationError = validateRuleDraft(draft, Date.now());
    if (validationError) {
      showAlert.error(validationError);
      return;
    }
    setIsBusy(true);
    try {
      if (hasDiff) {
        await updatePipeRule(buildRuleUpdateCommand({ pipeId, ...values }));
        if (isCron || isSelfDestruct) onClose();
      } else {
        await executePipeRuleNow({ pipeId });
        showAlert.success("Rule executed");
        onClose();
      }
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  return <ModalShell visible={visible} onClose={onClose}>
    <Form
      header={<View className="flex-row items-center gap-2">
        {pipe ? <Icon name={safeIconName(pipe.icon)} size={20} color={colors.muted} /> : null}
        <Text className="text-muted text-lg">{pipe?.name ?? "Pipe"}</Text>
      </View>}
      form={buildRuleFields(draft, { capacity: pipe?.capacity ?? 0, disabled: isBusy, allowSelfDestruct: Boolean(pipe?.parentId), now: Date.now() })}
      value={draft} onChange={(next) => setDraft((previous) => mergeRuleDraft(previous, next))}
      finalAction={<Button title={action.title} variant={action.variant} icon={action.icon}
        disabled={action.disabled || !valid} loading={isBusy} onPress={handleAction} />}
    />
  </ModalShell>;
}
