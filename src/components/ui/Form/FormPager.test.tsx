// @vitest-environment jsdom
import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormPager } from "./FormPager";

// Model the native boundary: scrollTo is clamped until content has been laid out.
const native = vi.hoisted(() => ({
  props: {} as Record<string, any>, width: 0, contentWidth: 0, offset: 0,
  pages: {} as Record<string, any>,
}));
vi.mock("react-native", async importOriginal => {
  const actual = await importOriginal<typeof import("react-native")>();
  const React = await import("react");
  return {
    ...actual,
    View: ({ children, ...props }: any) => {
      if (typeof children === "string" && props.onLayout) native.pages[children] = props;
      return <actual.View {...props}>{children}</actual.View>;
    },
    ScrollView: ({ ref, children, ...props }: any) => {
      if (props.horizontal) native.props = props;
      else if (typeof children === "string") native.pages[children] = props;
      React.useImperativeHandle(ref, () => ({
        scrollTo: ({ x }: { x: number }) => {
          if (!props.horizontal) return;
          native.offset = Math.min(x, Math.max(0, native.contentWidth - native.width));
          props.onScroll?.({ nativeEvent: { layoutMeasurement: { width: native.width }, contentOffset: { x: native.offset } } });
        },
      }));
      return <div>{children}</div>;
    },
  };
});

const pages = [
  { key: 0, content: "Choose pipe", hasError: false },
  { key: 1, content: "Transaction details", hasError: false },
];

function RepeatPager() {
  const [step, setStep] = useState(1);
  return <><span>Active step: {step + 1}</span><FormPager pages={pages} activeStep={step} onStepChange={setStep} /></>;
}

describe("FormPager native positioning", () => {
  beforeEach(() => { native.width = 0; native.contentWidth = 0; native.offset = 0; native.pages = {}; });

  it("keeps the requested initial step while content is unmeasured, then positions it when content becomes ready", () => {
    render(<RepeatPager />);
    act(() => {
      native.width = 320;
      native.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });
    expect(screen.getByText("Active step: 2")).toBeTruthy();
    act(() => {
      native.contentWidth = 640;
      native.props.onContentSizeChange?.(640, 300);
    });
    expect(native.offset).toBe(320);
    expect(screen.getByText("Active step: 2")).toBeTruthy();

    act(() => {
      native.props.onScrollBeginDrag();
      native.props.onScroll({ nativeEvent: { layoutMeasurement: { width: 320 }, contentOffset: { x: 0 } } });
    });
    expect(screen.getByText("Active step: 1")).toBeTruthy();
  });

  it("sizes to the active page, follows content changes, and ignores taller inactive pages", () => {
    const { rerender } = render(<FormPager pages={pages} activeStep={1} onStepChange={() => {}} />);
    act(() => {
      native.width = 320;
      native.contentWidth = 640;
      native.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });
    act(() => {
      native.pages["Choose pipe"].onContentSizeChange?.(320, 420);
      native.pages["Transaction details"].onContentSizeChange?.(320, 180);
    });
    expect(native.props.style.height).toBe(180);
    act(() => native.pages["Transaction details"].onContentSizeChange?.(320, 240));
    expect(native.props.style.height).toBe(240);
    act(() => native.pages["Choose pipe"].onContentSizeChange?.(320, 500));
    expect(native.props.style.height).toBe(240);
    rerender(<FormPager pages={pages} activeStep={0} onStepChange={() => {}} />);
    expect(native.props.style.height).toBe(500);
    rerender(<FormPager pages={pages} activeStep={1} onStepChange={() => {}} />);
    act(() => native.pages["Transaction details"].onContentSizeChange?.(320, 160));
    expect(native.props.style.height).toBe(160);

    rerender(<FormPager pages={pages} activeStep={1} onStepChange={() => {}} fill />);
    expect(native.props.style.height).toBeUndefined();
    expect(native.props.style.flexGrow).toBe(1);
  });

  it("measures inline-list steps and discards measurements taken at a previous width", () => {
    const inlinePages = [{ ...pages[0], scrollable: false }, pages[1]];
    const { rerender } = render(<FormPager pages={inlinePages} activeStep={0} onStepChange={() => {}} />);
    act(() => {
      native.width = 320;
      native.contentWidth = 640;
      native.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });
    act(() => {
      native.pages["Choose pipe"].onLayout({ nativeEvent: { layout: { height: 328 } } });
      native.pages["Transaction details"].onContentSizeChange(320, 200);
    });
    expect(native.props.style.height).toBe(328);
    rerender(<FormPager pages={inlinePages} activeStep={1} onStepChange={() => {}} />);
    expect(native.props.style.height).toBe(200);
    act(() => native.pages["Choose pipe"].onLayout({ nativeEvent: { layout: { height: 120 } } }));
    expect(native.props.style.height).toBe(200);
    rerender(<FormPager pages={inlinePages} activeStep={0} onStepChange={() => {}} />);
    expect(native.props.style.height).toBe(120);
    act(() => {
      native.width = 240;
      native.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
    });
    expect(native.props.style.height).toBeUndefined();
    act(() => native.pages["Choose pipe"].onLayout({ nativeEvent: { layout: { height: 160 } } }));
    expect(native.props.style.height).toBe(160);
  });
});
