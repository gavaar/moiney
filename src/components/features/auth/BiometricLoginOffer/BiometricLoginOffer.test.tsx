// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BiometricLoginOffer } from "./BiometricLoginOffer";

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  biometrics: { offer: true, busy: false, error: null, enable: vi.fn(), dismissOffer: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

describe("biometric opt-in", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.isAuthenticated = true; auth.biometrics.busy = false; });

  it("explains the single account slot and offers setup or persistent suppression", () => {
    render(<BiometricLoginOffer />);
    expect(screen.getByText(/Only one account/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(auth.biometrics.enable).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Do not show again" }));
    expect(auth.biometrics.dismissOffer).toHaveBeenCalledWith(true);
  });

  it("treats backdrop dismissal as not now and waits for authenticated state", () => {
    const { rerender } = render(<BiometricLoginOffer />);
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(auth.biometrics.dismissOffer).toHaveBeenCalledWith(false);
    auth.isAuthenticated = false;
    rerender(<BiometricLoginOffer />);
    expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();
  });
});
