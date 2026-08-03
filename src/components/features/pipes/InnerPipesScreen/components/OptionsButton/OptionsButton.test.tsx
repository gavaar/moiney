// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";
import { OptionsButton } from "./OptionsButton";

vi.mock("@ui/Popover", () => ({
  Popover: ({ visible, children, onClose }: any) =>
    visible ? (
      <div data-testid="options-popover">
        <div data-testid="popover-backdrop" onClick={onClose} />
        {children}
      </div>
    ) : null,
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

vi.mock("@features/pipes/InnerPipesScreen/components/DeletePipeConfirmation", () => ({
  DeletePipeConfirmation: ({ visible, pipeId }: any) =>
    visible ? <div data-testid="delete-confirmation">Delete {pipeId}</div> : null,
}));

vi.mock("@features/pipes/InnerPipesScreen/components/EditPipeModal", () => ({
  EditPipeModal: ({ visible, pipeId }: any) =>
    visible ? <div data-testid="edit-modal">Edit {pipeId}</div> : null,
}));

vi.mock("@features/pipes/InnerPipesScreen/components/AddPipeModal", () => ({
  AddPipeModal: ({ visible, parentId }: any) =>
    visible ? <div data-testid="add-modal">Add {parentId}</div> : null,
}));

const pipeId = "test-pipe" as Id<"pipes">;

describe("OptionsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a settings-outline gear trigger", () => {
    render(<OptionsButton pipeId={pipeId} />);
    const icons = screen.getAllByTestId("icon");
    const gear = icons.find((i) => i.getAttribute("data-name") === "settings-outline");
    expect(gear).toBeDefined();
  });

  it("opens popover showing add, edit and delete labels on gear tap", async () => {
    const user = userEvent.setup();
    render(<OptionsButton pipeId={pipeId} />);
    const gear = screen
      .getAllByTestId("icon")
      .find((i) => i.getAttribute("data-name") === "settings-outline")!;
    await user.click(gear);
    expect(screen.getByText("Add pipe")).toBeDefined();
    expect(screen.getByText("Edit")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("closes popover on backdrop tap", async () => {
    const user = userEvent.setup();
    render(<OptionsButton pipeId={pipeId} />);
    await user.click(
      screen.getAllByTestId("icon").find((i) => i.getAttribute("data-name") === "settings-outline")!,
    );
    expect(screen.getByTestId("options-popover")).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByTestId("options-popover")).toBeNull();
  });

  it("opens the add pipe modal with the pipe as parent when Add pipe is tapped", async () => {
    const user = userEvent.setup();
    render(<OptionsButton pipeId={pipeId} />);
    await user.click(
      screen.getAllByTestId("icon").find((i) => i.getAttribute("data-name") === "settings-outline")!,
    );
    await user.click(screen.getByText("Add pipe"));
    expect(screen.getByTestId("add-modal").textContent).toBe(`Add ${pipeId}`);
  });

  it("opens the edit modal when Edit is tapped", async () => {
    const user = userEvent.setup();
    render(<OptionsButton pipeId={pipeId} />);
    await user.click(
      screen.getAllByTestId("icon").find((i) => i.getAttribute("data-name") === "settings-outline")!,
    );
    await user.click(screen.getByText("Edit"));
    expect(screen.getByTestId("edit-modal").textContent).toBe(`Edit ${pipeId}`);
  });

  it("opens the delete confirmation when Delete is tapped", async () => {
    const user = userEvent.setup();
    render(<OptionsButton pipeId={pipeId} />);
    await user.click(
      screen.getAllByTestId("icon").find((i) => i.getAttribute("data-name") === "settings-outline")!,
    );
    await user.click(screen.getByText("Delete"));
    expect(screen.getByTestId("delete-confirmation").textContent).toBe(`Delete ${pipeId}`);
  });
});
