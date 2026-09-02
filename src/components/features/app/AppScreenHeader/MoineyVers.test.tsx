// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expo } from "@/../app.json";
import { MoineyVers } from "./MoineyVers";

const mocks = vi.hoisted(() => ({
  getLatestMoineyRelease: vi.fn(),
  openURL: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/githubReleases", () => ({
  getLatestMoineyRelease: mocks.getLatestMoineyRelease,
}));

vi.mock("react-native", async () => ({
  ...(await vi.importActual<typeof import("react-native")>("react-native")),
  Linking: { openURL: mocks.openURL },
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div data-testid="modal-shell">{children}</div> : null,
}));

describe("MoineyVers", () => {
  beforeEach(() => {
    mocks.getLatestMoineyRelease.mockReset();
    mocks.openURL.mockClear();
  });

  it("does not show a warning when the app matches the latest release", async () => {
    mocks.getLatestMoineyRelease.mockResolvedValue({
      name: expo.version,
      url: `https://github.com/gavaar/moiney/releases/tag/${expo.version}`,
    });

    render(<MoineyVers />);

    await waitFor(() => expect(mocks.getLatestMoineyRelease).toHaveBeenCalled());

    expect(screen.queryByTestId("moiney-version-warning")).toBeNull();
    expect(screen.queryByTestId("outdated-app-message")).toBeNull();
  });

  it("shows the warning modal and opens the latest release page when outdated", async () => {
    const releaseUrl = "https://github.com/gavaar/moiney/releases/tag/0.3.0";
    mocks.getLatestMoineyRelease.mockResolvedValue({ name: "99999999999999.3.0", url: releaseUrl });

    render(<MoineyVers />);

    await waitFor(() => expect(screen.getByTestId("moiney-version-warning")).toBeTruthy());

    fireEvent.click(screen.getByTestId("moiney-version"));

    const message = screen.getByTestId("outdated-app-message");
    expect(message).toBeTruthy();
    expect(message.textContent).toContain("your app is out of date, please get the newest app from");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    fireEvent.click(screen.getByLabelText("Open latest GitHub release"));
    expect(mocks.openURL).toHaveBeenCalledWith(releaseUrl);
  });
});
