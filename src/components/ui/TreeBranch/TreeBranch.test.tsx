// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TreeBranch, type TreeBranchPath } from ".";

it.each<{ path: TreeBranchPath; expected: string }>([
  { path: [], expected: "" },
  { path: [true], expected: "├── " },
  { path: [false], expected: "└── " },
  { path: [true, true], expected: "│   ├── " },
  { path: [true, false], expected: "│   └── " },
  { path: [false, true], expected: "    ├── " },
  { path: [false, false], expected: "    └── " },
  { path: [true, false, true], expected: "│       ├── " },
])("renders the decorative branch for $path", ({ path, expected }) => {
  const { container } = render(<TreeBranch path={path} />);
  expect(container.textContent).toBe(expected);
  if (expected) expect(screen.getByText(/[├└]/).getAttribute("aria-hidden")).toBe("true");
  else expect(container.childNodes).toHaveLength(0);
});
