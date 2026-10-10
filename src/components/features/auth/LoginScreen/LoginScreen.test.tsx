// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";

const login = vi.fn();
const biometrics = { loading: false, busy: false, available: true, enabled: false, error: null, login: vi.fn() };

vi.mock("@features/app/AppScreenHeader", () => ({
  MoineyVers: () => null,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ login, biometrics: { ...biometrics } }),
}));

vi.mock("@ui/Input", () => ({
  Input: ({ label, value, onChange }: any) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
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

describe("LoginScreen", () => {
  beforeEach(() => { vi.clearAllMocks(); biometrics.enabled = false; biometrics.busy = false; biometrics.loading = false; login.mockResolvedValue(undefined); });
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

  it("automatically prompts once per visit and offers an explicit retry after cancellation", () => {
    biometrics.enabled = true;
    const { rerender } = render(<LoginScreen />);
    expect(biometrics.login).toHaveBeenCalledOnce();
    rerender(<LoginScreen />);
    expect(biometrics.login).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Use biometrics" }));
    expect(biometrics.login).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("prevents password submission during biometric login", () => {
    biometrics.busy = true;
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(login).not.toHaveBeenCalled();
  });

  it("does not launch an automatic biometric attempt after password submission begins", async () => {
    let resolveLogin!: () => void;
    login.mockReturnValueOnce(new Promise<void>((resolve) => { resolveLogin = resolve; }));
    const { rerender } = render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    biometrics.enabled = true;
    rerender(<LoginScreen />);
    expect(biometrics.login).not.toHaveBeenCalled();
    await act(async () => { resolveLogin(); });
    expect(biometrics.login).not.toHaveBeenCalled();
  });
});
