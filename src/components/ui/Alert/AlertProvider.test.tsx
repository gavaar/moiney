// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertContext, AlertProvider } from "./AlertProvider";

function Trigger() {
  const context = AlertContext;
  return (
    <context.Consumer>
      {(value) => (
        <button onClick={() => value?.showAlert.error("Something went wrong")}>
          show alert
        </button>
      )}
    </context.Consumer>
  );
}

describe("AlertProvider", () => {
  it("announces alert messages with alert semantics", async () => {
    const user = userEvent.setup();
    render(
      <AlertProvider>
        <Trigger />
      </AlertProvider>,
    );

    await user.click(screen.getByText("show alert"));

    expect(screen.getByRole("alert", { name: "Something went wrong" })).toBeDefined();
  });
});
