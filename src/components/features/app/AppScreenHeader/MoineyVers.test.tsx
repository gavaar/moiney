// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expo } from "@/../app.json";
import { MoineyVers } from "./MoineyVers";
import { AppUpdateProvider } from "../updates/AppUpdateProvider";

const mocks = vi.hoisted(() => ({
  release: undefined as { latestAppVersion: string; downloadUrl: string } | null | undefined,
  queryError: false,
  notify: undefined as (() => void) | undefined,
  unsubscribe: vi.fn(),
  backHandler: undefined as (() => boolean) | undefined,
  openURL: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("convex/react", () => ({
  useConvex: () => client,
}));

const client = {
  watchQuery: () => ({
    localQueryResult: () => {
      if (mocks.queryError) throw new Error("metadata unavailable");
      return mocks.release;
    },
    onUpdate: (notify: () => void) => {
      mocks.notify = notify;
      return mocks.unsubscribe;
    },
  }),
};

vi.mock("react-native", async () => ({
  ...(await vi.importActual<typeof import("react-native")>("react-native")),
  Linking: { openURL: mocks.openURL },
  BackHandler: {
    addEventListener: (_event: string, handler: () => boolean) => {
      mocks.backHandler = handler;
      return { remove: vi.fn() };
    },
  },
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div data-testid="modal-shell">{children}</div> : null,
}));

function renderApp() {
  return render(<AppUpdateProvider><MoineyVers /><div>App content</div></AppUpdateProvider>);
}

function publish(version: string) {
  act(() => {
    mocks.release = {
      latestAppVersion: version,
      downloadUrl: `https://github.com/gavaar/moiney/releases/download/${version}/moiney.apk`,
    };
    mocks.notify?.();
  });
}

describe("app updates", () => {
  beforeEach(() => {
    mocks.release = undefined;
    mocks.queryError = false;
    mocks.notify = undefined;
    mocks.backHandler = undefined;
    mocks.unsubscribe.mockClear();
    mocks.openURL.mockClear();
  });

  it("allows access while metadata is unknown and when versions match", () => {
    renderApp();
    expect(screen.getByText("App content")).toBeTruthy();
    publish(expo.version);
    expect(screen.queryByTestId("moiney-version-warning")).toBeNull();
    expect(screen.queryByTestId("outdated-app-message")).toBeNull();
  });

  it("reacts to patch publication with an optional warning and direct APK link", () => {
    renderApp();
    const [major, minor, patch] = expo.version.split(".").map(Number);
    const version = `${major}.${minor}.${patch + 1}`;
    publish(version);
    expect(screen.getByText("App content")).toBeTruthy();
    expect(screen.getByTestId("moiney-version-warning")).toBeTruthy();
    fireEvent.click(screen.getByTestId("moiney-version"));

    const message = screen.getByTestId("outdated-app-message");
    expect(message).toBeTruthy();
    expect(message.textContent).toContain("your app is out of date, please get the newest app from");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    fireEvent.click(screen.getByLabelText("Download latest APK"));
    expect(mocks.openURL).toHaveBeenCalledWith(mocks.release?.downloadUrl);
  });

  it("blocks all app content for a minor update and keeps the gate on disconnect", () => {
    renderApp();
    const [major, minor] = expo.version.split(".").map(Number);
    publish(`${major}.${minor + 1}.0`);
    expect(screen.queryByText("App content")).toBeNull();
    expect(screen.getByText("Breaking changes were deployed, please update to the latest version.")).toBeTruthy();
    expect(mocks.backHandler?.()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(mocks.openURL).toHaveBeenCalledWith(mocks.release?.downloadUrl);
    act(() => {
      mocks.release = undefined;
      mocks.notify?.();
    });
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
    expect(screen.queryByText("App content")).toBeNull();
  });

  it("does not warn or block for an older server version", () => {
    renderApp();
    publish("0.0.0");
    expect(screen.getByText("App content")).toBeTruthy();
    expect(screen.queryByTestId("moiney-version-warning")).toBeNull();
  });

  it("blocks a major update known at launch and retains it across query errors or older metadata", () => {
    const [major] = expo.version.split(".").map(Number);
    mocks.release = {
      latestAppVersion: `${major + 1}.0.0`,
      downloadUrl: `https://github.com/gavaar/moiney/releases/download/${major + 1}.0.0/moiney.apk`,
    };
    renderApp();
    expect(screen.queryByText("App content")).toBeNull();
    act(() => {
      mocks.queryError = true;
      mocks.notify?.();
    });
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
    mocks.queryError = false;
    publish(expo.version);
    expect(screen.queryByText("App content")).toBeNull();
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
  });

  it("keeps the mandatory gate on download failure and allows retrying", async () => {
    mocks.openURL.mockRejectedValueOnce(new Error("No browser available"));
    renderApp();
    const [major, minor] = expo.version.split(".").map(Number);
    publish(`${major}.${minor + 1}.0`);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not open the download. Please try again."));
    expect(screen.queryByText("App content")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(mocks.openURL).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("allows access when the metadata query fails and cleans up its subscription", () => {
    mocks.queryError = true;
    const view = renderApp();
    expect(screen.getByText("App content")).toBeTruthy();
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
