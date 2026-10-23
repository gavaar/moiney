import { Text, View } from "react-native";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { formBuilder, type FormPage } from "@ui/Form";
import type { PipeModel } from "@features/pipes/data/pipes";
import { buildRuleRows } from "@features/pipes/rules/rule-form";
import { ruleDisallowsContingency, type PipeDraft } from "./pipe-draft";

export function validatePipeName(value: string): string | undefined {
  if (!value.trim()) return "Name is required";
  if (value.trim().length < 3) return "Name must be at least 3 characters";
}

export function validatePipeCapacity(value: string, required = false): string | undefined {
  if (!value) return required ? "Enter a valid capacity" : undefined;
  try { parseMoney(value); } catch { return "Enter a valid capacity"; }
}

function pipeOption(item: { name: string; icon: string }) {
  return <View className="flex-row items-center gap-2">
    <Icon name={safeIconName(item.icon)} size={22} color={colors.muted} />
    <Text className="flex-1 text-text" numberOfLines={1}>{item.name}</Text>
  </View>;
}

export function buildPipeForm({ pipes, disabled, loading, draft, now, editing, leaf, allowSelfDestruct, contingencyOptions, invalidContingency, removalPending }: {
  pipes: readonly PipeModel[]; disabled: boolean; loading: boolean; draft: PipeDraft; now: number;
  editing: boolean; leaf: boolean; allowSelfDestruct: boolean; contingencyOptions: readonly PipeModel[];
  invalidContingency: boolean; removalPending: boolean;
}): readonly FormPage<PipeDraft>[] {
  const { form, page, row, input } = formBuilder<PipeDraft>({ defaults: { disabled } });

  const ownerPage = !editing && page(0,
    row(input("ownerId", {
      type: "select",
      accessibilityLabel: "Owner pipe",
      items: pipes,
      loading,
      validator: value => pipes.some(pipe => pipe.id === value) ? undefined : "Select an owner pipe",
      renderItem: item => pipeOption({ name: item.name, icon: item.icon }),
    })),
  );

  const detailsPage = page(1,
    row(input("name", { label: "Name", placeholder: "Pipe name", validator: validatePipeName })),
    row(input("description", { label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3 })),
    row(
      input("icon", { type: "icon", label: "Icon" }),
      input("priority", { type: "number", label: "Priority", min: 0, step: 1 }),
    ),
  );

  if (!leaf) return form(ownerPage, detailsPage);

  const capacity = draft.capacity && validatePipeCapacity(draft.capacity) === undefined ? parseMoney(draft.capacity) : 0;
  const incompatible = ruleDisallowsContingency(draft.selectedRule);
  const contingencyRow = !!(contingencyOptions.length || draft.contingencyPipeId || incompatible || removalPending) && row(
    input("contingencyPipeId", {
      type: "select",
      label: "Contingency",
      disabled: disabled || incompatible,
      items: [{ id: "none", name: "No contingency", icon: "shield" }, ...contingencyOptions],
      renderItem: item => pipeOption({ name: item.name, icon: item.icon }),
    }, {
      description: incompatible ? "This rule cannot use contingency." + (removalPending ? " Saving will remove the current contingency." : "")
        : invalidContingency ? "Selected contingency is no longer eligible. Choose another or clear it."
          : "At settlement, contingency covers spending above this pipe's capacity using the selected pipe's available money.",
    }),
  );

  return form(
    ownerPage,
    detailsPage,
    page(
      row(input("capacity", {
        type: "decimal",
        label: editing ? "Capacity" : "Initial capacity?",
        placeholder: "0.00",
        allowNegative: true,
        validator: value => validatePipeCapacity(value, editing),
      }, {
        description: "Capacity is this pipe's spending budget and allocation target. It does not add money; available money is allocated from its owner pipe. " +
          (editing ? "Enter zero explicitly, or a negative amount to represent debt." : "Leave blank for zero, or enter a negative amount to represent debt."),
      })),
    ),
    page(
      ...buildRuleRows(draft, { capacity, disabled, allowSelfDestruct, now }),
      contingencyRow,
    ),
  );
}
