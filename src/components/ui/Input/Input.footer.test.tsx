// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input supporting text", () => {
  it("replaces the default counter and gives errors priority", () => {
    const { rerender } = render(<Input value="a" maxLength={10} supportingText="Choose a name" validator={() => "Required"} />);
    expect(screen.getByText("Choose a name")).toBeTruthy();
    expect(screen.queryByText("1 / 10")).toBeNull();
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.queryByText("Choose a name")).toBeNull();
    rerender(<Input value="a" maxLength={10} supportingText="Choose a name" />);
    expect(screen.getByText("Choose a name")).toBeTruthy();
    rerender(<Input value="a" maxLength={10} />);
    expect(screen.getByText("1 / 10")).toBeTruthy();
  });

  it("accepts custom supporting content for non-text fields", () => {
    render(<Input type="checkbox" value={false} supportingText={<Text>Terms apply</Text>} />);
    expect(screen.getByText("Terms apply")).toBeTruthy();
  });

  it("can explicitly hide the automatic counter", () => {
    render(<Input value="a" maxLength={10} supportingText={null} />);
    expect(screen.queryByText("1 / 10")).toBeNull();
  });
});
