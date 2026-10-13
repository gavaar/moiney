import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type IconName, Icon, safeIconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { ModalShell } from "@ui/Modal";
import { Button } from "@ui/Button";
import { useAlert } from "@ui/Alert";
import { type Id } from "@convex/_generated/dataModel";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { colors } from "@/lib/styles";
import { formatMoneyInput, parseMoney } from "@domain/money";
import { prepareContingencyEligibility } from "@domain/pipes";

type EditPipeModalProps = {
  visible: boolean;
  onClose: () => void;
  pipeId: Id<"pipes">;
};

export function EditPipeModal({ visible, onClose, pipeId }: EditPipeModalProps) {
  const { pipesById, allPipes } = usePipeCatalog();
  const pipe = pipesById?.[pipeId];

  const [name, setName] = useState(pipe?.name ?? "");
  const [icon, setIcon] = useState<IconName | "">((pipe?.icon as IconName) ?? "pipe");
  const [description, setDescription] = useState(pipe?.description ?? "");
  const [priority, setPriority] = useState(pipe?.priority ?? 0);
  const [capacity, setCapacity] = useState(
    pipe ? formatMoneyInput(pipe.capacity) : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contingencyPipeId, setContingencyPipeId] = useState(pipe?.contingencyPipeId ?? null);
  const [contingencyChanged, setContingencyChanged] = useState(false);
  const eligibleIds = prepareContingencyEligibility((allPipes ?? []).map(item => ({
    id: item.id, parentId: item.parentId, rule: item.rule,
    contingencyPipeId: item.contingencyPipeId, blocked: item.deletionJobId !== undefined,
  })))(pipeId);
  const contingencyOptions = (allPipes ?? []).filter(item => eligibleIds.includes(item.id));
  const invalidContingency = contingencyPipeId !== null && !eligibleIds.includes(contingencyPipeId);
  const showAlert = useAlert();
  const updatePipe = useMutation(api.pipes.updatePipe);

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 3) return "Name must be at least 3 characters";
    return undefined;
  };

  const handleSubmit = async () => {
    if (validateName(name) !== undefined || (contingencyChanged && invalidContingency) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updatePipe({
        pipeId,
        name: name.trim(),
        icon: icon || "pipe",
        description: description.trim() === "" ? null : description,
        priority,
        capacity: capacity ? parseMoney(capacity) : undefined,
        ...(contingencyChanged ? { contingencyPipeId } : {}),
      });
      onClose();
    } catch (error) {
      showAlert.error(`${error}`);
      setIsSubmitting(false);
    }
  };

  if (!pipe) return null;

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <ScrollView style={{ flexGrow: 0 }}>
        <View className="gap-4">
          <View className="flex-row items-center gap-2">
            <Icon name={pipe.icon as IconName} size={20} color={colors.muted} />
            <Text className="text-muted text-lg">{pipe.name}</Text>
          </View>

          <Input
            label="Name"
            placeholder="Pipe name"
            value={name}
            onChange={setName}
            validator={validateName}
          />

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Input
                type="decimal"
                label={Number(capacity) < 0 ? "Debt" : "Capacity"}
                value={capacity}
                onChange={setCapacity}
                placeholder="0.00"
                allowNegative={true}
              />
            </View>
            <View className="flex-1">
              <Input
                type="number"
                label="Priority"
                value={priority}
                onChange={setPriority}
                min={0}
                step={1}
              />
            </View>
          </View>

          {contingencyOptions.length > 0 || contingencyPipeId ? (
            <Input
              type="select"
              label="Contingency"
              value={contingencyPipeId ?? "none"}
              items={[{ id: "none", name: "No contingency", icon: "shield" }, ...contingencyOptions]}
              onChange={(selectedId: string) => {
                setContingencyPipeId(contingencyOptions.find(item => item.id === selectedId)?.id ?? null);
                setContingencyChanged(true);
              }}
              renderItem={item => (
                <View className="flex-row items-center gap-2">
                  <Icon name={safeIconName(item.icon)} size={20} color={colors.muted} />
                  <Text className="text-text flex-1" numberOfLines={1}>{item.name}</Text>
                </View>
              )}
            />
          ) : null}
          {invalidContingency ? (
            <Text className="text-error text-sm">Selected contingency is no longer eligible. Choose another or clear it.</Text>
          ) : null}

          <Input type="icon" label="Icon" value={icon} onChange={setIcon} />

          <Input
            label="Description"
            placeholder="Optional description"
            value={description}
            onChange={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View className="mt-4">
        <Button title="Submit" loading={isSubmitting} onPress={handleSubmit} disabled={validateName(name) !== undefined || (contingencyChanged && invalidContingency)} />
      </View>
    </ModalShell>
  );
}
