import type { Id } from "@convex/_generated/dataModel";
import type { TransactionStructure } from "@domain/transactions";
import type { PipeModel } from "@features/pipes/data/pipes";

export type AmountFormDraft = {
  sourcePipeId: string | null;
  title: string;
  value: string;
  date: Date;
  currentFed: string;
  sentTo: string | null;
  paidFrom: string | null;
};

export type SourcePicker = {
  pipes: readonly PipeModel[];
  loading: boolean;
  activeStep: number;
  onStepChange: (step: number) => void;
  onSelect: (id: Id<"pipes">) => void;
};

type CommonProps = {
  pipeId: Id<"pipes"> | null;
  onSuccess?: () => void;
  sourcePicker?: SourcePicker;
  fill?: boolean;
};

export type TransactionInitialState = {
  pipeIcon: string;
  pipeName: string;
  spent?: number;
  capacity?: number;
  title: string;
  value: string;
} & (
  | {
      transactionId: Id<"transactions">;
      date: number;
      intent?: "repeat" | "edit";
      structure: TransactionStructure<Id<"pipes">>;
    }
  | {
      transactionId?: never;
      date?: never;
      intent?: "create" | "repeat";
      structure?: TransactionStructure<Id<"pipes">>;
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
