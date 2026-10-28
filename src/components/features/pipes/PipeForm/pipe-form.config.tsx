import { Text, View } from "react-native";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { formBuilder, type FormPage } from "@ui/Form";
import type { PipeModel } from "@features/pipes/data/pipes";
import { buildRuleRows } from "@features/pipes/rules/rule-form";
import { pipeRuleDraft, type PipeDraft } from "./pipe-draft";
import { isFeedKind, PIPE_KINDS } from "@features/pipes/rules/config";
import { validateOpeningMoney, validatePipeCapacity, validatePipeName, type PipeFormPolicy } from "./pipe-form-policy";

export type PipeFormValues = Omit<PipeDraft, "kind"> & { kind: string | null; warningsAcknowledged: boolean };

function pipeOption(item: { name: string; icon: string }) {
  return <View className="flex-row items-center gap-2">
    <Icon name={safeIconName(item.icon)} size={22} color={colors.muted} />
    <Text className="flex-1 text-text" numberOfLines={1}>{item.name}</Text>
  </View>;
}

export function buildPipeForm({ pipes, disabled, loading, draft, now, policy, typePickerInitiallyExpanded }: {
  pipes: readonly PipeModel[]; disabled: boolean; loading: boolean; draft: PipeDraft; now: number;
  policy: PipeFormPolicy;
  typePickerInitiallyExpanded: boolean;
}): readonly FormPage<PipeFormValues>[] {
  const { form, page, row, input } = formBuilder<PipeFormValues>({ defaults: { disabled } });
  const { editing, root, contingencyOptions, invalidContingency, nameMinimum } = policy;

  const choice = draft.kind && PIPE_KINDS[draft.kind];
  const allChoices = Object.values(PIPE_KINDS);
  const choices = allChoices.filter(item => !editing || !isFeedKind(item.id));
  const owner = pipes.find(pipe => pipe.id === draft.ownerId);

  const capacity = draft.capacity && !validatePipeCapacity(draft.capacity) ? parseMoney(draft.capacity) : 0;
  const ruleRows = buildRuleRows(pipeRuleDraft(draft), { capacity, disabled, now });
  const { kind, icon, name, description, priority, contributed, amount, ownerId, pipeCapacity, contingencyPipeId } = {
    kind: input("kind",
      {
        type: "collapsible-select",
        label: "Pipe type",
        initiallyExpanded: typePickerInitiallyExpanded && draft.kind === null,
        validator: value => allChoices.some(item => item.id === value) ? undefined : "Pipe type required",
        items: choices.map(item => ({
          ...item,
          iconColor: item.color,
        })),
        isItemDisabled: item => isFeedKind(item.id) ? !policy.allowRootCreation : !policy.hasFeed || loading,
        groups: [
          ...(!editing ? [
            {
              id: "feeds",
              title: "Feeds",
              itemIds: allChoices.filter(item => item.group === "feeds").map(item => item.id),
              info: "Where money enters your pipe network. Choose a basic feed or a boiler that also tracks contributions." +
                (!policy.allowRootCreation ? " To create a feed, use Add pipe outside an existing pipe." : ""),
            },
          ] : []),
          {
            id: "inner",
            title: "Inner pipes",
            itemIds: allChoices.filter(item => item.group === "inner").map(item => item.id),
            info: "Pipes inside a feed's network. Each has an owner pipe, which may itself be an inner pipe. Create a feed before adding inner pipes.",
          },
        ],
      },
      { description: choice?.shortDescription },
    ),
    icon: input("icon", { type: "icon", label: "Icon" }),
    name: input("name", { label: "Name", placeholder: root ? "Feed name" : "Pipe name", validator: value => validatePipeName(value, nameMinimum) }, { grow: 4 }),
    description: input("description", { label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3 }),
    priority: input("priority",
      { type: "number", label: "Priority", min: 0, step: 1 },
      {
         description: `Order in which funds are received.
Lower receive sooner.`,
      }
    ),
    contributed: input("contributed",
      { type: "decimal", label: "Contributed amount", placeholder: "0.00", validator: validateOpeningMoney },
      {
        description: `Funds contributed, excluding gains or losses.
Independe of current funds. Leave blank to set to zero.`,
      },
    ),
    amount: input("amount",
      { type: "decimal", label: "Initial amount", placeholder: "0.00", validator: validateOpeningMoney },
      { description: "Available funds at creation time. Leave blank to set to zero." },
    ),
    ownerId: input("ownerId",
      {
        type: "select",
        label: "Owner pipe",
        items: pipes,
        loading,
        disabled: disabled || editing,
        validator: value => pipes.some(pipe => pipe.id === value) ? undefined : "Select an owner pipe",
        renderItem: pipeOption,
      },
      { description: editing && `Owner: ${owner?.name ?? "Unavailable"}. Ownership cannot be changed.` },
    ),
    pipeCapacity: input("capacity", {
        type: "decimal",
        label: editing ? "Capacity" : "Starting capacity?",
        placeholder: "0.00",
        allowNegative: true,
        validator: value => validatePipeCapacity(value, editing),
      },
      {
        grow: 2,
        description: `Size of the container (budget). Funds will be added up to this amount. Depending on pipe type, capacity can vary`,
      },
    ),
    contingencyPipeId: input("contingencyPipeId", {
        type: "select",
        label: "Contingency",
        items: [
          { id: "none", name: "No contingency", icon: "shield" },
          ...contingencyOptions,
        ],
        renderItem: pipeOption,
      },
      {
        description: invalidContingency ? 'Selected contingency is no longer eligible. Choose another or clear it.'
          : 'Select a pipe to cover this pipe\'s overspending. Useful when budgets need flexibility.',
      },
    ),
  };

  switch(policy.mode) {
    case 'edit-details':
      return form(
        page(
          row(icon, name),
          policy.priorityEditable && row(priority),
          row(description),
        ),
      );
    case 'create-root':
      return form(
        page(
          row(kind),
          row(icon, name),
          draft.kind === 'boiler' && row(contributed),
          row(amount),
          row(description),
        ),
      );
    case 'unselected':
      return form(
        page(
          row(kind),
          row(icon, name),
        ),
      );
    default:
      return form(
        page(
          row(kind),
          draft.kind && row(ownerId),
          draft.kind && row(icon, name),
          draft.kind && row(priority, pipeCapacity),
        ),
        page(
          ...ruleRows,
          row(contingencyPipeId),
          row(description),
        ),
      );
  }
}
