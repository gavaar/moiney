// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpentForm } from "./SpentForm";

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
  });

  it("renders title label", () => {
    render(<SpentForm />);
    expect(screen.getByText("Add transaction")).toBeTruthy();
  });

  it("renders value field", () => {
    render(<SpentForm />);
    expect(screen.getByTestId("input-Value")).toBeTruthy();
  });

  it("renders date field", () => {
    render(<SpentForm />);
    expect(screen.getByTestId("input-Date")).toBeTruthy();
  });

  it("submit button is disabled when form is empty", () => {
    render(<SpentForm />);
    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is disabled when only title is filled", () => {
    render(<SpentForm />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Test title" } });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is disabled when only value is filled", () => {
    render(<SpentForm />);
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "10.50" },
    });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("submit button is enabled when title and value are filled", () => {
    render(<SpentForm />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Lunch" } });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });

    const btn = screen.getByTestId("submit-button");
    expect(btn.getAttribute("aria-disabled")).toBeNull();
  });

  it("logs form data on submit", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const date = new Date(2026, 6, 21, 15, 45);
    vi.setSystemTime(date);

    render(<SpentForm />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Lunch" } });
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));

    expect(logSpy).toHaveBeenCalledWith({
      title: "Lunch",
      value: "12.50",
      date,
    });

    logSpy.mockRestore();
    vi.useRealTimers();
  });

  it("renders eraser button", () => {
    render(<SpentForm />);
    expect(screen.getByTestId("eraser-button")).toBeTruthy();
  });

  it("eraser button resets title field", () => {
    render(<SpentForm />);
    const titleInput = screen.getByPlaceholderText("What was this for?") as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: "Lunch" } });

    fireEvent.click(screen.getByTestId("eraser-button"));

    expect(titleInput.value).toBe("");
  });

  it("eraser button resets value field", () => {
    render(<SpentForm />);
    fireEvent.change(screen.getByTestId("input-Value-field"), {
      target: { value: "12.50" },
    });
    fireEvent.click(screen.getByTestId("eraser-button"));
    const valueInput = screen.getByTestId("input-Value-field") as HTMLInputElement;
    expect(valueInput.value).toBe("");
  });

  it("shows title character count", () => {
    render(<SpentForm />);
    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "Hello" } });
    expect(screen.getByTestId("input-Add transaction-counter").textContent).toBe("5 / 140");
  });
});
