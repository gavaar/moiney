// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { type Id } from "@convex/_generated/dataModel";
import { SpentForm, getButtonLabel } from "./SpentForm";

const PIPE_ID = "pipe-1" as Id<"pipes">;
const mockCreateTransaction = vi.fn().mockResolvedValue(undefined);

const mockRecentTitles: string[] = [];
vi.mock("convex/react", () => ({
  useMutation: () => mockCreateTransaction,
  useQuery: () => mockRecentTitles,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    transactions: {
      createTransaction: {},
      listRecentTitles: {},
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
      return (
        <div data-testid={`input-${label}`}>
          <span>{label}</span>
          <input
            data-testid={`input-${label}-field`}
            value={value}
            onChange={(e) => onChangeText?.(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
          {options?.length > 0 && (
            <div data-testid={`text-select-options-${label}`}>
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
            <span data-testid={`input-${label}-counter`}>
              {String(value ?? "").length} / {maxLength}
            </span>
          )}
        </div>
      );
    }
    const currentLength = String(value ?? "").length;
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
            {currentLength} / {maxLength}
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
  it('returns "Add expense" when isNegative is false and no destination', () => {
    expect(getButtonLabel(false, null)).toBe("Add expense");
  });

  it('returns "Add return" when isNegative is true and no destination', () => {
    expect(getButtonLabel(true, null)).toBe("Add return");
  });

  it('returns "Send to {name}" when isNegative is false and destination is set', () => {
    expect(getButtonLabel(false, "Salary")).toBe("Send to Salary");
  });

  it('returns "Take from {name}" when isNegative is true and destination is set', () => {
    expect(getButtonLabel(true, "Freelance")).toBe("Take from Freelance");
  });
});

describe("SpentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentTitles.length = 0;
  });

  it("renders title label", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.getByText("Add transaction")).toBeTruthy();
  });

  it("renders value field", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.getByTestId("input-Value")).toBeTruthy();
  });

  it("renders date field", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.getByTestId("input-Date")).toBeTruthy();
  });

  it("renders transfer target select input", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.getByTestId("input-Transfer to")).toBeTruthy();
  });

  it("submit button is disabled when form is empty", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is disabled when only title is filled", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Test title" } });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is disabled when only value is filled", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "10.50" },
    });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is enabled when title and value are filled", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Lunch" } });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBeNull();
  });

  it("shows default button label when no transfer destination selected", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    expect(screen.getByText("Add expense")).toBeTruthy();
  });

  it("updates button label when a transfer destination is selected", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("select-item-feed-1"));
    expect(screen.getByText("Send to Salary")).toBeTruthy();
  });

  it("reverts button label when None option is selected", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("select-item-feed-1"));
    expect(screen.getByText("Send to Salary")).toBeTruthy();
    fireEvent.click(screen.getByTestId("select-item-"));
    expect(screen.getByText("Add expense")).toBeTruthy();
  });

  it("calls createTransaction with sentToPipeId when destination selected", async () => {
    const date = new Date(2026, 6, 21, 15, 45);
    vi.setSystemTime(date);

    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("select-item-feed-1"));
    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith({
        title: "Lunch",
        value: -12.50,
        date: date.getTime(),
        pipeId: PIPE_ID,
        sentToPipeId: "feed-1",
      });
    });

    vi.useRealTimers();
  });

  it("calls createTransaction without sentToPipeId when no destination selected", async () => {
    const date = new Date(2026, 6, 21, 15, 45);
    vi.setSystemTime(date);

    render(<SpentForm pipeId={PIPE_ID} />);
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
        pipeId: PIPE_ID,
      });
    });

    vi.useRealTimers();
  });

  it("calls createTransaction with multiplied value and clears form on success", async () => {
    const date = new Date(2026, 6, 21, 15, 45);
    vi.setSystemTime(date);

    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Lunch" } });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith({
        title: "Lunch",
        value: -12.50,
        date: date.getTime(),
        pipeId: PIPE_ID,
      });
    });

    expect((titleInput as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("input-Value-field") as HTMLInputElement).value).toBe("");

    vi.useRealTimers();
  });

  it("shows error alert on mutation failure", async () => {
    mockCreateTransaction.mockRejectedValueOnce(new Error("Not authorized"));

    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Lunch" } });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockShowAlert.error).toHaveBeenCalledWith("Not authorized");
    });
  });

  it("renders eraser button", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.getByTestId("eraser-button")).toBeTruthy();
  });

  it("eraser button resets title field", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: "Lunch" } });

    fireEvent.click(screen.getByTestId("eraser-button"));

    expect(titleInput.value).toBe("");
  });

  it("eraser button resets value field", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("eraser-button"));
    const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
    expect(valueInput.value).toBe("");
  });

  it("eraser button resets transfer destination", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("select-item-feed-1"));
    expect(screen.getByText("Send to Salary")).toBeTruthy();
    fireEvent.click(screen.getByTestId("eraser-button"));
    expect(screen.getByText("Add expense")).toBeTruthy();
  });

  it("shows title character count", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Hello" } });
    expect(screen.getByTestId("input-Add transaction-counter").textContent).toBe("5 / 140");
  });

  it("shows only feeds in the transfer selector (excludes child pipes)", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const items = screen.getByTestId("select-items-Transfer to");
    expect(items).toBeTruthy();
    expect(screen.getByTestId("select-item-")).toBeTruthy(); // None
    expect(screen.getByTestId("select-item-feed-1")).toBeTruthy(); // Salary (feed)
    expect(screen.getByTestId("select-item-feed-2")).toBeTruthy(); // Freelance (feed)
    expect(screen.queryByTestId("select-item-child-1")).toBeNull(); // Rent (child, excluded)
  });

  it("excludes the root ancestor of current pipe from feed options", () => {
    render(<SpentForm pipeId={"child-1" as Id<"pipes">} />);
    expect(screen.queryByTestId("select-item-feed-1")).toBeNull(); // feed-1 is ancestor of child-1
    expect(screen.getByTestId("select-item-feed-2")).toBeTruthy(); // Freelance is unrelated
    expect(screen.getByTestId("select-item-")).toBeTruthy(); // None
  });

  it("renders recent title options when available", () => {
    mockRecentTitles.length = 0;
    mockRecentTitles.push("groceries", "gas", "rent");

    render(<SpentForm pipeId={PIPE_ID} />);
    const options = screen.getByTestId("text-select-options-Add transaction");
    expect(options.children).toHaveLength(3);
    expect(screen.getByTestId("text-select-option-groceries")).toBeTruthy();
    expect(screen.getByTestId("text-select-option-gas")).toBeTruthy();
    expect(screen.getByTestId("text-select-option-rent")).toBeTruthy();
  });

  it("does not render recent title options when empty", () => {
    mockRecentTitles.length = 0;

    render(<SpentForm pipeId={PIPE_ID} />);
    expect(screen.queryByTestId("text-select-options-Add transaction")).toBeNull();
  });

  it("selecting a recent title option populates the input", () => {
    mockRecentTitles.length = 0;
    mockRecentTitles.push("groceries");

    render(<SpentForm pipeId={PIPE_ID} />);
    fireEvent.click(screen.getByTestId("text-select-option-groceries"));
    const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
    expect(titleInput.value).toBe("groceries");
  });

  it("pre-fills sentToPipeId from initState", () => {
    render(
      <SpentForm
        pipeId={PIPE_ID}
        initState={{
          pipeIcon: "cash",
          pipeName: "Salary",
          title: "prev title",
          value: "30",
          sentToPipeId: "feed-1" as Id<"pipes">,
        }}
      />,
    );
    expect(screen.getByTestId("select-value-Transfer to").textContent).toBe("Salary");
    const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
    expect(titleInput.value).toBe("prev title");
  });
});
