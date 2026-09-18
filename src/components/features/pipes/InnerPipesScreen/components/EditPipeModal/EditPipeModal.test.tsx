// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditPipeModal } from "./EditPipeModal";

const updatePipe = vi.fn().mockResolvedValue(null);

vi.mock("convex/react", () => ({
  useMutation: () => updatePipe,
}));

vi.mock("@convex/_generated/api", () => ({
  api: { pipes: { updatePipe: {} } },
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    pipesById: {
      "pipe-1": {
        id: "pipe-1",
        name: "Groceries",
        icon: "cart",
        description: "Old description",
        priority: 1,
        capacity: 100,
      },
    },
  }),
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
});
