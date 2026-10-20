/** Private interaction signals consumed by the shared field presentation. */
export type InputInteraction = {
  onFocusChange: (focused: boolean) => void;
  onInteractionEnd: () => void;
  error?: string;
};

/** A trigger owns the shared padding so the entire central surface is clickable. */
export type InputTriggerProps = {
  triggerClassName: string;
};

export type InputValueProps<Value, Change = Value> = {
  value: Value;
  onChange?: (value: Change) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};
