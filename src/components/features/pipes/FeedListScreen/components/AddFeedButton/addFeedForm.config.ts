import { parseMoney } from "@domain/money";
import { formBuilder } from "@ui/Form";
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

function validateOptionalMoney(value: string, error: string): string | undefined {
  if (!value) return undefined;
  try {
    return parseMoney(value) >= 0 ? undefined : error;
  } catch {
    return error;
  }
}

export function buildAddFeedForm(draft: AddFeedDraft, disabled = false) {
  const { form, page, row, input } = formBuilder<AddFeedDraft>({ defaults: { disabled } });
  const contributedRow = draft.isBoiler && row(input("contributed", {
    type: "decimal",
    label: "Contributed amount",
    placeholder: "How much was put in it?",
    allowNegative: false,
    validator: value => validateOptionalMoney(value, "Enter a valid contribution"),
  }, {
    description: "The total principal you have put into this asset, excluding gains or losses. Leave blank to start at zero.",
  }));

  return form(
    page(
      row(
        input("isBoiler", {
          type: "toggle",
          options: [
            { label: "Feed", icon: "pipe" },
            { label: "Boiler", icon: "water-boiler" },
          ],
        },
        {
          description: draft.isBoiler
            ? "A boiler tracks an asset's current value and contributed principal separately. Think of investment accounts."
            : "A feed is a source for money entering your budget. Accounts, cash, and wallets are all feeds.",
        }),
      ),
      row(
        input("name", {
          label: "Name",
          placeholder: draft.isBoiler ? "Boiler name" : "Feed name",
          validator: value => {
            if (!value.trim()) return "Name is required";
            return value.trim().length < 2 ? "Name must be at least 2 characters" : undefined;
          },
        }),
        input("icon", {
          type: "icon",
          label: "Icon",
          validator: value => Object.hasOwn(ICON_REGISTRY, value) ? undefined : "Icon is required",
        }),
      ),
      row(
        input("description", {
          label: "Description",
          placeholder: "Optional description",
          multiline: true,
          numberOfLines: 3,
        }),
      ),
    ),
    page(
      row(
        input("amount", {
          type: "decimal",
          label: "Initial amount",
          placeholder: "Current value?",
          allowNegative: false,
          validator: value => validateOptionalMoney(value, "Enter a valid amount"),
        },
        {
          description: draft.isBoiler
            ? "The asset's current value, including any gains or losses. Leave blank to start at zero."
            : "The money currently available in this feed. Leave blank to start at zero.",
        }),
      ),
      contributedRow,
    ),
  );
}
