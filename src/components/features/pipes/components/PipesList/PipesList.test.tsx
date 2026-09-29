// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipesList } from "./PipesList";
import { type Id } from "@convex/_generated/dataModel";

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ childrenByParent: new Map() }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: "deployment:alice" }) }));
vi.mock("@ui/Popover", () => ({
  Popover: ({ visible, children, onClose }: any) => visible ? (
    <div data-testid="pipe-popover">{children}<button onClick={onClose}>Dismiss</button></div>
  ) : null,
}));

vi.mock("@features/pipes/components/PipeBox", () => ({
  PipeBox: (props: any) => (
    <button
      data-testid="feed-box"
      data-capacity={props.capacity}
      data-show-priority={props.showPriority ? "true" : "false"}
      onClick={() => props.onPress?.()}
      onContextMenu={(event) => { event.preventDefault(); props.onLongPress?.(); }}
    >
      {props.name}
    </button>
  ),
}));

const mockPipes = [
  { id: "1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
  { id: "2" as Id<"pipes">, name: "Salary", icon: "cash-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
];

describe("PipesList", () => {
  beforeEach(() => localStorage.clear());
  it("moves held rows to compact tiles below full rows and restores them in original order", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipesList pipes={mockPipes} onSelectPipe={onSelectPipe} priority />);
    expect(await screen.findAllByTestId("feed-box")).toHaveLength(2);
    fireEvent.contextMenu(screen.getAllByTestId("feed-box")[0]);
    await user.click(screen.getByRole("button", { name: "Minimize" }));

    const tiles = screen.getByTestId("minimized-pipes");
    expect(within(tiles).getByRole("button", { name: /Groceries/ })).toBeDefined();
    expect(screen.getAllByTestId("feed-box")).toHaveLength(1);
    expect(screen.getByTestId("feed-box").getAttribute("data-show-priority")).toBe("true");
    await user.click(within(tiles).getByRole("button", { name: /Groceries/ }));
    expect(onSelectPipe).toHaveBeenCalledWith("1");

    fireEvent.contextMenu(within(tiles).getByRole("button", { name: /Groceries/ }));
    await user.click(screen.getByRole("button", { name: "Maximize" }));
    await waitFor(() => expect(screen.queryByTestId("minimized-pipes")).toBeNull());
    expect(screen.getAllByTestId("feed-box").map((box) => box.textContent)).toEqual(["Groceries", "Salary"]);
  });
  it("offers a minimized pipe's row action in its menu without selecting it", async () => {
    localStorage.setItem("moiney:pipe-views:deployment%3Aalice", '["1"]');
    const onSelectPipe = vi.fn();
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PipesList pipes={mockPipes} onSelectPipe={onSelectPipe} compactAction={{
      label: () => "Add money",
      onPress: onAction,
    }} />);
    const tile = await screen.findByRole("button", { name: "Groceries" });
    fireEvent.contextMenu(tile);
    await user.click(screen.getByRole("button", { name: "Add money" }));
    expect(onAction).toHaveBeenCalledWith(mockPipes[0]);
    expect(onSelectPipe).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pipe-popover")).toBeNull();
  });
  it("renders only icon, name and liquidity in a saved compact tile after remount", async () => {
    localStorage.setItem("moiney:pipe-views:deployment%3Aalice", '["1"]');
    const { unmount } = render(<PipesList pipes={[{ ...mockPipes[0], fed: 100, capacity: 200, spent: 25 }]} />);
    const tile = await screen.findByRole("button", { name: "Groceries" });
    expect(within(tile).getByTestId("liquidity")).toBeDefined();
    expect(within(tile).getByTestId("fed-bar")).toBeDefined();
    expect(tile.textContent).toBe("Groceries");
    expect(screen.queryByTestId("feed-box")).toBeNull();
    unmount();
    render(<PipesList pipes={mockPipes} />);
    expect(await screen.findByRole("button", { name: "Groceries" })).toBeDefined();
    expect(screen.getAllByTestId("feed-box")).toHaveLength(1);
  });
  it("opens the options menu by keyboard without selecting the pipe", async () => {
    const onSelectPipe = vi.fn();
    render(<PipesList pipes={mockPipes} onSelectPipe={onSelectPipe} />);
    const box = (await screen.findAllByTestId("feed-box"))[0];
    fireEvent.keyDown(box, { key: "F10", shiftKey: true });
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDefined();
    expect(onSelectPipe).not.toHaveBeenCalled();
  });
  it("renders a PipeBox for each pipe", async () => {
    render(<PipesList pipes={mockPipes} />);
    const boxes = await screen.findAllByTestId("feed-box");
    expect(boxes).toHaveLength(2);
  });

  it("uses contributed fed as a boiler card's visual baseline", async () => {
    render(
      <PipesList
        pipes={[
          {
            ...mockPipes[0],
            sourceType: "boiler",
            contributedFed: 10000,
          },
        ]}
      />,
    );

    expect((await screen.findByTestId("feed-box")).getAttribute("data-capacity")).toBe(
      "10000",
    );
  });

  it("only shows priority markers when requested", async () => {
    const pipes = [
      ...mockPipes,
      { id: "3" as Id<"pipes">, name: "Rent", icon: "home-outline", priority: 1, capacity: 0, fed: 0, spent: 0 },
    ];

    const { rerender } = render(<PipesList pipes={pipes} />);
    await screen.findAllByTestId("feed-box");
    expect(screen.getAllByTestId("feed-box").map((box) => box.getAttribute("data-show-priority")))
      .toEqual(["false", "false", "false"]);

    rerender(<PipesList pipes={pipes} priority />);
    expect(screen.getAllByTestId("feed-box").map((box) => box.getAttribute("data-show-priority")))
      .toEqual(["true", "false", "true"]);
  });

  it("calls onSelectPipe when a PipeBox is pressed", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipesList pipes={mockPipes} onSelectPipe={onSelectPipe} />);

    await user.click((await screen.findAllByTestId("feed-box"))[0]);
    expect(onSelectPipe).toHaveBeenCalledWith("1");
  });

  it("renders trailing element for each pipe when provided", async () => {
    render(
      <PipesList
        pipes={mockPipes}
        trailing={(pipe) => <span data-testid="trailing" data-pipe-id={pipe.id} />}
      />,
    );
    const trailing = await screen.findAllByTestId("trailing");
    expect(trailing).toHaveLength(2);
    expect(trailing[0].getAttribute("data-pipe-id")).toBe("1");
    expect(trailing[1].getAttribute("data-pipe-id")).toBe("2");
  });

  it("renders leading element for each pipe when provided", async () => {
    render(
      <PipesList
        pipes={mockPipes}
        leading={(pipe) => <span data-testid="leading" data-pipe-id={pipe.id} />}
      />,
    );
    const leading = await screen.findAllByTestId("leading");
    expect(leading).toHaveLength(2);
    expect(leading[0].getAttribute("data-pipe-id")).toBe("1");
    expect(leading[1].getAttribute("data-pipe-id")).toBe("2");
  });
});
