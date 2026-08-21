// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
  PipeCatalogProvider,
  usePipeCatalog,
} from "./PipeCatalogContext";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { pipes: { getPipes: {} } },
}));

function pipe(id: string, parentId?: string): Doc<"pipes"> {
  return {
    _id: id as Id<"pipes">,
    _creationTime: 0,
    userId: "user-1" as Id<"users">,
    parentId: parentId as Id<"pipes"> | undefined,
    name: id,
    icon: "pipe",
    priority: 0,
    capacity: 0,
    fed: 0,
    spent: 0,
  };
}

function CatalogConsumer() {
  const { allPipes, pipesById, childrenByParent, feeds, isLoading } = usePipeCatalog();
  return (
    <div>
      <span data-testid="loading">{isLoading ? "true" : "false"}</span>
      <span data-testid="all-count">{allPipes?.length ?? "undefined"}</span>
      <span data-testid="root-name">
        {pipesById?.["root" as Id<"pipes">]?.name}
      </span>
      <span data-testid="child-count">
        {childrenByParent.get("root" as Id<"pipes">)?.length ?? 0}
      </span>
      <span data-testid="feed-count">{feeds.length}</span>
    </div>
  );
}

describe("PipeCatalogProvider", () => {
  it("exposes normalized pipes and derived indexes without selection state", () => {
    mockUseQuery.mockReturnValue([pipe("root"), pipe("child", "root")]);

    render(
      <PipeCatalogProvider>
        <CatalogConsumer />
      </PipeCatalogProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("all-count").textContent).toBe("2");
    expect(screen.getByTestId("root-name").textContent).toBe("root");
    expect(screen.getByTestId("child-count").textContent).toBe("1");
    expect(screen.getByTestId("feed-count").textContent).toBe("1");
  });
});
