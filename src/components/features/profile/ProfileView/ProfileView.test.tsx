// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileView } from "./ProfileView";

type Profile = { username: string; pictureUrl: string | null };

const mocks = vi.hoisted(() => {
  let profile: Profile = { username: "gavaar", pictureUrl: null };
  const listeners = new Set<() => void>();
  return {
    getMyProfile: vi.fn(() => profile),
    setProfile: (next: Profile) => {
      profile = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    generateUploadUrl: vi.fn(),
    setPicture: vi.fn(),
    removePicture: vi.fn(),
    launchImageLibraryAsync: vi.fn(),
    uploadProfilePicture: vi.fn(),
    showAlert: { success: vi.fn(), error: vi.fn() },
  };
});

vi.mock("convex/react", async () => {
  const React = await import("react");
  return {
    useQuery: (api: string) => {
      if (api === "getMyProfile") {
        return React.useSyncExternalStore(mocks.subscribe, mocks.getMyProfile);
      }
      return undefined;
    },
    useMutation: (api: string) => {
      if (api === "generateProfilePictureUploadUrl") return mocks.generateUploadUrl;
      if (api === "setProfilePicture") return mocks.setPicture;
      if (api === "removeProfilePicture") return mocks.removePicture;
      return vi.fn();
    },
  };
});

vi.mock("@convex/_generated/api", () => ({
  api: {
    profile: {
      getMyProfile: "getMyProfile",
      generateProfilePictureUploadUrl: "generateProfilePictureUploadUrl",
      setProfilePicture: "setProfilePicture",
      removeProfilePicture: "removeProfilePicture",
    },
  },
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mocks.launchImageLibraryAsync(...args),
}));

vi.mock("./uploadProfilePicture", () => ({
  uploadProfilePicture: (...args: unknown[]) => mocks.uploadProfilePicture(...args),
}));

vi.mock("./appIcon", () => ({
  APP_ICON: "app-icon-source",
}));

vi.mock("@ui/Alert", () => ({
  useAlert: () => mocks.showAlert,
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: any) =>
    visible ? <div data-testid="profile-picture-modal">{children}</div> : null,
}));

const PROFILED_USER: Profile = { username: "gavaar", pictureUrl: null };

describe("ProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setProfile(PROFILED_USER);
    mocks.generateUploadUrl.mockResolvedValue("https://upload-url");
    mocks.setPicture.mockResolvedValue(undefined);
    mocks.removePicture.mockResolvedValue(undefined);
  });

  it("shows the username in @handle form", () => {
    render(<ProfileView />);
    expect(screen.getByText("@gavaar")).toBeDefined();
  });

  it("renders an editable avatar button", () => {
    render(<ProfileView />);
    expect(screen.getByTestId("profile-avatar")).toBeDefined();
  });

  it("opens the edit modal when the avatar is pressed", async () => {
    const user = userEvent.setup();
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    expect(screen.getByTestId("profile-picture-modal")).toBeDefined();
  });

  it("does not offer remove when the user has no picture", async () => {
    const user = userEvent.setup();
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    expect(screen.queryByText("Remove photo")).toBeNull();
    expect(screen.getByText("Update image")).toBeDefined();
  });

  it("shows the user picture large in the modal", async () => {
    const user = userEvent.setup();
    mocks.setProfile({ username: "gavaar", pictureUrl: "https://pic/1" });
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    const preview = screen.getByTestId("profile-picture-preview");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe("https://pic/1");
  });

  it("falls back to the app icon when the user has no picture", async () => {
    const user = userEvent.setup();
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    const preview = screen.getByTestId("profile-picture-preview");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe("app-icon-source");
  });

  it("does not offer a cancel button", async () => {
    const user = userEvent.setup();
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("offers remove when the user has a picture", async () => {
    const user = userEvent.setup();
    mocks.setProfile({ username: "gavaar", pictureUrl: "https://pic/1" });
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    expect(screen.getByText("Remove photo")).toBeDefined();
  });

  it("places Remove photo to the left of Update image", async () => {
    const user = userEvent.setup();
    mocks.setProfile({ username: "gavaar", pictureUrl: "https://pic/1" });
    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    const remove = screen.getByText("Remove photo");
    const update = screen.getByText("Update image");
    expect(remove.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(update.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeFalsy();
  });

  it("uploads a picked picture, keeps the modal open, and updates the preview", async () => {
    const user = userEvent.setup();
    mocks.setPicture.mockImplementation(async ({ storageId }) => {
      mocks.setProfile({ username: "gavaar", pictureUrl: `https://uploaded/${storageId}` });
    });
    mocks.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/photo.jpg", mimeType: "image/jpeg" }],
    });
    mocks.uploadProfilePicture.mockResolvedValue("storage-1");

    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    await user.click(screen.getByText("Update image"));

    await waitFor(() => {
      expect(mocks.generateUploadUrl).toHaveBeenCalledTimes(1);
      expect(mocks.uploadProfilePicture).toHaveBeenCalledWith("https://upload-url", {
        uri: "file:///tmp/photo.jpg",
        mimeType: "image/jpeg",
      });
      expect(mocks.setPicture).toHaveBeenCalledWith({ storageId: "storage-1" });
    });
    expect(screen.getByTestId("profile-picture-modal")).toBeDefined();
    await waitFor(() => {
      expect(
        screen
          .getByTestId("profile-picture-preview")
          .querySelector("img")
          ?.getAttribute("src"),
      ).toBe("https://uploaded/storage-1");
    });
    expect(screen.getByText("Remove photo")).toBeDefined();
    expect(mocks.showAlert.success).toHaveBeenCalledWith("Profile picture updated");
  });

  it("does nothing when the picker is canceled", async () => {
    const user = userEvent.setup();
    mocks.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    await user.click(screen.getByText("Update image"));

    expect(mocks.generateUploadUrl).not.toHaveBeenCalled();
    expect(mocks.setPicture).not.toHaveBeenCalled();
  });

  it("surfaces an alert when the upload fails", async () => {
    const user = userEvent.setup();
    mocks.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/photo.jpg" }],
    });
    mocks.uploadProfilePicture.mockRejectedValue(new Error("Upload failed"));

    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    await user.click(screen.getByText("Update image"));

    await waitFor(() => {
      expect(mocks.showAlert.error).toHaveBeenCalledWith("Upload failed");
    });
  });

  it("removes the picture and keeps the modal open", async () => {
    const user = userEvent.setup();
    mocks.setProfile({ username: "gavaar", pictureUrl: "https://pic/1" });
    mocks.removePicture.mockImplementation(async () => {
      mocks.setProfile({ username: "gavaar", pictureUrl: null });
    });

    render(<ProfileView />);
    await user.click(screen.getByTestId("profile-avatar"));
    await user.click(screen.getByText("Remove photo"));

    await waitFor(() => {
      expect(mocks.removePicture).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("profile-picture-modal")).toBeDefined();
    await waitFor(() => {
      expect(
        screen
          .getByTestId("profile-picture-preview")
          .querySelector("img")
          ?.getAttribute("src"),
      ).toBe("app-icon-source");
    });
    expect(screen.queryByText("Remove photo")).toBeNull();
    expect(mocks.showAlert.success).toHaveBeenCalledWith("Profile picture removed");
  });
});