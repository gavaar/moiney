// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CurrentMonthReportProvider, useCurrentMonthReportContext } from "./CurrentMonthReportContext";

const mocks = vi.hoisted(() => ({
  sessions: 0,
  args: [] as unknown[],
  results: [{
    summary: { totalIncomeCents: 0, grossSpendingCents: 700, refundCents: 0, spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 700 },
    pipeSpending: [], titleSpending: [],
  }],
  allPipes: [{ id: "root", name: "Root", fed: 1_000, spent: 0, capacity: 0 }],
}));

vi.mock("@convex/_generated/api", () => ({ api: { monthlySpendingStats: { eventMonthPage: "eventMonthPage" } } }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: mocks.allPipes }) }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    useState(() => { mocks.sessions += 1; });
    mocks.args.push(args);
    return { results: mocks.results, status: "Exhausted", loadMore: vi.fn() };
  },
}));

function ReportConsumer({ location }: { location: "pipes" | "history" | "detail" }) {
  const { report } = useCurrentMonthReportContext();
  return location === "history" ? <div>History</div> : <div>{location}: {report?.grossSpendingCents} / {report?.volumeCents}</div>;
}

it("shares one live subscription across pipe, history, and detail navigation while remaining reactive", () => {
  mocks.sessions = 0;
  mocks.args = [];
  const view = (location: "pipes" | "history" | "detail") => (
    <CurrentMonthReportProvider><ReportConsumer location={location} /></CurrentMonthReportProvider>
  );
  const { rerender } = render(view("pipes"));
  expect(screen.getByText("pipes: 700 / 1000")).toBeDefined();

  rerender(view("history"));
  expect(screen.getByText("History")).toBeDefined();
  rerender(view("detail"));
  expect(screen.getByText("detail: 700 / 1000")).toBeDefined();
  rerender(view("pipes"));
  expect(screen.getByText("pipes: 700 / 1000")).toBeDefined();
  expect(mocks.sessions).toBe(1);
  expect(mocks.args.every((args) => JSON.stringify(args) === JSON.stringify(mocks.args[0]))).toBe(true);

  mocks.results = [{ ...mocks.results[0], summary: { ...mocks.results[0].summary, grossSpendingCents: 900 } }];
  mocks.allPipes = [{ ...mocks.allPipes[0], fed: 1_200 }];
  rerender(view("pipes"));
  expect(screen.getByText("pipes: 900 / 1200")).toBeDefined();
  expect(mocks.sessions).toBe(1);
});
