// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { InputWrapper } from "./InputWrapper";

describe("InputWrapper actions", () => {
  it("renders independent accessory buttons beside the central trigger", async () => {
    const open = vi.fn();
    const before = vi.fn();
    const after = vi.fn();
    render(
      <InputWrapper borderStyle="border-border" accessibilityRole="button" accessibilityLabel="Open picker" onPress={open}
        prefix={{ content: <Text>Before</Text>, accessibilityLabel: "Prefix action", onPress: before }}
        suffix={{ content: <Text>After</Text>, accessibilityLabel: "Suffix action", onPress: after }}>
        <Text>Selected value</Text>
      </InputWrapper>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Prefix action" }));
    await userEvent.click(screen.getByRole("button", { name: "Suffix action" }));
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getByText("After")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Open picker" }));
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    { inputDisabled: true, buttonDisabled: false },
    { inputDisabled: false, buttonDisabled: true },
    { inputDisabled: true, buttonDisabled: true },
  ])("blocks accessories when input=$inputDisabled or button=$buttonDisabled is disabled", ({ inputDisabled, buttonDisabled }) => {
    const onPress = vi.fn();
    render(
      <InputWrapper borderStyle="border-border" disabled={inputDisabled}
        prefix={{ content: <Text>Before</Text>, accessibilityLabel: "Prefix action", onPress, disabled: buttonDisabled }}
        suffix={{ content: <Text>After</Text>, accessibilityLabel: "Suffix action", onPress, disabled: buttonDisabled }}>
        <Text>Value</Text>
      </InputWrapper>,
    );

    for (const name of ["Prefix action", "Suffix action"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onPress).not.toHaveBeenCalled();
  });
});
