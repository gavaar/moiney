// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";

const biometrics = vi.hoisted(() => ({
  available: true, enabled: false, loading: false, busy: false, error: null,
  enable: vi.fn(), disable: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ biometrics }) }));

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    biometrics.available = true;
    biometrics.enabled = false;
    biometrics.enable.mockResolvedValue(true);
    biometrics.disable.mockResolvedValue(true);
  });

  it("asks for the current password before enabling and clears it on dismissal", async () => {
    render(<SettingsScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Enabled" }));
    expect(biometrics.enable).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    fireEvent.click(screen.getByRole("radio", { name: "Enabled" }));
    expect(screen.getByLabelText("Current password").getAttribute("value")).toBe("");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "new-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable biometric login" }));
    await waitFor(() => expect(biometrics.enable).toHaveBeenCalledWith("new-secret"));
    await waitFor(() => expect(screen.queryByLabelText("Current password")).toBeNull());
  });

  it("keeps biometric login enabled until disabling is confirmed", async () => {
    biometrics.enabled = true;
    render(<SettingsScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Disabled" }));
    expect(biometrics.disable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(biometrics.disable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Disabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Disable biometric login" }));
    await waitFor(() => expect(biometrics.disable).toHaveBeenCalledOnce());
  });

  it("explains unsupported devices and exposes back navigation", () => {
    biometrics.available = false;
    const onBack = vi.fn();
    render(<SettingsScreen onBack={onBack} />);
    expect(screen.getByText(/Biometric login is unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Enabled" }));
    expect(screen.queryByLabelText("Current password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
