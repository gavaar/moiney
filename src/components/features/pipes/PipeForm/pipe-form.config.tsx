import { Text, View } from "react-native";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import { formBuilder, type FormPage } from "@ui/Form";
import type { PipeModel } from "@features/pipes/data/pipes";
import { buildRuleRows } from "@features/pipes/rules/rule-form";
import { pipeRuleDraft, type PipeDraft } from "./pipe-draft";
import { isFeedKind, PIPE_CHOICES } from "./pipe-kinds";
import { validateOpeningMoney, validatePipeCapacity, validatePipeName, type PipeFormPolicy } from "./pipe-form-policy";

// The input primitive emits strings; PipeForm normalizes that value into PipeKind.
export type PipeFormValues = Omit<PipeDraft, "kind"> & { kind: string | null };

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
  const { editing, root, leaf, contingencyOptions, invalidContingency, removalPending, nameMinimum } = policy;
  const choice = PIPE_CHOICES.find(item => item.id === draft.kind);
  const choices = PIPE_CHOICES.filter(item => !editing || !isFeedKind(item.id));

  const typeRow = row(
    input("kind", {
      type: "collapsible-select",
      label: "Pipe type",
      initiallyExpanded: typePickerInitiallyExpanded,
      validator: value => PIPE_CHOICES.some(item => item.id === value) ? undefined : "Pipe type is required",
      items: choices,
      isItemDisabled: item => isFeedKind(item.id) ? !policy.allowRootCreation : !policy.hasFeed || loading,
      groups: [
        ...(!editing ? [
          {
            id: "feeds",
            title: "Feeds",
            itemIds: PIPE_CHOICES.filter(item => item.group === "feeds").map(item => item.id),
            info: "Where money enters your pipe network. Choose a basic feed or a boiler that also tracks contributions." +
              (!policy.allowRootCreation ? " To create a feed, use Add pipe outside an existing pipe." : ""),
          },
        ] : []),
        {
          id: "inner",
          title: "Inner pipes",
          itemIds: PIPE_CHOICES.filter(item => item.group === "inner").map(item => item.id),
          info: "Pipes inside a feed's network. Each has an owner pipe, which may itself be an inner pipe. Create a feed before adding inner pipes.",
        },
      ],
    },
    { description: choice?.explanation })
  );

  const nameRow = row(
    input("icon", { type: "icon", label: "Icon" }),
    input("name", { label: "Name", placeholder: root ? "Feed name" : "Pipe name", validator: value => validatePipeName(value, nameMinimum) }, { grow: 4 }),
  );

  const descriptionRow = row(
    input("description", { label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3 })
  );

  const priority = input("priority", { type: "number", label: "Priority", min: 0, step: 1 });

  if (policy.mode === "edit-details") return form(
    page(1,
      row(
        input("icon", { type: "icon", label: "Icon" }),
        input("name",
          { label: "Name", validator: value => validatePipeName(value, nameMinimum) },
          {
            grow: 4,
            description: !leaf ? "Intermediate pipe: groups and allocates money to its children. It has no settlement rule of its own."
              : "Feeds settle spending instantly. For another settlement behavior, add an inner pipe.",
          }
        ),
      ),
      policy.priorityEditable && row(priority),
      descriptionRow,
    ),
  );

  if (policy.mode === "create-root") return form(
    page(0,
      typeRow,
      nameRow,
      draft.kind === "boiler" && row(
        input("contributed",
          { type: "decimal", label: "Contributed amount", placeholder: "0.00", validator: validateOpeningMoney },
          { description: "Contributed principal, excluding gains or losses. Independent of current value; blank means zero." }
        ),
      ),
      row(
        input("amount",
          { type: "decimal", label: "Initial amount", placeholder: "0.00", validator: validateOpeningMoney },
          { description: "Money currently available. Leave blank to start at zero." },
        ),
      ),
      descriptionRow,
    ),
  );

  const owner = pipes.find(pipe => pipe.id === draft.ownerId);
  const overview = page(0,
    typeRow,
    draft.kind !== null && row(
      input("ownerId",
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
    ),
  );

  if (policy.mode === "unselected") return form(overview);

  const capacity = draft.capacity && !validatePipeCapacity(draft.capacity) ? parseMoney(draft.capacity) : 0;
  const contingencyRow = draft.kind !== "instant_settlement" && row(
    input("contingencyPipeId",
      {
        type: "select",
        label: "Contingency",
        items: [
          { id: "none", name: "No contingency", icon: "shield" },
          ...contingencyOptions,
        ],
        renderItem: pipeOption,
      },
      {
        description: invalidContingency ? "Selected contingency is no longer eligible. Choose another or clear it."
          : "At settlement, covers spending above capacity using the selected pipe's available money. No eligible donor? Leave No contingency selected.",
      },
    ),
  );

  return form(
    overview,
    page(1,
      nameRow,
      row(priority,
        input("capacity", {
            type: "decimal",
            label: editing ? "Capacity" : "Initial capacity?",
            placeholder: "0.00",
            allowNegative: true,
            validator: value => validatePipeCapacity(value, editing),
          },
          {
            grow: 2,
            description: "Spending budget and allocation target, not added money or a hard spending limit. " + (editing ? "Enter zero explicitly; negative values represent debt." : "Blank means zero; negative values represent debt."),
          },
        ),
      ),
      ...buildRuleRows(pipeRuleDraft(draft), { capacity, disabled, now }),
      contingencyRow,
      descriptionRow.map(field => ({ ...field, description: removalPending ? "Saving will remove the current contingency because Instant cannot use it." : field.description })),
    ),
  );
}
