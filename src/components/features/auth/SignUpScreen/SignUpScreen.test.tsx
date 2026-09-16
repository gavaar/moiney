// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpScreen } from "./SignUpScreen";

const mocks = vi.hoisted(() => ({
  availability: undefined as boolean | undefined,
  signUp: vi.fn(),
  useUsernameAvailability: vi.fn(),
}));

vi.mock("@features/auth/data/auth", () => ({
  useUsernameAvailability: mocks.useUsernameAvailability,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ signUp: mocks.signUp }),
}));

vi.mock("@ui/Button", () => ({
  Button: ({ title, disabled, onPress }: any) => (
    <button disabled={disabled} onClick={onPress}>
      {title}
    </button>
  ),
}));

vi.mock("@ui/AuthScreenLayout", () => ({
  AuthScreenLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("expo-router", () => ({
  Link: ({ children }: any) => <a>{children}</a>,
}));

describe("SignUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.availability = undefined;
    mocks.useUsernameAvailability.mockImplementation((username) =>
      username ? mocks.availability : undefined,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("disables submission until the current username has been checked", () => {
    const view = render(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    act(() => vi.advanceTimersByTime(400));
    mocks.availability = true;
    view.rerender(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Repeat Password"), {
      target: { value: "password123" },
    });

    const submitButton = screen.getByRole("button", { name: "Create Account" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "bob" },
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("validates email on blur and corrects the displayed error while typing", () => {
    render(<SignUpScreen />);
    const input = screen.getByLabelText("Email");
    fireEvent.change(input, { target: { value: "bad" } });
    expect(screen.queryByText("Invalid email")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Invalid email");
    fireEvent.change(input, { target: { value: "still-bad" } });
    expect(screen.getByRole("alert").textContent).toBe("Invalid email");
    fireEvent.change(input, { target: { value: "alice@example.com" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears a displayed password mismatch when the other password changes", () => {
    render(<SignUpScreen />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "different123" } });
    fireEvent.blur(screen.getByLabelText("Repeat Password"));
    expect(screen.getByRole("alert").textContent).toBe("Passwords do not match");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "different123" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("incorporates availability on blur and clears an existing error for a new username", () => {
    const view = render(<SignUpScreen />);
    const username = screen.getByLabelText("Username");
    fireEvent.change(username, { target: { value: "alice" } });
    act(() => vi.advanceTimersByTime(400));
    mocks.availability = false;
    view.rerender(<SignUpScreen />);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(username);
    expect(screen.getByRole("alert").textContent).toBe("Username is already taken");
    fireEvent.change(username, { target: { value: "bob" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "Create Account" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not check a whitespace-only username for availability", () => {
    render(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "   " },
    });
    act(() => vi.advanceTimersByTime(400));

    expect(mocks.useUsernameAvailability.mock.calls.at(-1)?.[0]).toBeUndefined();
  });
});
