// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { type Id } from "@convex/_generated/dataModel";
import { AmountForm } from "./AmountForm";
import { getButtonLabel, buildPipeItems, getDestinationPipeName } from "./helpers";

const PIPE_ID = "pipe-1" as Id<"pipes">;
const mockCreateTransaction = vi.fn().mockResolvedValue(undefined);
const mockFeedPipe = vi.fn().mockResolvedValue(undefined);

const mockRecentTitles: string[] = [];
vi.mock("convex/react", () => ({
  useMutation: (api: any) => {
    if (api === "feedPipe") return mockFeedPipe;
    return mockCreateTransaction;
  },
  useQuery: () => mockRecentTitles,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: { feedPipe: "feedPipe" },
    transactions: {
      createTransaction: "createTransaction",
      listRecentTitles: "listRecentTitles",
    },
  },
}));

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    allPipes: [
      {
        _id: "feed-1" as Id<"pipes">,
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
        _id: "feed-2" as Id<"pipes">,
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
        _id: "child-1" as Id<"pipes">,
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

vi.mock("@ui/Input", () => ({
  Input: ({ label, type, value, onChangeText, onChange, disabled, placeholder, allowNegative, error, maxLength, items, onSelect, options, onOptionSelect }: any) => {
    if (type === "datetime") {
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

describe("buildPipeItems", () => {
  const allPipes = [
    { _id: "feed-1" as Id<"pipes">, parentId: undefined as Id<"pipes"> | undefined, name: "Salary", icon: "cash-outline" },
    { _id: "feed-2" as Id<"pipes">, parentId: undefined as Id<"pipes"> | undefined, name: "Freelance", icon: "laptop-outline" },
    { _id: "child-1" as Id<"pipes">, parentId: "feed-1" as Id<"pipes">, name: "Rent", icon: "home-outline" },
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

  it("handles null allPipes gracefully", () => {
    const result = buildPipeItems(null, "pipe-1" as Id<"pipes">);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("None");
  });
});

describe("getDestinationPipeName", () => {
  const allPipes = [
    { _id: "feed-1" as Id<"pipes">, name: "Salary" },
    { _id: "feed-2" as Id<"pipes">, name: "Freelance" },
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

describe("AmountForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentTitles.length = 0;
  });

  describe("feed mode", () => {
    it("renders Amount label instead of Value", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      expect(screen.getByText("Amount")).toBeTruthy();
    });

    it("renders date field", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      expect(screen.getByTestId("input-Date")).toBeTruthy();
    });

    it("renders eraser button", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      expect(screen.getByTestId("eraser-button")).toBeTruthy();
    });

    it("does not render mode toggle", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      expect(screen.queryByTestId("slide-toggle-upload")).toBeNull();
    });

    it("does not render header with Add transaction/Transfer text", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      expect(screen.queryByText("Add transaction")).toBeNull();
      expect(screen.queryByText("Transfer")).toBeNull();
    });

    it("submit button is disabled when form is empty", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button is disabled when amount is zero", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "0" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button is enabled when title and amount are filled", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBeNull();
    });

    it("submit button shows Feed label", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      expect(screen.getByText("Feed")).toBeTruthy();
    });

    it("calls feedPipe with pipeId, amount, title and date on submit", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "groceries" } });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "100.50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockFeedPipe).toHaveBeenCalledWith({
          pipeId: PIPE_ID,
          amount: 100.50,
          title: "groceries",
          date: date.getTime(),
        });
      });

      vi.useRealTimers();
    });

    it("calls onSuccess after successful submit", async () => {
      const onSuccess = vi.fn();

      render(<AmountForm pipeId={PIPE_ID} mode="feed" onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "groceries" },
      });
      fireEvent.change(screen.getByTestId("input-Amount-field"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it("shows error alert on mutation failure", async () => {
      mockFeedPipe.mockRejectedValueOnce(new Error("Not authorized"));

      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
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
      render(<AmountForm pipeId={PIPE_ID} mode="feed" />);
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

  describe("spend mode", () => {
    it("renders Value label", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByText("Value")).toBeTruthy();
    });

    it("renders date field", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByTestId("input-Date")).toBeTruthy();
    });

    it("renders eraser button", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByTestId("eraser-button")).toBeTruthy();
    });

    it("renders mode toggle", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByTestId("slide-toggle-spend")).toBeTruthy();
      expect(screen.getByTestId("slide-toggle-transfer")).toBeTruthy();
    });

    it("defaults to Add transaction header", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByText("Add transaction")).toBeTruthy();
      expect(screen.queryByText("Transfer")).toBeNull();
    });

    it("auto-prepends minus on first keystroke", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "5" } });
      expect(valueInput.value).toBe("-5");
    });

    it("does not auto-prepend minus on subsequent keystrokes", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "-5" } });
      fireEvent.change(valueInput, { target: { value: "-50" } });
      expect(valueInput.value).toBe("-50");
    });

    it("does not auto-prepend minus when user types minus explicitly", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "-" } });
      expect(valueInput.value).toBe("-");
    });

    it("submit button disabled when form empty", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button disabled when only title filled", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const titleInput = screen.getByPlaceholderText("What was this for?");
      fireEvent.change(titleInput, { target: { value: "Lunch" } });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button disabled when only value filled", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "10.50" },
      });
      const btn = screen.getByTestId("submit-button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("submit button enabled when title and value filled", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
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
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
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
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      expect(screen.getByText("Add expense")).toBeTruthy();
    });

    it("shows Add return label with positive value", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      // remove minus to make it positive
      const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: "12.50" } });
      expect(screen.getByText("Add return")).toBeTruthy();
    });

    it("calls createTransaction with value as-is (no negation)", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "Lunch",
          value: -12.50,
          date: date.getTime(),
          from: PIPE_ID,
        });
      });

      vi.useRealTimers();
    });

    it("calls createTransaction with sentToPipeId when destination selected", async () => {
      const date = new Date(2026, 6, 21, 15, 45);
      vi.setSystemTime(date);

      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          title: "Lunch",
          value: -12.50,
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

      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
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
      expect((screen.getByTestId("input-Value-field") as HTMLInputElement).value).toBe("");

      vi.useRealTimers();
    });

    it("shows error alert on mutation failure", async () => {
      mockCreateTransaction.mockRejectedValueOnce(new Error("Not authorized"));

      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
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
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.queryByTestId("input-Transfer to")).toBeNull();
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("input-Transfer to")).toBeTruthy();
    });

    it("toggling to transfer changes header text", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      expect(screen.getByText("Add transaction")).toBeTruthy();
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByText("Transfer")).toBeTruthy();
    });

    it("toggling back to spend hides transfer to field", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("input-Transfer to")).toBeTruthy();
      fireEvent.click(screen.getByTestId("slide-toggle-spend"));
      expect(screen.queryByTestId("input-Transfer to")).toBeNull();
    });

    it("shows Send to {name} when transfer destination selected", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      expect(screen.getByText("Send to Salary")).toBeTruthy();
    });

    it("shows only feeds in transfer selector (excludes child pipes)", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByTestId("select-item-")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-1")).toBeTruthy();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
      expect(screen.queryByTestId("select-item-child-1")).toBeNull();
    });

    it("excludes root ancestor of current pipe from feed options", () => {
      render(<AmountForm pipeId={"child-1" as Id<"pipes">} mode="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.queryByTestId("select-item-feed-1")).toBeNull();
      expect(screen.getByTestId("select-item-feed-2")).toBeTruthy();
    });

    it("renders recent title options when available", () => {
      mockRecentTitles.push("groceries", "gas", "rent");
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      const options = screen.getByTestId("text-select-options-");
      expect(options.children).toHaveLength(3);
      expect(screen.getByTestId("text-select-option-groceries")).toBeTruthy();
      expect(screen.getByTestId("text-select-option-gas")).toBeTruthy();
      expect(screen.getByTestId("text-select-option-rent")).toBeTruthy();
    });

    it("selecting recent title populates the input", () => {
      mockRecentTitles.push("groceries");
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.click(screen.getByTestId("text-select-option-groceries"));
      const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
      expect(titleInput.value).toBe("groceries");
    });

    it("pre-fills sentToPipeId from initState", () => {
      render(
        <AmountForm
          pipeId={PIPE_ID}
          mode="spend"
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
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
        target: { value: "Lunch" },
      });
      fireEvent.change(screen.getByTestId("input-Value-field"), {
        target: { value: "12.50" },
      });
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      fireEvent.click(screen.getByTestId("select-item-feed-1"));
      expect(screen.getByText("Send to Salary")).toBeTruthy();
      fireEvent.click(screen.getByTestId("eraser-button"));
      expect(screen.queryByText("Send to Salary")).toBeNull();
    });

    it("eraser resets mode back to spend", () => {
      render(<AmountForm pipeId={PIPE_ID} mode="spend" />);
      fireEvent.click(screen.getByTestId("slide-toggle-transfer"));
      expect(screen.getByText("Transfer")).toBeTruthy();
      fireEvent.click(screen.getByTestId("eraser-button"));
      expect(screen.getByText("Add transaction")).toBeTruthy();
    });
  });
});
