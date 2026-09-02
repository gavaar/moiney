// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickTransactionTabAction } from "./QuickTransactionTabAction";

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  PipeCatalogProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("./QuickTransactionModal", () => ({
  QuickTransactionModal: ({ onClose }: any) => (
    <div data-testid="quick-transaction-modal">
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: any) => <span data-icon={name} />,
}));

describe("QuickTransactionTabAction", () => {
  it("opens and closes the quick transaction modal", () => {
    render(<QuickTransactionTabAction />);

    expect(screen.queryByTestId("quick-transaction-modal")).toBeNull();
    fireEvent.click(screen.getByLabelText("Create transaction"));
    expect(screen.getByTestId("quick-transaction-modal")).toBeTruthy();

    fireEvent.click(screen.getByText("Close modal"));
    expect(screen.queryByTestId("quick-transaction-modal")).toBeNull();
  });
});
