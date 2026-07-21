// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Alert } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { SpentForm } from "./SpentForm";

const PIPE_ID = "pipe-1" as Id<"pipes">;
const mockCreateTransaction = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockCreateTransaction,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    transactions: {
      createTransaction: {},
    },
  },
}));

vi.mock("@/components/ui/Input", () => ({
  Input: ({ label, type, value, onChangeText, onChange, disabled, placeholder, allowNegative, error, maxLength }: any) => {
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

vi.mock("@/components/ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID || "icon"} data-name={name} />,
}));

describe("SpentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Alert, "alert").mockImplementation(() => {});
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
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Not authorized");
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

  it("shows title character count", () => {
    render(<SpentForm pipeId={PIPE_ID} />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Hello" } });
    expect(screen.getByTestId("input-Add transaction-counter").textContent).toBe("5 / 140");
  });
});
