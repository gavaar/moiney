// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("shared Input validation", () => {
  it("can validate changes before blur, without validating the initial value", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return <Input label="Name" value={value} onChange={setValue} validateOn="change"
        validator={value => value.length < 3 ? "Too short" : undefined} />;
    }
    render(<Controlled />);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ada" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["change", "blur"] as const)("validates multiple selection in %s mode at the chosen trigger", mode => {
    function Controlled() {
      const [value, setValue] = useState<string[]>([]);
      return <Input type="select-multiple" label="Pipes" value={value} onChange={setValue} validateOn={mode}
        items={[{ id: "one" }, { id: "two" }]} renderItem={item => <>{item.id}</>}
        validator={value => value.length < 2 ? "Pick two" : undefined} />;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Pipes" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "one" }));
    if (mode === "change") expect(screen.getByRole("alert").textContent).toBe("Pick two");
    else expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByRole("alert").textContent).toBe("Pick two");
    fireEvent.click(screen.getByRole("button", { name: "Pipes" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "two" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
