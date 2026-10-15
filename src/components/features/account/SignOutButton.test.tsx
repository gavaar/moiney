// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "./SignOutButton";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for confirmation for three seconds without signing out", () => {
    vi.useFakeTimers();
    const onSignedOut = vi.fn();
    render(<SignOutButton onSignedOut={onSignedOut} />);

    expect(screen.getByText(/sign out/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId("sign-out-button"));
    expect(screen.getByText("confirm?")).toBeTruthy();
    expect(mocks.signOut).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText("confirm?")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Sign out")).toBeTruthy();
    expect(onSignedOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("sign-out-button"));
    expect(screen.getByText("confirm?")).toBeTruthy();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("calls signOut then onSignedOut on a second tap", async () => {
    mocks.signOut.mockResolvedValue(undefined);
    const onSignedOut = vi.fn();
    const user = userEvent.setup();

    render(<SignOutButton onSignedOut={onSignedOut} />);
    await user.click(screen.getByTestId("sign-out-button"));
    await user.click(screen.getByTestId("sign-out-button"));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await screen.findByText("Sign out");
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state and ignores taps while signing out", async () => {
    let resolveSignOut!: () => void;
    mocks.signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    const onSignedOut = vi.fn();
    const user = userEvent.setup();

    render(<SignOutButton onSignedOut={onSignedOut} />);
    await user.click(screen.getByTestId("sign-out-button"));
    await user.click(screen.getByTestId("sign-out-button"));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    const button = screen.getByTestId("sign-out-button");
    expect(screen.queryByText("Sign out")).toBeNull();
    expect(window.getComputedStyle(button).pointerEvents).toBe("none");
    fireEvent.click(button);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    resolveSignOut();
    await screen.findByText("Sign out");
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
});
