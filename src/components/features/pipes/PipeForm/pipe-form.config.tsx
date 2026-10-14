import { Text, View } from "react-native";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import type { FormPage, FormRow } from "@ui/Form";
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
  const pages: FormPage<PipeDraft>[] = [];
  if (!editing) pages.push({
    key: 0,
    rows: [
      [
        {
          key: "ownerId",
          input: {
            type: "select",
            presentation: "inline",
            label: "Owner pipe",
            hideLabel: true,
            items: pipes,
            disabled,
            loading,
            validator: (value: string | null) => pipes.some(pipe => pipe.id === value) ? undefined : "Select an owner pipe",
            renderItem: item => pipeOption({ name: item.name, icon: item.icon }),
          }
        }
      ]
    ]
  });
  pages.push({
    key: 1,
    rows: [
      [{ key: "name", input: { label: "Name", placeholder: "Pipe name", disabled, validator: validatePipeName } }],
      [{ key: "description", input: { label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3, disabled } }],
      [
        { key: "icon", input: { type: "icon", label: "Icon", disabled } },
        { key: "priority", input: { type: "number", label: "Priority", min: 0, step: 1, disabled } }
      ],
    ]
  });
  if (!leaf) return pages;
  const capacity = draft.capacity && validatePipeCapacity(draft.capacity) === undefined ? parseMoney(draft.capacity) : 0;
  pages.push({
    key: 2,
    rows: [
      [
        {
          key: "capacity",
          input: {
            type: "decimal",
            label: editing ? "Capacity" : "Initial capacity?",
            placeholder: "0.00",
            allowNegative: true,
            disabled,
            validator: value => validatePipeCapacity(value, editing)
          },
          description: "Capacity is this pipe's spending budget and allocation target. It does not add money; available money is allocated from its owner pipe. " +
      (editing ? "Enter zero explicitly, or a negative amount to represent debt." : "Leave blank for zero, or enter a negative amount to represent debt."),
        }
      ]
    ]
  });
  const ruleRows: FormRow<PipeDraft>[] = [...buildRuleRows(draft, { capacity, disabled, allowSelfDestruct, now })];
  const incompatible = ruleDisallowsContingency(draft.selectedRule);
  if (contingencyOptions.length || draft.contingencyPipeId || incompatible || removalPending) ruleRows.push([
    {
      key: "contingencyPipeId",
      input: {
        type: "select",
        label: "Contingency",
        disabled: disabled || incompatible,
        items: [{ id: "none", name: "No contingency", icon: "shield" }, ...contingencyOptions],
        renderItem: item => pipeOption({ name: item.name, icon: item.icon }),
      },
      description: incompatible ? "This rule cannot use contingency." + (removalPending ? " Saving will remove the current contingency." : "")
        : invalidContingency ? "Selected contingency is no longer eligible. Choose another or clear it."
          : "At settlement, contingency covers spending above this pipe's capacity using the selected pipe's available money.",
    }
  ]);
  pages.push({ key: 3, rows: ruleRows });
  return pages;
}
