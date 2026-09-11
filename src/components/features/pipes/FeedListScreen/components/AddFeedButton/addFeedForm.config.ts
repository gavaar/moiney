import { parseMoney } from "@domain/money";
import type { FormProps } from "@ui/Form";
import { ICON_REGISTRY, type IconName } from "@ui/Icon";

export type AddFeedDraft = {
  isBoiler: boolean;
  name: string;
  icon: IconName | "";
  description: string;
  amount: string;
  contributed: string;
};

export const ADD_FEED_DEFAULTS: AddFeedDraft = {
  isBoiler: false,
  name: "",
  icon: "",
  description: "",
  amount: "",
  contributed: "",
};

function validateOptionalMoney(value: string, error: string): string | null {
  if (!value) return null;
  try {
    return parseMoney(value) >= 0 ? null : error;
  } catch {
    return error;
  }
}

export function buildAddFeedForm(draft: AddFeedDraft, disabled = false) {
  return [
    {
      key: "isBoiler",
      step: 0,
      input: {
        type: "toggle",
        options: [{ label: "Feed", icon: "pipe" }, { label: "Boiler", icon: "water-boiler" }],
        disabled,
      },
      description: draft.isBoiler
        ? "A boiler tracks an asset's current value and contributed principal separately. Think of investment accounts."
        : "A feed is a source for money entering your budget. Accounts, cash, and wallets are all feeds.",
      validator: (_value: boolean) => null,
    },
    {
      key: "name",
      step: 0,
      input: { type: "text", label: "Name", placeholder: draft.isBoiler ? "Boiler name" : "Feed name", disabled },
      validator: (value: string) => {
        if (!value.trim()) return "Name is required";
        return value.trim().length < 2 ? "Name must be at least 2 characters" : null;
      },
    },
    {
      key: "icon",
      step: 0,
      input: { type: "icon", label: "Icon", disabled },
      validator: (value: string) => Object.hasOwn(ICON_REGISTRY, value) ? null : "Icon is required",
    },
    {
      key: "description",
      step: 0,
      input: { type: "text", label: "Description", placeholder: "Optional description", multiline: true, numberOfLines: 3, disabled },
      validator: () => null,
    },
    {
      key: "amount",
      step: 1,
      input: { type: "decimal", label: "Initial amount", placeholder: "Current value?", allowNegative: false, disabled },
      description: draft.isBoiler
        ? "The asset's current value, including any gains or losses. Leave blank to start at zero."
        : "The money currently available in this feed. Leave blank to start at zero.",
      validator: (value: string) => validateOptionalMoney(value, "Enter a valid amount"),
    },
    ...(draft.isBoiler ? [{
      key: "contributed" as const,
      step: 1,
      input: { type: "decimal" as const, label: "Contributed amount", placeholder: "How much was put in it?", allowNegative: false, disabled },
      description: "The total principal you have put into this asset, excluding gains or losses. Leave blank to start at zero.",
      validator: (value: string) => validateOptionalMoney(value, "Enter a valid contribution"),
    }] : []),
  ] satisfies FormProps<AddFeedDraft>["form"];
}
