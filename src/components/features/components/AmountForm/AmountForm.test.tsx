// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { type Id } from "@convex/_generated/dataModel";
import { AmountForm } from "./AmountForm";
import {
  buildCreateTransactionCommand,
  buildEditTransactionCommand,
  buildPaidFromPipeItems,
  buildPipeItems,
  getIntentDate,
  getButtonIcon,
  getButtonLabel,
  getButtonStyle,
  getDestinationPipeName,
  getTopmostPipeId,
  transitionSpendMode,
} from "./helpers";

const PIPE_ID = "pipe-1" as Id<"pipes">;
const mockCreateTransaction = vi.fn().mockResolvedValue(undefined);
const mockContributeToBoiler = vi.fn().mockResolvedValue(null);
const mockEditTransactionFn = vi.fn().mockResolvedValue(undefined);
const mockInvalidateAll = vi.fn().mockResolvedValue(undefined);
const mockAddTransaction = vi.fn().mockResolvedValue(undefined);
const mockUpdateTransaction = vi.fn().mockResolvedValue(undefined);

const mockRecentTitles: string[] = [];
vi.mock("convex/react", () => ({
  useMutation: (api: any) => {
    if (api === "createTransaction") return mockCreateTransaction;
    if (api === "contributeToBoiler") return mockContributeToBoiler;
    if (api === "editTransaction") return mockEditTransactionFn;
    return vi.fn();
  },
  useQuery: () => mockRecentTitles,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {},
    transactions: {
      createTransaction: "createTransaction",
      contributeToBoiler: "contributeToBoiler",
      editTransaction: "editTransaction",
      listRecentTitles: "listRecentTitles",
    },
  },
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    allPipes: [
      {
        id: "feed-1" as Id<"pipes">,
        _creationTime: 0,
        userId: "user-1" as Id<"users">,
        parentId: undefined,
        name: "Salary",
        icon: "cash-outline",
        priority: 0,
        fed: 500,
        spent: 200,
      },
      {
        id: "feed-2" as Id<"pipes">,
        _creationTime: 0,
        userId: "user-1" as Id<"users">,
        parentId: undefined,
        name: "Freelance",
        icon: "laptop-outline",
        priority: 0,
        fed: 300,
        spent: 100,
      },
      {
        id: "child-1" as Id<"pipes">,
        _creationTime: 0,
        userId: "user-1" as Id<"users">,
        parentId: "feed-1" as Id<"pipes">,
        name: "Rent",
        icon: "home-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 300,
      },
    ],
    childrenByParent: new Map(),
    pipesById: {},
    isLoading: false,
  }),
}));

vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({
  useOptionalTransactionCache: () => ({
    invalidateAll: mockInvalidateAll,
    addTransaction: mockAddTransaction,
    updateTransaction: mockUpdateTransaction,
  }),
}));

vi.mock("@ui/Input", () => ({
  Input: ({ label, type, value, onChangeText, onChange, disabled, placeholder, allowNegative, error, maxLength, items, onSelect, options, onOptionSelect }: any) => {
    if (type === "date") {
      return (
        <div data-testid={`input-${label}`}>
          <span>{label}</span>
          <span>
            {value instanceof Date
              ? `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`
              : ""}
          </span>
        </div>
      );
    }
    if (type === "select") {
      return (
        <div data-testid={`input-${label}`}>
          <span>{label}</span>
          <span data-testid={`select-value-${label}`}>
            {value
              ? items?.find((i: any) => i.id === value)?.name ?? "Unknown"
              : placeholder ?? "Select..."}
          </span>
          <div data-testid={`select-items-${label}`}>
            {items?.map((item: any) => (
              <button
                key={item.id}
                data-testid={`select-item-${item.id}`}
                onClick={() => onSelect?.(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (type === "text-select") {
      const labelKey = label ?? "";
      return (
        <div data-testid={`input-${labelKey}`}>
          <span>{label}</span>
          <input
            data-testid={`input-${labelKey}-field`}
            value={value}
            onChange={(e) => onChangeText?.(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
          {options?.length > 0 && (
            <div data-testid={`text-select-options-${labelKey}`}>
              {options.map((opt: string) => (
                <button
                  key={opt}
                  data-testid={`text-select-option-${opt}`}
                  onClick={() => onOptionSelect?.(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          {maxLength !== undefined && (
            <span data-testid={`input-${labelKey}-counter`}>
              {String(value ?? "").length} / {maxLength}
            </span>
          )}
        </div>
      );
    }
    return (
      <div data-testid={`input-${label}`}>
        <span>{label}</span>
        <input
          data-testid={`input-${label}-field`}
          value={value}
          onChange={(e) => (onChangeText || onChange)?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          data-allow-negative={allowNegative}
        />
        {error ? (
          <span data-testid={`input-${label}-error`}>{error}</span>
        ) : maxLength !== undefined ? (
          <span data-testid={`input-${label}-counter`}>
            {String(value ?? "").length} / {maxLength}
          </span>
        ) : null}
      </div>
    );
  },
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID || "icon"} data-name={name} />,
}));

describe("getButtonLabel", () => {
  it('returns "Feed" for feed mode', () => {
    expect(getButtonLabel("feed", false, null)).toBe("Feed");
  });

  describe("spend mode", () => {
    it('returns "Add expense" when negative and no destination', () => {
      expect(getButtonLabel("spend", true, null)).toBe("Add expense");
    });

    it('returns "Add return" when positive and no destination', () => {
      expect(getButtonLabel("spend", false, null)).toBe("Add return");
    });

    it('returns "Send to {name}" when negative and destination set', () => {
      expect(getButtonLabel("spend", true, "Salary")).toBe("Send to Salary");
    });

    it('returns "Take from {name}" when positive and destination set', () => {
      expect(getButtonLabel("spend", false, "Freelance")).toBe("Take from Freelance");
    });
  });
});

describe("buildCreateTransactionCommand", () => {
  it("builds a pay-by-transfer expense command with signed cents", () => {
    const date = new Date(2026, 6, 21, 15, 45).getTime();

    expect(
      buildCreateTransactionCommand({
        title: "Coffee",
        amount: -500,
        date,
        pipeId: PIPE_ID,
        isFeed: false,
        spendMode: "spend",
        sentToPipeId: null,
        paidFromPipeId: "feed-2" as Id<"pipes">,
      }),
    ).toEqual({
      title: "Coffee",
      value: -500,
      date,
      from: PIPE_ID,
      paidFrom: "feed-2",
    });
  });
});

describe("buildEditTransactionCommand", () => {
  it("builds an edit command with the supplied title and integer cents", () => {
    const transactionId = "transaction-1" as Id<"transactions">;
    const date = new Date(2026, 6, 21, 15, 45).getTime();

    expect(
      buildEditTransactionCommand({
        transactionId,
        title: " Lunch ",
        amount: -1250,
        date,
      }),
    ).toEqual({
      transactionId,
      title: " Lunch ",
      value: -1250,
      date,
    });
  });
});

describe("getIntentDate", () => {
  const now = new Date(2026, 6, 21, 15, 45);
  const initialDate = new Date(2026, 5, 10, 8, 30).getTime();

  it.each([
    ["edit with an initial date", "edit" as const, initialDate, new Date(initialDate)],
    ["repeat", "repeat" as const, initialDate, now],
  ])("returns the date for %s", (_label, intent, initial, expected) => {
    expect(getIntentDate(intent, initial, now)).toEqual(expected);
  });

  it("leaves the date unchanged when editing without an initial date", () => {
    expect(getIntentDate("edit", undefined, now)).toBeUndefined();
  });
});

describe("transitionSpendMode", () => {
  it("clears the transfer destination when entering spend mode", () => {
    expect(
      transitionSpendMode(
        {
          spendMode: "transfer",
          sentToPipeId: "feed-1" as Id<"pipes">,
          paidFromPipeId: "feed-2" as Id<"pipes">,
          showPaidFrom: true,
        },
        "spend",
      ),
    ).toEqual({
      spendMode: "spend",
      sentToPipeId: null,
      paidFromPipeId: "feed-2",
      showPaidFrom: true,
    });
  });

  it("clears the payer and hides the paid-from selector in transfer mode", () => {
    expect(
      transitionSpendMode(
        {
          spendMode: "spend",
          sentToPipeId: null,
          paidFromPipeId: "feed-2" as Id<"pipes">,
          showPaidFrom: true,
        },
        "transfer",
      ),
    ).toEqual({
      spendMode: "transfer",
      sentToPipeId: null,
      paidFromPipeId: null,
      showPaidFrom: false,
    });
  });
});

describe("buildPipeItems", () => {
  const allPipes = [
    { id: "feed-1" as Id<"pipes">, parentId: undefined as Id<"pipes"> | undefined, name: "Salary", icon: "cash-outline" },
    { id: "feed-2" as Id<"pipes">, parentId: undefined as Id<"pipes"> | undefined, name: "Freelance", icon: "laptop-outline" },
    { id: "child-1" as Id<"pipes">, parentId: "feed-1" as Id<"pipes">, name: "Rent", icon: "home-outline" },
  ];

  it("returns None option and all feeds when pipeId has no root ancestor", () => {
    const result = buildPipeItems(allPipes, "pipe-1" as Id<"pipes">);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: "", name: "None", icon: "close-circle" });
    expect(result[1].name).toBe("Salary");
    expect(result[2].name).toBe("Freelance");
  });

  it("excludes the current pipe's root ancestor from feed options", () => {
    const result = buildPipeItems(allPipes, "child-1" as Id<"pipes">);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Freelance");
  });

  it("excludes non-root pipes from feed options", () => {
    const result = buildPipeItems(allPipes, "pipe-1" as Id<"pipes">);
    result.forEach((item) => {
      if (item.id) {
        expect(item.id).not.toBe("child-1");
      }
    });
  });

  it("excludes pipes that are being deleted from feed options", () => {
    const result = buildPipeItems(
      [
        ...allPipes,
        {
          id: "deleting-feed" as Id<"pipes">,
          parentId: undefined,
          name: "Deleting feed",
          icon: "trash",
          deletionJobId: "job-1" as Id<"pipeDeletionJobs">,
        },
      ],
      "pipe-1" as Id<"pipes">,
    );

    expect(result.map((item) => item.name)).not.toContain("Deleting feed");
  });

  it("handles null allPipes gracefully", () => {
    const result = buildPipeItems(null, "pipe-1" as Id<"pipes">);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("None");
  });
});

describe("buildPaidFromPipeItems", () => {
  const allPipes = [
    { id: "feed-1" as Id<"pipes">, parentId: undefined, name: "Salary", icon: "cash-outline" },
    { id: "feed-2" as Id<"pipes">, parentId: undefined, name: "Freelance", icon: "laptop-outline" },
    { id: "feed-3" as Id<"pipes">, parentId: undefined, name: "Savings", icon: "wallet-outline" },
    { id: "child-1" as Id<"pipes">, parentId: "feed-1" as Id<"pipes">, name: "Rent", icon: "home-outline" },
    { id: "child-2" as Id<"pipes">, parentId: "feed-1" as Id<"pipes">, name: "Coffee", icon: "cafe-outline" },
    { id: "child-3" as Id<"pipes">, parentId: "feed-3" as Id<"pipes">, name: "Emergency", icon: "alert-outline" },
  ];

  it("offers childless pipes for a payment", () => {
    expect(buildPaidFromPipeItems(allPipes, "child-1" as Id<"pipes">, true))
      .toEqual([
        { id: "", name: "None", icon: "close-circle" },
        { id: "feed-2", name: "Freelance", icon: "laptop-outline" },
        { id: "child-3", name: "Emergency", icon: "alert-outline" },
      ]);
  });

  it("offers roots outside the current tree for a refund", () => {
    expect(buildPaidFromPipeItems(allPipes, "child-1" as Id<"pipes">, false))
      .toEqual([
        { id: "", name: "None", icon: "close-circle" },
        { id: "feed-2", name: "Freelance", icon: "laptop-outline" },
        { id: "feed-3", name: "Savings", icon: "wallet-outline" },
      ]);
  });

  it("excludes deleting pipes from payer and refund options", () => {
    const deletingPipes = allPipes.map((pipe) =>
      pipe.id === "feed-2"
        ? { ...pipe, deletionJobId: "job-1" as Id<"pipeDeletionJobs"> }
        : pipe,
    );

    expect(
      buildPaidFromPipeItems(deletingPipes, "child-1" as Id<"pipes">, true),
    ).not.toContainEqual({ id: "feed-2", name: "Freelance", icon: "laptop-outline" });
    expect(
      buildPaidFromPipeItems(deletingPipes, "child-1" as Id<"pipes">, false),
    ).not.toContainEqual({ id: "feed-2", name: "Freelance", icon: "laptop-outline" });
  });
});

describe("getTopmostPipeId", () => {
  it("resolves a nested pipe to its root", () => {
    const pipes = [
      { id: "root" as Id<"pipes">, name: "Root", icon: "wallet" },
      {
        id: "child" as Id<"pipes">,
        parentId: "root" as Id<"pipes">,
        name: "Child",
        icon: "folder",
      },
      {
        id: "leaf" as Id<"pipes">,
        parentId: "child" as Id<"pipes">,
        name: "Leaf",
        icon: "cafe",
      },
    ];

    expect(getTopmostPipeId(pipes, "leaf" as Id<"pipes">)).toBe("root");
  });
});

describe("getDestinationPipeName", () => {
  const allPipes = [
    { id: "feed-1" as Id<"pipes">, name: "Salary" },
    { id: "feed-2" as Id<"pipes">, name: "Freelance" },
  ];

  it("returns null when sentToPipeId is null", () => {
    expect(getDestinationPipeName(allPipes, null)).toBeNull();
  });

  it("returns pipe name when match found", () => {
    expect(getDestinationPipeName(allPipes, "feed-1" as Id<"pipes">)).toBe("Salary");
  });

  it("returns null when no match found", () => {
    expect(getDestinationPipeName(allPipes, "nonexistent" as Id<"pipes">)).toBeNull();
  });

  it("returns null when allPipes is null", () => {
    expect(getDestinationPipeName(null, "feed-1" as Id<"pipes">)).toBeNull();
  });
});

describe("getButtonStyle", () => {
  it('returns primary styling for edit intent', () => {
    const style = getButtonStyle("edit", true);
    expect(style.border).toBe("border-primary");
    expect(style.textColor).toBe("text-primary");
  });

  it('returns error styling for negative values in repeat mode', () => {
    const style = getButtonStyle("repeat", true);
    expect(style.border).toBe("border-error");
    expect(style.textColor).toBe("text-error");
  });

  it('returns success styling for positive values in repeat mode', () => {
    const style = getButtonStyle("repeat", false);
    expect(style.border).toBe("border-success");
    expect(style.textColor).toBe("text-success");
  });
});

describe("getButtonIcon", () => {
  it('returns checkmark for edit intent', () => {
    expect(getButtonIcon("edit", false, "spend")).toBe("checkmark");
  });

  it('returns add-circle-outline for feed mode', () => {
    expect(getButtonIcon("repeat", true, "spend")).toBe("add-circle-outline");
  });

  it('returns upload for spend mode', () => {
    expect(getButtonIcon("repeat", false, "spend")).toBe("upload");
  });

  it('returns repeat for transfer mode', () => {
    expect(getButtonIcon("repeat", false, "transfer")).toBe("repeat");
  });
});

describe("AmountForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentTitles.length = 0;
    mockInvalidateAll.mockResolvedValue(undefined);
  });

  describe("variant='feed'", () => {
    it("renders Amount label instead of Value", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.getByText("Amount")).toBeTruthy();
    });

    it("renders date field", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.getByTestId("input-Date")).toBeTruthy();
    });

    it("renders eraser button", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.getByTestId("eraser-button")).toBeTruthy();
    });

    it("gives the eraser button an accessible name", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.getByRole("button", { name: "Clear form" })).toBeTruthy();
    });

    it("does not render mode toggle", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.queryByTestId("slide-toggle-upload")).toBeNull();
    });

    it("does not render header with Add transaction/Transfer text", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.queryByText("Add transaction")).toBeNull();
      expect(screen.queryByText("Transfer")).toBeNull();
    });

    it("submit button is disabled when form is empty", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("gives the submit button an accessible action name", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      expect(screen.getByRole("button", { name: "Feed" })).toBeTruthy();
    });

    it("submit button is disabled when amount is zero", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "0" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button is enabled when title and amount are filled", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBeNull();
    });

    it("submit button shows Feed label", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      expect(screen.getByText("Feed")).toBeTruthy();
    });

    it("calls createTransaction with to: pipeId on submit", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "100.50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "groceries",
          value: 10050,
          date: date.getTime(),
          to: PIPE_ID,
        });
      });

      vi.useRealTimers();
    });

    it("calls onSuccess after successful submit", async () => {
      const onSuccess = vi.fn();

      render(<AmountForm pipeId={PIPE_ID} variant="feed" onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "groceries" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(mockAddTransaction).toHaveBeenCalled();
        expect(mockInvalidateAll).not.toHaveBeenCalled();
      });
    });

    it("adds the created transaction to the cache", async () => {
      const created = {
        id: "created-1",
        createdAt: 10,
        title: "groceries",
        value: 5000,
        date: 20,
        kind: "feed",
        to: PIPE_ID,
      };
      mockCreateTransaction.mockResolvedValueOnce(created);

      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "groceries" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith(created);
        expect(mockInvalidateAll).not.toHaveBeenCalled();
      });
    });

    it("shows error alert on mutation failure", async () => {
      mockCreateTransaction.mockRejectedValueOnce(new Error("Not authorized"));

      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "groceries" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockShowAlert.error).toHaveBeenCalledWith("Not authorized");
      });
    });

    it("eraser resets form fields", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="feed" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "groceries" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByTestId("eraser-button"));

      const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
      expect(titleInput.value).toBe("");
      const amountInput = screen.getByTestId("input-Amount-field") as HTMLInputElement;
      expect(amountInput.value).toBe("");
    });
  });

  describe("variant='boiler'", () => {
    it("starts with zero amount and the current fed value disabled", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="boiler"
          boilerName="Savings"
          currentFed={12500}
        />,
      );
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "investment" },
      });

      expect(
        (screen.getByTestId("input-Amount-field") as HTMLInputElement).value,
      ).toBe("0");
      expect(
        (
          screen.getByTestId(
            "input-Current in Savings-field",
          ) as HTMLInputElement
        ).value,
      ).toBe("125.00");
      expect(
        screen
          .getByTestId("input-Current in Savings-field")
          .getAttribute("data-allow-negative"),
      ).toBe("false");
      expect(
        screen.getByTestId("submit-button").getAttribute("aria-disabled"),
      ).toBe("true");
    });

    it("explains that an unchanged current value will grow by the amount", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="boiler"
          boilerName="Savings"
          currentFed={12500}
        />,
      );

      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "300" },
      });

      expect(screen.getByTestId("boiler-growth-amount").textContent).toBe(
        "+300.00:",
      );
      expect(screen.getByTestId("boiler-growth-hint").textContent).toContain(
        "current will also grow by 300.00 after this operation, unless manually modified",
      );
    });

    it("submits a contribution without overriding unchanged current fed", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);
      const created = {
        id: "created-1",
        createdAt: 10,
        title: "investment",
        value: 30000,
        date: date.getTime(),
        kind: "feed",
        to: PIPE_ID,
      };
      mockContributeToBoiler.mockResolvedValueOnce(created);
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="boiler"
          boilerName="Savings"
          currentFed={12500}
        />,
      );
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "investment" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "300" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockContributeToBoiler).toHaveBeenCalledWith({
          pipeId: PIPE_ID,
          title: "investment",
          value: 30000,
          date: date.getTime(),
        });
        expect(mockAddTransaction).toHaveBeenCalledWith(created);
      });
      vi.useRealTimers();
    });

    it("submits a correction-only update without requiring a title", async () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="boiler"
          boilerName="Savings"
          currentFed={12500}
        />,
      );
      fireEvent.change(
        screen.getByTestId("input-Current in Savings-field"),
        { target: { value: "100" } },
      );

      expect(
        screen.getByTestId("submit-button").getAttribute("aria-disabled"),
      ).toBeNull();
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockContributeToBoiler).toHaveBeenCalledWith(
          expect.objectContaining({
            pipeId: PIPE_ID,
            title: "",
            value: 0,
            currentFed: 10000,
          }),
        );
        expect(mockAddTransaction).not.toHaveBeenCalled();
      });
    });
  });

  describe("variant='spend'", () => {
    it("renders Value label", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByText("Value")).toBeTruthy();
    });

    it("renders date field", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByTestId("input-Date")).toBeTruthy();
    });

    it("renders eraser button", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByTestId("eraser-button")).toBeTruthy();
    });

    it("renders mode toggle", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByTestId("slide-toggle-spend")).toBeTruthy();
      expect(screen.getByTestId("slide-toggle-transfer")).toBeTruthy();
    });

    it("defaults to Add transaction header", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByText("Add transaction")).toBeTruthy();
      expect(screen.queryByText("Transfer")).toBeNull();
    });

    it("preserves the sign emitted by the value input", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      expect(valueInput.value).toBe("-");
      fireEvent.change(valueInput, { target: { value: "5" } });
      expect(valueInput.value).toBe("5");
    });

    it("treats a positive empty value as a return", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);

      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "" },
      });

      expect(screen.getByText("Add return")).toBeTruthy();
    });

    it("preserves negative values on subsequent changes", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "-5" } });
      fireEvent.change(valueInput, { target: { value: "-50" } });
      expect(valueInput.value).toBe("-50");
    });

    it("preserves an incomplete negative value", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "-" } });
      expect(valueInput.value).toBe("-");
    });

    it("submit button disabled when form empty", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button disabled when only title filled", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "Lunch" } });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button disabled when only value filled", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "10.50" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button enabled when title and value filled", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBeNull();
    });

    it("submit button disabled in transfer mode with no destination", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("shows Add expense label with negative value", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-12.50" },
      });
      expect(screen.getByText("Add expense")).toBeTruthy();
    });

    it("shows Add return label with positive value", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "12.50" } });
      expect(screen.getByText("Add return")).toBeTruthy();
    });

    it("calls createTransaction with value as-is (no negation)", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-12.50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "Lunch",
          value: -1250,
          date: date.getTime(),
          from: PIPE_ID,
        });
      });

      vi.useRealTimers();
    });

    it("calls createTransaction with sentToPipeId when destination selected", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "Lunch",
          value: -1250,
          date: date.getTime(),
          from: PIPE_ID,
          to: "feed-1",
        });
      });

      vi.useRealTimers();
    });

    it("resets form on success", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "Lunch" } });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalled();
      });

      expect((titleInput as HTMLInputElement).value).toBe("");
      expect((screen.getByTestId("input-Value-field") as HTMLInputElement).value).toBe("-");

      vi.useRealTimers();
    });

    it("shows error alert on mutation failure", async () => {
      mockCreateTransaction.mockRejectedValueOnce(new Error("Not authorized"));

      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockShowAlert.error).toHaveBeenCalledWith("Not authorized");
      });
    });

    it("renders transfer target select only in transfer mode", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.queryByTestId("input-Transfer to")).toBeNull();
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("input-Transfer to")).toBeTruthy();
    });

    it("reveals a muted paid-from selector with leaf pipes only", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);

      expect(screen.queryByTestId("input-Paid from")).toBeNull();
      fireEvent.click(screen.getByText("Paid from another pipe?"));

      expect(screen.getByTestId("input-Paid from")).toBeTruthy();
      expect(screen.queryByTestId("select-item-feed-1")).toBeNull();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
      expect(screen.getByTestId("select-item-child-1")).toBeTruthy();
    });

    it("submits a pay-by-transfer transaction when a payer is selected", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);

      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Coffee" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-5" },
      });
      fireEvent.click(screen.getByText("Paid from another pipe?"));
      fireEvent.click(screen.getByTestId("select-item-feed-2"));
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "Coffee",
          value: -500,
          date: date.getTime(),
          from: PIPE_ID,
          paidFrom: "feed-2",
        });
      });
      vi.useRealTimers();
    });

    it("labels a positive value as refunded and offers parentless pipes", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "10" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "10" },
      });
      fireEvent.click(screen.getByText("Paid from another pipe?"));

      expect(screen.getByTestId("input-Refunded to")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-1")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
      expect(screen.queryByTestId("select-item-child-1")).toBeNull();
    });

    it("toggling to transfer changes header text", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      expect(screen.getByText("Add transaction")).toBeTruthy();
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByText("Transfer")).toBeTruthy();
    });

    it("toggling back to spend hides transfer to field", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("input-Transfer to")).toBeTruthy();
      fireEvent.click(screen.getByTestId("slide-toggle-spend"));
      expect(screen.queryByTestId("input-Transfer to")).toBeNull();
    });

    it("shows Send to {name} when transfer destination selected", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      expect(screen.getByText("Send to Salary")).toBeTruthy();
    });

    it("shows only feeds in transfer selector (excludes child pipes)", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("select-item-")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-1")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
      expect(screen.queryByTestId("select-item-child-1")).toBeNull();
    });

    it("excludes root ancestor of current pipe from feed options", () => {
      render(<AmountForm pipeId={"child-1" as Id<"pipes">} variant="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.queryByTestId("select-item-feed-1")).toBeNull();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
    });

    it("renders recent title options when available", () => {
      mockRecentTitles.push("groceries", "gas", "rent");
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      const options = screen.getByTestId("text-select-options-");
      expect(options.children).toHaveLength(3);
      expect(screen.getByTestId("text-select-option-groceries")).toBeTruthy();
      expect(screen.getByTestId("text-select-option-gas")).toBeTruthy();
      expect(screen.getByTestId("text-select-option-rent")).toBeTruthy();
    });

    it("selecting recent title populates the input", () => {
      mockRecentTitles.push("groceries");
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.click(screen.getByTestId("text-select-option-groceries"));
      const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
      expect(titleInput.value).toBe("groceries");
    });

    it("pre-fills sentToPipeId from initState", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="spend"
          initState={{
            pipeIcon: "cash",
            pipeName: "Salary",
            title: "prev title",
            value: "30",
            to: "feed-1" as Id<"pipes">,
          }}
        />,
      );
      expect(screen.getByTestId("select-value-Transfer to").textContent).toBe("Salary");
      const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
      expect(titleInput.value).toBe("prev title");
    });

    it("eraser resets fields", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "-12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      expect(screen.getByText("Send to Salary")).toBeTruthy();
      fireEvent.click(screen.getByTestId("eraser-button"));
      expect(screen.queryByText("Send to Salary")).toBeNull();
      expect((screen.getByTestId("input-Value-field") as HTMLInputElement).value).toBe("-");
    });

    it("eraser resets mode back to spend", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByText("Transfer")).toBeTruthy();
      fireEvent.click(screen.getByTestId("eraser-button"));
      expect(screen.getByText("Add transaction")).toBeTruthy();
    });
  });

  describe("variant='transaction'", () => {
    it("renders repeat/edit toggle instead of spend/transfer toggle", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="transaction" />);
      expect(screen.getByTestId("slide-toggle-repeat")).toBeTruthy();
      expect(screen.getByTestId("slide-toggle-edit")).toBeTruthy();
      expect(screen.queryByTestId("slide-toggle-spend")).toBeNull();
      expect(screen.queryByTestId("slide-toggle-transfer")).toBeNull();
    });

    it("does not expose edit mode for feed-type repeats without an id", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="transaction"
          initState={{ pipeIcon: "cash", pipeName: "Salary", title: "pay", value: "1000", isFeed: true }}
        />,
      );
      expect(screen.queryByTestId("slide-toggle-repeat")).toBeNull();
      expect(screen.queryByTestId("slide-toggle-edit")).toBeNull();
      expect(screen.getByText("Feed")).toBeTruthy();
    });

    it("only offers repeat mode when no transaction id is provided", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          variant="transaction"
          initState={{ pipeIcon: "cart", pipeName: "Groceries", title: "coffee", value: "-5" }}
        />,
      );

      expect(screen.queryByTestId("slide-toggle-edit")).toBeNull();
      expect(screen.getByText("Add expense")).toBeTruthy();
    });

    it("defaults to repeat intent", () => {
      render(<AmountForm pipeId={PIPE_ID} variant="transaction" />);
      const activeToggle = screen.getByTestId("slide-toggle-repeat");
      expect(activeToggle).toBeTruthy();
    });

    describe("repeat mode", () => {
      it("calls createTransaction with to: pipeId when isFeed=true", async () => {
        const date = new Date(2026, 6, 21, 15, 45);
        vi.setSystemTime(date);

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{ pipeIcon: "cash", pipeName: "Salary", title: "salary", value: "1000", isFeed: true }}
          />,
        );

        fireEvent.change(screen.getByTestId("input-Amount-field"), {
          target: { value: "1000" },
        });
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockCreateTransaction).toHaveBeenCalledWith({
            title: "salary",
            value: 100000,
            date: date.getTime(),
            to: PIPE_ID,
          });
        });

        vi.useRealTimers();
      });

      it("calls createTransaction with from: pipeId when isFeed is false", async () => {
        const date = new Date(2026, 6, 21, 15, 45);
        vi.setSystemTime(date);

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{ pipeIcon: "cart", pipeName: "Groceries", title: "lunch", value: "-15", isFeed: false }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "lunch" },
        });
        fireEvent.change(screen.getByTestId("input-Value-field"), {
          target: { value: "15.50" },
        });
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockCreateTransaction).toHaveBeenCalledWith({
            title: "lunch",
            value: 1550,
            date: date.getTime(),
            from: PIPE_ID,
          });
        });

        vi.useRealTimers();
      });

      it("includes to field in createTransaction call when initState.to is set", async () => {
        const date = new Date(2026, 6, 21, 15, 45);
        vi.setSystemTime(date);

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{
              pipeIcon: "cash",
              pipeName: "Salary",
              title: "transfer",
              value: "-50",
              to: "feed-1" as Id<"pipes">,
              isFeed: false,
            }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "transfer" },
        });
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockCreateTransaction).toHaveBeenCalledWith({
            title: "transfer",
            value: -5000,
            date: date.getTime(),
            from: PIPE_ID,
            to: "feed-1",
          });
        });

        vi.useRealTimers();
      });
    });

    describe("edit mode", () => {
      it("shows checkmark icon and Update transaction text on submit button", () => {
        render(<AmountForm pipeId={PIPE_ID} variant="transaction" />);
        fireEvent.click(screen.getByTestId("slide-toggle-edit"));
        const submitBtn = screen.getByTestId("submit-button");

        expect(screen.getByText("Update transaction")).toBeTruthy();
        expect(submitBtn).toBeTruthy();
      });

      it("calls editTransaction with form values when submitted", async () => {
        const date = new Date(2026, 6, 21, 15, 45);
        vi.setSystemTime(date);

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{ pipeIcon: "cart", pipeName: "Groceries", title: "lunch", value: "-15", isFeed: false, transactionId: "tx-1" as any }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "new lunch" },
        });
        fireEvent.change(screen.getByTestId("input-Value-field"), {
          target: { value: "20" },
        });
        fireEvent.click(screen.getByTestId("slide-toggle-edit"));

        await waitFor(() => {
          expect(mockCreateTransaction).not.toHaveBeenCalled();
        });

        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockEditTransactionFn).toHaveBeenCalledWith({
            transactionId: "tx-1",
            title: "new lunch",
            value: 2000,
            date: date.getTime(),
          });
        });

        vi.useRealTimers();
      });

      it("updates the edited transaction in the cache", async () => {
        const updated = {
          id: "tx-1",
          createdAt: 1,
          title: "updated lunch",
          value: -2000,
          date: 2,
          kind: "expense",
          from: PIPE_ID,
          editedAt: 3,
        };
        mockEditTransactionFn.mockResolvedValueOnce(updated);

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{
              pipeIcon: "cart",
              pipeName: "Groceries",
              title: "lunch",
              value: "-15",
              isFeed: false,
              transactionId: "tx-1" as any,
            }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "updated lunch" },
        });
        fireEvent.click(screen.getByTestId("slide-toggle-edit"));
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockUpdateTransaction).toHaveBeenCalledWith(updated);
          expect(mockInvalidateAll).not.toHaveBeenCalled();
        });
      });

      it("does not call createTransaction in edit mode", async () => {
        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{ pipeIcon: "cart", pipeName: "Groceries", title: "lunch", value: "-15", transactionId: "tx-1" as any }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "lunch" },
        });
        fireEvent.click(screen.getByTestId("slide-toggle-edit"));
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockCreateTransaction).not.toHaveBeenCalled();
          expect(mockEditTransactionFn).toHaveBeenCalled();
        });
      });

      it("preserves paidFrom when repeating an individual expense", async () => {
        const date = new Date(2026, 6, 21, 15, 45);
        vi.setSystemTime(date);

        render(
          <AmountForm
            pipeId={"child-1" as Id<"pipes">}
            variant="transaction"
            initState={{
              pipeIcon: "home-outline",
              pipeName: "Rent",
              title: "rent",
              value: "-50",
              paidFrom: "feed-2" as Id<"pipes">,
            }}
          />,
        );

        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockCreateTransaction).toHaveBeenCalledWith({
            title: "rent",
            value: -5000,
            date: date.getTime(),
            from: "child-1",
            paidFrom: "feed-2",
          });
        });

        vi.useRealTimers();
      });

      it("keeps form filled and shows error alert on edit mutation failure", async () => {
        mockEditTransactionFn.mockRejectedValueOnce(new Error("Edit failed"));

        render(
          <AmountForm
            pipeId={PIPE_ID}
            variant="transaction"
            initState={{ pipeIcon: "cart", pipeName: "Groceries", title: "lunch", value: "-15", isFeed: false, transactionId: "tx-1" as any }}
          />,
        );

        fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
          target: { value: "updated title" },
        });
        fireEvent.click(screen.getByTestId("slide-toggle-edit"));
        fireEvent.click(screen.getByTestId("submit-button"));

        await waitFor(() => {
          expect(mockShowAlert.error).toHaveBeenCalledWith("Edit failed");
        });

        const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
        expect(titleInput.value).toBe("updated title");
      });
    });
  });
});
