import { Fragment, RefObject, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { Popover } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { getDaysInMonth } from "@/lib/dates";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
import { DeletePipeConfirmation } from "@/features/pipes/InnerPipesScreen/components/DeletePipeConfirmation";
import { EditPipeModal } from "@/features/pipes/InnerPipesScreen/components/EditPipeModal";

type StatItem = {
  label: string;
  value: number;
  title: string;
  description: string;
  ref: RefObject<View | null>;
};

type Props = {
  fed: number;
  spent: number;
};

export function StatisticsRow({ fed, spent }: Props) {
  const daysInMonth = getDaysInMonth();
  const [selectedStatLabel, setSelectedStatLabel] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const ellipsisRef = useRef<View>(null);
  const l2sRef = useRef<View>(null);
  const stmRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);
  const { selectedPipePath, pipesById, isLoading } = usePipeSelection();

  const selectedId = selectedPipePath.length > 0
    ? selectedPipePath[selectedPipePath.length - 1]
    : null;
  const currentPipe = selectedId && pipesById ? pipesById[selectedId] : null;

  const stats: StatItem[] = [
    {
      label: "L2S",
      value: fed - spent,
      title: "Left to spend (L2S)",
      description: "How much left can be spent from this pipe at the moment",
      ref: l2sRef,
    },
    {
      label: "StM",
      value: spent,
      title: "Spent this month (StM)",
      description: "How much have been spent this month",
      ref: stmRef,
    },
    {
      label: "StMpD",
      value: daysInMonth > 0 ? spent / daysInMonth : 0,
      title: "Spent this month per day (StMpD)",
      description: "An average of how much was spent per day in this pipe, this month",
      ref: stmpdRef,
    },
  ];

  return (
    <>
      <View className="flex-row self-stretch justify-center gap-1 pb-2 px-5">
        {stats.map((stat, index) => (
          <Fragment key={stat.label}>
            {index > 0 && (<Text className="text-muted/50 text-xs">|</Text>)}

            <View className="flex-row items-center">
              <Pressable ref={stat.ref} onPress={() => setSelectedStatLabel(stat.label)}>
                <Text className="text-text text-sm border border-muted/50 px-2 rounded-md">
                  {stat.label}: {stat.value.toFixed(2)}
                </Text>
              </Pressable>

              <Popover
                visible={selectedStatLabel === stat.label}
                onClose={() => setSelectedStatLabel(null)}
                anchorRef={stat.ref as RefObject<View>}
                anchorPosition="bottom"
              >
                <Text className="text-text font-bold text-md">{stats[index].title}:</Text>
                <Text className="text-text text-sm">{stats[index].description}</Text>
              </Popover>
            </View>
          </Fragment>
        ))}

        <View className="ml-auto">
          <Pressable ref={ellipsisRef} onPress={() => setShowOptions(true)}>
            <Icon name="ellipsis-vertical" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <Popover
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        anchorRef={ellipsisRef as RefObject<View>}
        anchorPosition="left-start"
      >
        <Pressable onPress={() => {
          setShowOptions(false);
          setShowEditModal(true);
        }}>
          <Icon name="pencil-outline" size={24} color={colors.secondary} />
        </Pressable>
        <View className="h-5" />
        <Pressable onPress={() => {
          setShowOptions(false);
          setShowDeleteModal(true);
        }}>
          <Icon name="trash-bin-outline" size={24} color={colors.error} />
        </Pressable>
      </Popover>

      {selectedId && !isLoading && (
        <DeletePipeConfirmation
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          pipeId={selectedId as Id<"pipes">}
          onDeleted={() => setShowDeleteModal(false)}
        />
      )}

      {selectedId && showEditModal && (
        <EditPipeModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          pipeId={selectedId as Id<"pipes">}
        />
      )}
    </>
  );
}
