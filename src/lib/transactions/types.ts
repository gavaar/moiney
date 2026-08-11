import type { Doc } from "@convex/_generated/dataModel";

export type TransactionWithPipeIcons = Doc<"transactions"> & {
  fromIcon?: string;
  toIcon?: string;
  paidFromIcon?: string;
};
