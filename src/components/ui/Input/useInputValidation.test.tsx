// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInputValidation } from "./useInputValidation";

describe("useInputValidation", () => {
  it("validates controlled values after becoming dirty and stays live after correction", () => {
    const validator = (value: string) => value ? undefined : "Required";
    const { result, rerender } = renderHook(({ value }) => useInputValidation(value, validator), {
      initialProps: { value: "" },
    });
    expect(result.current.error).toBeUndefined();
    act(() => result.current.markAsDirty());
    expect(result.current.error).toBe("Required");
    rerender({ value: "Valid" });
    expect(result.current.error).toBeUndefined();
    rerender({ value: "" });
    expect(result.current.error).toBe("Required");
    rerender({ value: "Parent replacement" });
    expect(result.current.error).toBeUndefined();
    rerender({ value: "" });
    expect(result.current.error).toBe("Required");
  });

  it("revalidates dirty inputs when validators change or are removed", () => {
    type Props = { validator?: (value: string) => string | undefined };
    const initialProps: Props = { validator: () => "Required" };
    const { result, rerender } = renderHook(
      ({ validator }: Props) => useInputValidation("", validator),
      { initialProps },
    );
    expect(result.current.error).toBeUndefined();
    act(() => result.current.markAsDirty());
    expect(result.current.error).toBe("Required");
    rerender({ validator: () => "Unavailable" });
    expect(result.current.error).toBe("Unavailable");
    rerender({ validator: undefined });
    expect(result.current.error).toBeUndefined();
  });

  it("notifies only on error changes using the latest callback, even with inline validators", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { result, rerender } = renderHook(({ onError }) => useInputValidation("", () => "Required", onError), {
      initialProps: { onError: first },
    });
    expect(first).toHaveBeenCalledExactlyOnceWith(undefined);
    rerender({ onError: latest });
    expect(latest).not.toHaveBeenCalled();
    act(() => result.current.markAsDirty());
    expect(latest).toHaveBeenCalledExactlyOnceWith("Required");
    rerender({ onError: first });
    expect(first).toHaveBeenCalledTimes(1);
  });
});
