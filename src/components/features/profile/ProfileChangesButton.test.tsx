// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Profile from "@/app/(main)/(tabs)/profile";
import { expo } from "@/../app.json";
import { Linking } from "react-native";
import { loadReleaseNotes } from "./ReleaseNotes/releaseNotes";

vi.mock("./ReleaseNotes/releaseNotes", () => ({ loadReleaseNotes: vi.fn() }));
// The renderer's image dependency uses native CommonJS imports, outside Vite's alias.
vi.mock("react-native-fit-image", async () => {
  const { Image } = await import("react-native");
  return { default: Image };
});

vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@features/app/AppScreenHeader", () => ({ AppScreenHeader: () => null }));
vi.mock("@features/profile/ProfileView/ProfileView", () => ({ ProfileView: () => null }));
vi.mock("@features/account/SignOutButton", () => ({ SignOutButton: () => <button>Sign out</button> }));

beforeEach(() => {
  vi.mocked(loadReleaseNotes).mockReset();
  vi.mocked(loadReleaseNotes).mockReturnValue(new Promise(() => {}));
});

it("opens installed-version changes from Profile below Sign out", async () => {
  render(<Profile />);
  const changes = screen.getByRole("button", { name: `${expo.version} changes` });
  expect(screen.getByRole("button", { name: "Sign out" }).compareDocumentPosition(changes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(changes);
  expect(await screen.findByText("Loading changes…")).toBeTruthy();
});

it("loads installed-version changes only when opened, renders Markdown, and dismisses on backdrop", async () => {
  let resolve!: (notes: string) => void;
  vi.mocked(loadReleaseNotes).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<Profile />);
  expect(loadReleaseNotes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: `${expo.version} changes` }));
  expect(screen.getByText("Loading changes…")).toBeTruthy();
  expect(loadReleaseNotes).toHaveBeenCalledWith(expo.version);
  await act(async () => resolve("## Settlement changes\n\n* **Coverage** improved\n* `settlement` fixed\n\n![Hidden image](https://example.com/image.png)\n\n<div>Hidden HTML</div>"));
  expect(await screen.findByText("Settlement changes")).toBeTruthy();
  expect(screen.getByText("Coverage")).toBeTruthy();
  expect(screen.queryByText("## Settlement changes")).toBeNull();
  expect(screen.queryByRole("img", { name: "Hidden image" })).toBeNull();
  expect(screen.queryByText("Hidden HTML")).toBeNull();
  fireEvent.click(screen.getByTestId("modal-backdrop"));
  await waitFor(() => expect(screen.queryByText("Settlement changes")).toBeNull());
});

it("offers retry for failed requests and explains missing notes", async () => {
  vi.mocked(loadReleaseNotes).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(null);
  render(<Profile />);
  fireEvent.click(screen.getByRole("button", { name: `${expo.version} changes` }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Could not load changes. Check your connection and try again.");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText(`Release notes aren’t available for ${expo.version}.`)).toBeTruthy();
});

it("opens Markdown links externally and explains link failures", async () => {
  const openURL = vi.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("No browser"));
  vi.mocked(loadReleaseNotes).mockResolvedValue("[Details](/gavaar/moiney/pull/24)");
  render(<Profile />);
  fireEvent.click(screen.getByRole("button", { name: `${expo.version} changes` }));
  const link = await screen.findByRole("link", { name: "Details" });
  fireEvent.click(link);
  expect(openURL).toHaveBeenCalledWith("https://github.com/gavaar/moiney/pull/24");
  fireEvent.click(link);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Could not open the link. Please try again.");
  openURL.mockRestore();
});
