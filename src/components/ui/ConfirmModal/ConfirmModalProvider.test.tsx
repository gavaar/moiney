// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  ConfirmModalProvider,
  useConfirmWithModal,
} from "./ConfirmModalProvider";

function Trigger() {
  const confirmWithModal = useConfirmWithModal();
  const [result, setResult] = useState("pending");

  return (
    <>
      <button
        onClick={async () => {
          const confirmed = await confirmWithModal({
            title: "Delete transaction?",
            message: <span>Deletion warning</span>,
            confirmLabel: "Delete transaction",
            destructive: true,
          });
          setResult(String(confirmed));
        }}
      >
        open
      </button>
      <span>{result}</span>
    </>
  );
}

function ConcurrentTrigger() {
  const confirmWithModal = useConfirmWithModal();
  const [result, setResult] = useState("pending");
  return (
    <>
      <button
        onClick={async () => {
          const results = await Promise.all([
            confirmWithModal({ message: "First" }),
            confirmWithModal({ message: "Second" }),
          ]);
          setResult(results.join(","));
        }}
      >
        open twice
      </button>
      <span>{result}</span>
    </>
  );
}

describe("ConfirmModalProvider", () => {
  it("resolves true when the confirm action is pressed", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalProvider>
        <Trigger />
      </ConfirmModalProvider>,
    );

    await user.click(screen.getByText("open"));

    expect(screen.getByText("Deletion warning")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Delete transaction" }));
    expect(await screen.findByText("true")).toBeDefined();
    expect(screen.queryByText("Deletion warning")).toBeNull();
  });

  it("resolves false when cancel is pressed", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalProvider>
        <Trigger />
      </ConfirmModalProvider>,
    );

    await user.click(screen.getByText("open"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("false")).toBeDefined();
  });

  it("resolves false when the backdrop dismisses the modal", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalProvider>
        <Trigger />
      </ConfirmModalProvider>,
    );

    await user.click(screen.getByText("open"));
    await user.click(screen.getByTestId("modal-backdrop"));

    expect(await screen.findByText("false")).toBeDefined();
  });

  it("safely declines a concurrent confirmation request", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalProvider>
        <ConcurrentTrigger />
      </ConfirmModalProvider>,
    );

    await user.click(screen.getByText("open twice"));
    expect(screen.getByText("First")).toBeDefined();
    expect(screen.queryByText("Second")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("true,false")).toBeDefined();
  });
});
