// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("calls signOut then onSignedOut", async () => {
    mocks.signOut.mockResolvedValue(undefined);
    const onSignedOut = vi.fn();
    const user = userEvent.setup();

    render(<SignOutButton onSignedOut={onSignedOut} />);
    await user.click(screen.getByTestId("sign-out-button"));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await screen.findByText("Sign Out");
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

    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    const button = screen.getByTestId("sign-out-button");
    expect(screen.queryByText("Sign Out")).toBeNull();
    expect(window.getComputedStyle(button).pointerEvents).toBe("none");

    resolveSignOut();
    await screen.findByText("Sign Out");
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
});