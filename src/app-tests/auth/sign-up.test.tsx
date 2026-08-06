// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignUp from "@/app/(auth)/sign-up";

const mocks = vi.hoisted(() => ({
  availability: undefined as boolean | undefined,
  signUp: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ signUp: mocks.signUp }),
}));

vi.mock("@ui/Input", () => ({
  Input: ({ label, value, onChangeText }: any) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  ),
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
    mocks.useQuery.mockImplementation((_query, args) =>
      args === "skip" ? undefined : mocks.availability,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("disables submission until the current username has been checked", () => {
    const view = render(<SignUp />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    act(() => vi.advanceTimersByTime(400));
    mocks.availability = true;
    view.rerender(<SignUp />);

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

  it("does not check a whitespace-only username for availability", () => {
    render(<SignUp />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "   " },
    });
    act(() => vi.advanceTimersByTime(400));

    expect(mocks.useQuery.mock.calls.at(-1)?.[1]).toBe("skip");
  });
});
