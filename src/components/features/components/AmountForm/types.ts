import type { Id } from "@convex/_generated/dataModel";
import type { TransactionStructure } from "@domain/transactions";

type CommonProps = {
  pipeId: Id<"pipes">;
  onSuccess?: () => void;
};

export type TransactionInitialState = {
  pipeIcon: string;
  pipeName: string;
  spent?: number;
  capacity?: number;
  title: string;
  value: string;
  structure: TransactionStructure<Id<"pipes">>;
} & (
  | {
      transactionId: Id<"transactions">;
      date: number;
      intent?: "repeat" | "edit";
    }
  | {
      transactionId?: never;
      date?: never;
      intent?: "create" | "repeat";
    }
);

export type AmountFormProps = CommonProps & (
  | {
      variant?: "spend";
      boilerName?: never;
      currentFed?: never;
      initState?: never;
    }
  | {
      variant: "feed";
      boilerName?: never;
      currentFed?: never;
      initState?: never;
    }
  | {
      variant: "boiler";
      boilerName: string;
      currentFed: number;
      initState?: never;
    }
  | {
      variant: "transaction";
      boilerName?: never;
      currentFed?: never;
      initState: TransactionInitialState;
    }
);
