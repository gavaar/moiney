// @vitest-environment jsdom
import { fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";
import { MonthlyCardPreferenceProvider } from "@features/statistics/preferences/MonthlyCardPreference";

const render = (ui: React.ReactNode) => renderComponent(<MonthlyCardPreferenceProvider>{ui}</MonthlyCardPreferenceProvider>);

const biometrics = vi.hoisted(() => ({
  available: true,
  enabled: false,
  loading: false,
  busy: false,
  error: null,
  enable: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ biometrics, accountKey: "deployment:alice" }) }));

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    biometrics.available = true;
    biometrics.enabled = false;
    biometrics.enable.mockResolvedValue(true);
    biometrics.disable.mockResolvedValue(true);
  });

  it("defaults the monthly card checkbox to enabled, explains it, and persists disabling it", async () => {
    render(<SettingsScreen onBack={vi.fn()} />);
    const checkbox = await screen.findByRole("checkbox", { name: "Show monthly statistics card in main view" });
    await waitFor(() => {
      expect(checkbox.getAttribute("aria-disabled")).not.toBe("true");
      expect(checkbox.hasAttribute("disabled")).toBe(false);
    });
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/You can always find this card in Statistics, even when this option is off/)).toBeDefined();
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await waitFor(() => expect(localStorage.getItem("moiney:monthly-card:deployment%3Aalice")).toBe("false"));
  });

  it("asks for the current password before enabling and clears it on dismissal", async () => {
    render(<SettingsScreen onBack={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Use biometric login", checked: false });
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    expect(biometrics.enable).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    fireEvent.click(checkbox);
    expect(screen.getByLabelText("Current password").getAttribute("value")).toBe("");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "new-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable biometric login" }));
    await waitFor(() => expect(biometrics.enable).toHaveBeenCalledWith("new-secret"));
    await waitFor(() => expect(screen.queryByLabelText("Current password")).toBeNull());
  });

  it("keeps biometric login enabled until disabling is confirmed", async () => {
    biometrics.enabled = true;
    render(<SettingsScreen onBack={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Use biometric login", checked: true });
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(biometrics.disable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(biometrics.disable).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Disable biometric login" }));
    await waitFor(() => expect(biometrics.disable).toHaveBeenCalledOnce());
  });

  it("explains unsupported devices and exposes back navigation", () => {
    biometrics.available = false;
    const onBack = vi.fn();
    render(<SettingsScreen onBack={onBack} />);
    expect(screen.getByText(/Biometric login is unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Use biometric login" }));
    expect(screen.queryByLabelText("Current password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
