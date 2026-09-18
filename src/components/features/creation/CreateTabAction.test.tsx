// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTabAction } from "./CreateTabAction";

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
  it("dismisses on the backdrop and reopens with transaction selected and a fresh draft", () => {
    render(<CreateTabAction />);
    expect(screen.queryByRole("tab", { name: "transaction" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Create"));
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("tab", { name: "root" }));
    expect(screen.getByRole("heading", { name: "Create Feed" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByRole("heading", { name: "Create Feed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("tab", { name: "transaction" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Submit transaction" }));
    expect(screen.queryByRole("tab", { name: "transaction" })).toBeNull();
  });
});
