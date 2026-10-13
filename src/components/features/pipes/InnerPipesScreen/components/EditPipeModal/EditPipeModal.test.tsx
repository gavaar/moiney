// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditPipeModal } from "./EditPipeModal";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";

const updatePipe = vi.fn().mockResolvedValue(null);
let allPipes: PipeModel[];
const id = (value: string) => value as Id<"pipes">;

vi.mock("convex/react", () => ({
  useMutation: () => updatePipe,
}));

vi.mock("@convex/_generated/api", () => ({
  api: { pipes: { updatePipe: {} } },
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes, pipesById: Object.fromEntries(allPipes.map(pipe => [pipe.id, pipe])) }),
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: any) => (visible ? <div>{children}</div> : null),
}));

vi.mock("@ui/Alert", () => ({
  useAlert: () => ({ error: vi.fn() }),
}));

vi.mock("@ui/Icon", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ui/Icon")>()),
  Icon: () => null,
}));

vi.mock("@ui/Button", () => ({
  Button: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
}));

describe("EditPipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const pipe = (key: string, name: string, parentId?: string): PipeModel => ({
      id: id(key), name, parentId: parentId ? id(parentId) : undefined, icon: "pipe", description: "Old description",
      priority: 1, capacity: 100, fed: 0, spent: 0,
    });
    allPipes = [pipe("root", "Root"), pipe("pipe-1", "Groceries", "root"), pipe("reserve", "Reserve", "root"),
      { ...pipe("chained", "Chained", "root"), contingencyPipeId: id("reserve") },
      pipe("branch", "Branch", "root"), pipe("cousin", "Cousin", "branch")];
  });

  it("validates the name on blur and clears its error during correction", () => {
    render(<EditPipeModal visible pipeId={"pipe-1" as any} onClose={vi.fn()} />);
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "a" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(name);
    expect(screen.getByRole("alert").textContent).toBe("Name must be at least 3 characters");
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "Food" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends an explicit clear command when the description is emptied", async () => {
    render(
      <EditPipeModal
        visible
        pipeId={"pipe-1" as any}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() =>
      expect(updatePipe).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      ),
    );
  });

  it("offers only eligible donors and saves the chosen contingency", async () => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    expect(screen.queryByText("Chained")).toBeNull();
    expect(screen.queryByText("Branch")).toBeNull();
    expect(screen.queryByText("Cousin")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: "reserve" })));
  });

  it("displays the configured donor and explicitly clears it with No contingency", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Contingency" }).textContent).toContain("Reserve");
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "No contingency" }));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: null })));
  });

  it("omits the contingency command when only other fields were edited", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalled());
    expect(updatePipe.mock.calls[0][0]).not.toHaveProperty("contingencyPipeId");
  });

  it("blocks a draft donor that becomes ineligible while editing and allows clearing it", async () => {
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    allPipes = allPipes.map(pipe => pipe.id === id("reserve") ? { ...pipe, contingencyPipeId: id("chained") } : pipe);
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByText("Selected contingency is no longer eligible. Choose another or clear it.")).toBeTruthy();
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "No contingency" }));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: null })));
  });

  it.each(["instant_settlement", "self_destruct"] as const)("does not offer contingency for a %s source", rule => {
    allPipes[1] = { ...allPipes[1], rule };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Contingency" })).toBeNull();
  });
});
