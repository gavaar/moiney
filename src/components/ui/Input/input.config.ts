export const BORDER_STYLES = {
  focused: "border-primary",
  error: "border-error",
  default: "border-border",
};

export function getBorderStyle(
  disabled: boolean | undefined,
  focused: boolean,
  error: string | undefined,
): string {
  if (disabled) return "border-border";
  if (focused) return BORDER_STYLES.focused;
  if (error) return BORDER_STYLES.error;
  return BORDER_STYLES.default;
}
