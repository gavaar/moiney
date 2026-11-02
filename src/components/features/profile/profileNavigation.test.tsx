// @vitest-environment jsdom
import { cloneElement, useState, type ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainLayout from "@/app/(main)/_layout";

const navigation = vi.hoisted(() => ({
  routes: ["tabs"],
  listeners: new Set<() => void>(),
  replace: vi.fn(),
}));
const viewport = vi.hoisted(() => ({ width: 360 }));
vi.mock("react-native", async importOriginal => ({
  ...await importOriginal<typeof import("react-native")>(),
  useWindowDimensions: () => ({ width: viewport.width, height: 800, scale: 1, fontScale: 1 }),
}));
vi.mock("@ui/Icon", async importOriginal => ({ ...await importOriginal<typeof import("@ui/Icon")>(), Icon: () => null }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, accountKey: "deployment:alice" }),
}));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));

// Model the framework's rendering boundary: Slot renders only the active
// descriptor; Stack retains previous screens underneath the pushed screen.
// Native gestures/animations still require device verification.
vi.mock("expo-router", async () => {
  const { useSyncExternalStore } = await import("react");
  function useRoutes() {
    return useSyncExternalStore(
      (listener) => {
        navigation.listeners.add(listener);
        return () => navigation.listeners.delete(listener);
      },
      () => navigation.routes,
    );
  }
  function renderRoute(route: string) {
    return route === "tabs" ? <TabsScreen /> : <SettingsScreen />;
  }
  function Stack() {
    const routes = useRoutes();
    return routes.map((route, index) => (
      <div key={route} hidden={index !== routes.length - 1}>
        {renderRoute(route)}
      </div>
    ));
  }
  Stack.Screen = function Screen(_: { name: string }) { return null; };
  return {
    useRouter: () => ({ replace: navigation.replace }),
    useSegments: () => navigation.routes.at(-1) === "settings" ? ["(main)", "settings"] : ["(main)", "(tabs)", "profile"],
    Link: ({ href, children }: { href: string; children: ReactElement<{ href?: string }> }) => cloneElement(children, { href }),
    Slot: () => renderRoute(useRoutes().at(-1)!),
    Stack,
  };
});

vi.mock("expo-router/stack", async () => {
  const { Stack } = await import("expo-router");
  return { Stack };
});

function navigate(routes: string[]) {
  navigation.routes = routes;
  navigation.listeners.forEach((listener) => listener());
}

function TabsScreen() {
  const [tab, setTab] = useState("pipes");
  const [pictureLoaded, setPictureLoaded] = useState(false);
  return (
    <>
      <button onClick={() => setTab("profile")}>Profile tab</button>
      {tab === "profile" ? (
        <>
          <img alt="Avatar" src={pictureLoaded ? "/my-picture.png" : "/default.png"} />
          <button onClick={() => setPictureLoaded(true)}>Finish loading picture</button>
          <button onClick={() => navigate([...navigation.routes, "settings"])}>Settings</button>
        </>
      ) : <p>Pipes screen</p>}
    </>
  );
}

function SettingsScreen() {
  return (
    <>
      <p>Settings screen</p>
      <button onClick={() => navigate(navigation.routes.slice(0, -1))}>System Back</button>
    </>
  );
}

describe("profile/settings screen lifetime", () => {
  beforeEach(() => {
    navigation.routes = ["tabs"];
    viewport.width = 360;
  });

  function openSettings() {
    const rendered = render(<MainLayout />, {
      wrapper: ({ children }) => <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>{children}</SafeAreaProvider>,
    });
    fireEvent.click(screen.getByText("Profile tab"));
    fireEvent.click(screen.getByText("Finish loading picture"));
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByText("Settings screen")).toBeDefined();
    return rendered;
  }

  it("keeps the loaded profile picture alive while Settings is open", () => {
    openSettings();
    expect(screen.getByAltText("Avatar").getAttribute("src")).toBe("/my-picture.png");
  });

  it("returns to the selected Profile tab on system Back", () => {
    openSettings();
    fireEvent.click(screen.getByText("System Back"));
    expect(screen.queryByText("Pipes screen")).toBeNull();
    expect(screen.getByAltText("Avatar").getAttribute("src")).toBe("/my-picture.png");
  });

  it("preserves Settings Back and the loaded Profile screen across layout changes", () => {
    const { rerender } = openSettings();
    for (const width of [1024, 1023, 1600]) {
      viewport.width = width;
      rerender(<MainLayout />);
      expect(screen.getByText("Settings screen")).toBeTruthy();
      expect(Boolean(screen.queryByRole("link", { name: "Pipes" }))).toBe(width >= 1024);
      expect(screen.getByAltText("Avatar").getAttribute("src")).toBe("/my-picture.png");
    }
    fireEvent.click(screen.getByText("System Back"));
    expect(screen.queryByText("Settings screen")).toBeNull();
    expect(screen.queryByText("Pipes screen")).toBeNull();
    expect(screen.getByAltText("Avatar").getAttribute("src")).toBe("/my-picture.png");
  });
});
