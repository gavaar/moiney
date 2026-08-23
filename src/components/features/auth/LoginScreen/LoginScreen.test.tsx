// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const login = vi.fn();

vi.mock("@features/app/AppScreenHeader", () => ({
  MoineyVers: () => null,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ login }),
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

import { LoginScreen } from "./LoginScreen";

describe("LoginScreen", () => {
  it("submits the entered credentials through auth", async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(login).toHaveBeenCalledWith("alice", "password123");
  });
});
