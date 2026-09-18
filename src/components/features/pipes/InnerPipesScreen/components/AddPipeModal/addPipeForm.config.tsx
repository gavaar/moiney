import { Text, View } from "react-native";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Icon, safeIconName, type IconName } from "@ui/Icon";
import type { FormProps } from "@ui/Form";
import type { PipeModel } from "@features/pipes/data/pipes";

export type AddPipeDraft = {
  ownerId: string | null;
  name: string;
  description: string;
  icon: IconName | "";
  priority: number;
  capacity: string;
};

export function validatePipeName(value: string): string | undefined {
  if (!value.trim()) return "Name is required";
  if (value.trim().length < 3) return "Name must be at least 3 characters";
  return undefined;
}

export function validatePipeCapacity(value: string): string | undefined {
  if (!value) return undefined;
  try {
    parseMoney(value);
    return undefined;
  } catch {
    return "Enter a valid capacity";
  }
}

export function buildAddPipeForm(pipes: readonly PipeModel[], disabled: boolean, loading: boolean) {
  return [
    {
      key: "ownerId", step: 0,
      input: {
        type: "select", presentation: "inline", label: "Owner pipe", hideLabel: true,
        items: pipes, disabled, loading,
        validator: (value: string | null) => pipes.some(pipe => pipe.id === value) ? undefined : "Select an owner pipe",
        renderItem: item => (
          <View className="flex-row items-center gap-2">
            <Icon name={safeIconName(item.icon)} size={22} color={colors.muted} />
            <Text className="flex-1 text-text" numberOfLines={1}>{item.name}</Text>
          </View>
        ),
      },
    },
    {
      key: "name", step: 1,
      input: { label: "Name", placeholder: "Pipe name", disabled, validator: validatePipeName },
    },
    {
      key: "description", step: 1,
      input: { label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3, disabled },
    },
    { key: "icon", step: 1, row: "icon-priority", input: { type: "icon", label: "Icon", disabled } },
    { key: "priority", step: 1, row: "icon-priority", input: { type: "number", label: "Priority", min: 0, step: 1, disabled } },
    {
      key: "capacity", step: 2,
      input: { type: "decimal", label: "Initial capacity?", placeholder: "0.00", allowNegative: true, disabled, validator: validatePipeCapacity },
      description: "Capacity is this pipe's spending budget and allocation target. It does not add money; available money is allocated from its owner pipe. Leave blank for zero, or enter a negative amount to represent debt.",
    },
  ] satisfies FormProps<AddPipeDraft>["form"];
}
