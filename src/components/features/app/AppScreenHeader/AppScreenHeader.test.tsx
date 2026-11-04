// @vitest-environment jsdom
import { cloneElement, useCallback, useState, type ReactElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedShell } from "../AuthenticatedShell/AuthenticatedShell";
import { AppTabs } from "../AppTabs/AppTabs";
import { AppScreenHeader } from "./AppScreenHeader";
import { PipesScreen } from "@features/pipes/PipesScreen";
import { PipeCatalogProvider, usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { PipeSelectionProvider, usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { SettingsScreen } from "@features/profile/SettingsScreen/SettingsScreen";
import { MonthlyStatisticsDetail } from "@features/statistics/MonthlyStatisticsDetail/MonthlyStatisticsDetail";
import { CurrentMonthStatisticsDetail } from "@features/statistics/CurrentMonthStatisticsDetail";

const route = vi.hoisted(() => ({ pathname: "/pipes", width: 1200, navigate: vi.fn(), back: vi.fn() }));
const pipes = [
  { _id: "root", name: "Travel", icon: "pipe", priority: 0, capacity: 0, fed: 1000, spent: 0 },
  { _id: "child", parentId: "root", name: "Madrid", icon: "pipe", priority: 0, capacity: 1000, fed: 1000, spent: 0 },
];
let catalog = pipes;
vi.mock("react-native", async importOriginal => ({
  ...await importOriginal<typeof import("react-native")>(),
  useWindowDimensions: () => ({ width: route.width, height: 800, scale: 1, fontScale: 1 }),
}));
vi.mock("expo-router", () => ({
  usePathname: () => route.pathname,
  useSegments: () => route.pathname === "/settings" ? ["(main)", "settings"] : ["(main)", "(tabs)", ...route.pathname.slice(1).split("/")],
  useRouter: () => ({ navigate: route.navigate, dismissTo: route.navigate }),
  useNavigation: () => ({ dispatch: vi.fn() }),
  Link: ({ href, onPress, children }: { href: string; onPress?: (event: React.MouseEvent) => void;
    children: ReactElement<{ href?: string; onPress?: (event: React.MouseEvent) => void }> }) =>
    cloneElement(children, {
      href,
      onPress: event => {
        children.props.onPress?.(event);
        onPress?.(event);
        if (!event.defaultPrevented) route.navigate(href);
      },
    }),
  Tabs: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Screen: ({ name, listeners }: { name: string; listeners?: { tabPress?: (event: { preventDefault: () => void }) => void } }) => name === "pipes" ?
      <button onClick={() => {
        let prevented = false;
        listeners?.tabPress?.({ preventDefault: () => { prevented = true; } });
        if (!prevented) route.navigate("/pipes");
      }}>Compact Pipes</button> : null,
  }),
}));
vi.mock("expo-router/react-navigation", async () => ({
  StackActions: (await import("expo-router/build/react-navigation/routers/StackRouter")).StackActions,
  useFocusEffect: () => {},
  useIsFocused: () => true,
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("convex/react", () => ({ useQuery: () => catalog }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { getPipes: "pipes" }, monthlySpendingStats: { getMine: "report" } } }));
vi.mock("@ui/Icon", async importOriginal => ({ ...await importOriginal<typeof import("@ui/Icon")>(), Icon: () => null }));
vi.mock("../updates/AppUpdateProvider", () => ({ useLatestAppRelease: () => null }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ biometrics: { loading: false, available: false, enabled: false } }) }));
vi.mock("@features/statistics/preferences/MonthlyCardPreference", () => ({ useMonthlyCardPreference: () => ({ ready: true, showInMain: false, setShowInMain: vi.fn() }) }));
vi.mock("@features/statistics/CurrentMonthReportContext", () => ({ useCurrentMonthReportContext: () => ({ report: null }) }));
vi.mock("@features/statistics/ReportContent", () => ({ ReportContent: () => null }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useEventHistoryCache: () => ({ eventHistory: { updatedAt: 0 } }) }));
vi.mock("@features/transactions/cache/useEventHistory", () => ({ useEventHistory: () => ({ entries: [] }) }));
vi.mock("@features/pipes/FeedListScreen", () => ({ FeedListScreen: () => <div>Feed list</div> }));
vi.mock("@features/pipes/InnerPipesScreen", () => ({ InnerPipesScreen: () => <div>Selected pipe</div> }));
vi.mock("@features/pipes/PipeTreeView", () => ({ PipeTreeView: () => <div>Pipe tree</div> }));
vi.mock("@features/transactions/history/MixedHistoryFeed/MixedHistoryFeed", () => ({ MixedHistoryFeed: () => null }));

function SelectionControls() {
  const { allPipes } = usePipeCatalog();
  const { selectPipe, selectedName } = usePipeSelection();
  return <><button onClick={() => selectPipe(allPipes!.map(pipe => pipe.id))}>Select Madrid</button>
    <output data-testid="selection">{selectedName ?? "None"}</output></>;
}

function Fixture({ openPipeId, onPipeOpened }: { openPipeId?: string; onPipeOpened?: () => void } = {}) {
  const title = route.pathname === "/history" ? "History" : route.pathname === "/statistics" ? "Statistics" : "Profile";
  return <PipeCatalogProvider><AuthenticatedShell>
    <PipeSelectionProvider>
      <SelectionControls />
      <div hidden={route.pathname !== "/pipes"}><PipesScreen openPipeId={openPipeId} onPipeOpened={onPipeOpened} /></div>
    </PipeSelectionProvider>
    {route.width < 1024 ? <AppTabs /> : null}
    {route.pathname === "/settings" ? <SettingsScreen onBack={route.back} /> :
      route.pathname === "/statistics/2026-10-01" ? <MonthlyStatisticsDetail periodStart={0} onBack={route.back} /> :
        route.pathname === "/pipes/current" || route.pathname === "/statistics/current" ? <CurrentMonthStatisticsDetail onBack={route.back} /> :
          route.pathname !== "/pipes" ? <AppScreenHeader title={title} /> : null}
  </AuthenticatedShell></PipeCatalogProvider>;
}

function DeepLinkRoute({ pipeId }: { pipeId?: string }) {
  const [consumedId, setConsumedId] = useState<string>();
  const onPipeOpened = useCallback(() => setConsumedId(pipeId), [pipeId]);
  const pendingId = pipeId !== consumedId ? pipeId : undefined;
  return <><Fixture openPipeId={pendingId} onPipeOpened={onPipeOpened} />
    <output data-testid="pending-pipe">{pendingId ?? "None"}</output></>;
}

describe("authenticated header Pipes shortcuts", () => {
  beforeEach(() => { route.pathname = "/pipes"; route.width = 1200; catalog = pipes; vi.clearAllMocks(); });

  it("preserves a consumed deep link when the previous selected pipe disappears in the same update", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeepLinkRoute />);
    await user.click(screen.getByRole("button", { name: "Select Madrid" }));
    catalog = [pipes[0], { ...pipes[1], _id: "other", name: "Other" }];
    rerender(<DeepLinkRoute pipeId="other" />);
    expect(screen.getByTestId("pending-pipe").textContent).toBe("None");
    expect(screen.getByTestId("selection").textContent).toBe("Other");
  });

  it.each([
    ["/history", "History"],
    ["/statistics", "Statistics"],
    ["/profile", "Profile"],
    ["/settings", "Settings"],
    ["/statistics/2026-10-01", "Spending report"],
    ["/pipes/current", "Live spending report"],
    ["/statistics/current", "Live spending report"],
  ])("switches from %s without clearing selection, then reselects Pipes to clear the hierarchy", async (pathname, title) => {
    const user = userEvent.setup();
    const { rerender } = render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Select Madrid" }));
    route.pathname = pathname;
    rerender(<Fixture />);
    const shortcut = screen.getByRole("button", { name: `${title}, Pipes shortcut` });
    shortcut.focus();
    await user.keyboard("{Enter}");
    expect(route.navigate).toHaveBeenLastCalledWith("/pipes");
    expect(screen.getByTestId("selection").textContent).toBe("Madrid");
    route.pathname = "/pipes";
    rerender(<Fixture />);
    screen.getByRole("button", { name: "Pipes, Pipes shortcut" }).focus();
    await user.keyboard(" ");
    expect(screen.getByTestId("selection").textContent).toBe("None");
    expect(screen.getByText("Feed list")).toBeTruthy();
  });

  it.each([360, 1200])("matches navigation and title behavior and retains Tree mode at width %s", async width => {
    route.width = width;
    const user = userEvent.setup();
    const { rerender } = render(<Fixture />);
    const pipesAction = () => screen.getByRole(width < 1024 ? "button" : "link", { name: width < 1024 ? "Compact Pipes" : "Pipes" });
    await user.click(screen.getByRole("button", { name: "Select Madrid" }));
    route.pathname = "/settings";
    rerender(<Fixture />);
    pipesAction().focus();
    await user.keyboard("{Enter}");
    expect(route.navigate).toHaveBeenLastCalledWith("/pipes");
    expect(screen.getByTestId("selection").textContent).toBe("Madrid");
    route.pathname = "/pipes";
    rerender(<Fixture />);
    await user.click(pipesAction());
    expect(screen.getByTestId("selection").textContent).toBe("None");
    await user.click(screen.getByRole("radio", { name: "Tree view" }));
    expect(screen.getByText("Pipe tree")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Pipes, Pipes shortcut" }));
    await user.click(pipesAction());
    expect(screen.getByText("Pipe tree")).toBeTruthy();
    route.pathname = "/history";
    rerender(<Fixture />);
    await user.click(screen.getByRole("button", { name: "History, Pipes shortcut" }));
    route.pathname = "/pipes";
    rerender(<Fixture />);
    expect(screen.getByText("Pipe tree")).toBeTruthy();
  });

  it.each([["/settings", "Back"], ["/statistics/2026-10-01", "Back to statistics"], ["/pipes/current", "Back to Pipes"]])("keeps the Back action independent on %s", (pathname, label) => {
    route.pathname = pathname;
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(route.back).toHaveBeenCalledOnce();
    expect(route.navigate).not.toHaveBeenCalled();
  });

  it("preserves selection in this window when the sidebar Pipes link is modified for another window", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Select Madrid" }));
    const link = screen.getByRole("link", { name: "Pipes" });
    expect(link.getAttribute("href")).toBe("/pipes");
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    expect(screen.getByTestId("selection").textContent).toBe("Madrid");
  });
});
