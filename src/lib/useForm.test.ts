// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForm } from "./useForm";

describe("useForm", () => {
  it("initializes with values", () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "", password: "" },
        onSubmit: vi.fn(),
      }),
    );
    expect(result.current.values).toEqual({ email: "", password: "" });
  });

  it("updates a field", () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "" },
        onSubmit: vi.fn(),
      }),
    );
    act(() => result.current.setField("email", "a@b.com"));
    expect(result.current.values.email).toBe("a@b.com");
  });

  it("runs validation and sets errors", async () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "" },
        validate: () => ({ email: "Required" }),
        onSubmit: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.email).toBe("Required");
  });

  it("clears error when field is updated", async () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "" },
        validate: () => ({ email: "Required" }),
        onSubmit: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.email).toBe("Required");
    act(() => result.current.setField("email", "a@b.com"));
    expect(result.current.errors.email).toBeUndefined();
  });

  it("validates a single field on blur", () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "" },
        validate: () => ({ email: "Invalid email" }),
        onSubmit: vi.fn(),
      }),
    );
    act(() => result.current.validateField("email"));
    expect(result.current.errors.email).toBe("Invalid email");
  });

  it("clears field error when validation passes on blur", () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: "" },
        validate: (v) => (v.email ? {} : { email: "Required" }),
        onSubmit: vi.fn(),
      }),
    );
    act(() => result.current.validateField("email"));
    expect(result.current.errors.email).toBe("Required");
    act(() => result.current.setField("email", "a@b.com"));
    act(() => result.current.validateField("email"));
    expect(result.current.errors.email).toBeUndefined();
  });

  it("calls onSubmit on valid submit", async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        initialValues: { name: "test" },
        onSubmit,
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: "test" });
  });
});