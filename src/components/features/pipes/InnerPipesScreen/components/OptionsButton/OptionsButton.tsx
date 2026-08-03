import { useRef, useState, type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { Popover } from "@ui/Popover";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { DeletePipeConfirmation } from "@features/pipes/InnerPipesScreen/components/DeletePipeConfirmation";
import { EditPipeModal } from "@features/pipes/InnerPipesScreen/components/EditPipeModal";
import { AddPipeModal } from "@features/pipes/InnerPipesScreen/components/AddPipeModal";

type OptionsButtonProps = {
  pipeId: Id<"pipes">;
};

export function OptionsButton({ pipeId }: OptionsButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const gearRef = useRef<View>(null);

  return (
    <>
      <Pressable ref={gearRef} onPress={() => setShowOptions(true)}>
        <Icon name="settings-outline" size={16} color={colors.muted} />
      </Pressable>

      <Popover
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        anchorRef={gearRef as RefObject<View>}
        anchorPosition="left-start"
      >
        <Pressable
          className="flex-row items-center gap-2 px-2 py-1"
          onPress={() => {
            setShowOptions(false);
            setShowAddModal(true);
          }}
        >
          <Icon name="pipe-wrench" size={20} color={colors.text} />
          <Text className="text-text text-sm">Add pipe</Text>
        </Pressable>
        <View className="h-2" />
        <Pressable
          className="flex-row items-center gap-2 px-2 py-1"
          onPress={() => {
            setShowOptions(false);
            setShowEditModal(true);
          }}
        >
          <Icon name="pencil-outline" size={20} color={colors.secondary} />
          <Text className="text-text text-sm">Edit</Text>
        </Pressable>
        <View className="h-2" />
        <Pressable
          className="flex-row items-center gap-2 px-2 py-1"
          onPress={() => {
            setShowOptions(false);
            setShowDeleteModal(true);
          }}
        >
          <Icon name="trash-bin-outline" size={20} color={colors.error} />
          <Text className="text-text text-sm">Delete</Text>
        </Pressable>
      </Popover>

      <AddPipeModal
        parentId={pipeId}
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {showEditModal && (
        <EditPipeModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          pipeId={pipeId}
        />
      )}

      <DeletePipeConfirmation
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        pipeId={pipeId}
        onDeleted={() => setShowDeleteModal(false)}
      />
    </>
  );
}
