// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MinimizedPipe } from "./MinimizedPipe";
import { type Id } from "@convex/_generated/dataModel";

describe("MinimizedPipe", () => {
  it("opens options on a held tile without selecting the pipe", async () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    render(<MinimizedPipe
      pipe={{ id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", priority: 0, capacity: 200, fed: 100, spent: 25 }}
      onPress={onPress}
      onLongPress={onLongPress}
    />);
    const tile = screen.getByRole("button", { name: "Groceries" });
    const touch = { identifier: 1, clientX: 10, clientY: 10, pageX: 10, pageY: 10, target: tile };
    fireEvent.touchStart(tile, { touches: [touch], changedTouches: [touch] });
    await waitFor(() => expect(onLongPress).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.touchEnd(tile, { touches: [], changedTouches: [touch] });
    expect(onPress).not.toHaveBeenCalled();
  });
});
