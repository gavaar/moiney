// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTabAction } from "./CreateTabAction";
import { ConfirmModalProvider } from "@ui/ConfirmModal";

vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  PipeCatalogProvider: ({ children }: any) => <>{children}</>,
  usePipeCatalog: () => ({ allPipes: [], childrenByParent: new Map(), isLoading: false }),
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@features/transactions/TransactionForm/TransactionForm", () => ({
  TransactionForm: ({ onSuccess }: any) => <div>
    <input aria-label="Draft" defaultValue="" />
    <button onClick={onSuccess}>Submit transaction</button>
  </div>,
}));
vi.mock("@ui/Icon", async importOriginal => ({
  ...await importOriginal<typeof import("@ui/Icon")>(),
  Icon: () => null,
}));

describe("CreateTabAction", () => {
  it("starts pipe creation with the type picker collapsed until tapped", () => {
    render(<ConfirmModalProvider><CreateTabAction /></ConfirmModalProvider>);
    fireEvent.click(screen.getByLabelText("Create"));
    fireEvent.click(screen.getByRole("tab", { name: "pipe" }));
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Basic feed" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByRole("heading", { name: "Create pipe" })).toBeNull();
    expect(screen.queryByText("Discard changes?")).toBeNull();
    fireEvent.click(screen.getByLabelText("Create"));
    fireEvent.click(screen.getByRole("tab", { name: "pipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    expect(screen.getByRole("button", { name: "Basic feed" })).toBeTruthy();
  });

  it("closes the pipe picker before backdrop dismissal and reopens with transaction selected and a fresh draft", () => {
    render(<ConfirmModalProvider><CreateTabAction /></ConfirmModalProvider>);
    expect(screen.queryByRole("tab", { name: "transaction" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Create"));
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("tab", { name: "pipe" }));
    expect(screen.getByRole("heading", { name: "Create pipe" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByRole("heading", { name: "Create pipe" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Pipe type required");
    expect(screen.queryByText("Discard changes?")).toBeNull();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByRole("heading", { name: "Create pipe" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("tab", { name: "transaction" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Submit transaction" }));
    expect(screen.queryByRole("tab", { name: "transaction" })).toBeNull();
  });
});
