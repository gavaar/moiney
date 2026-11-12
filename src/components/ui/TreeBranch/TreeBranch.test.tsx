// @vitest-environment jsdom
import { isInaccessible, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { TreeBranch, type TreeBranchPath } from ".";

it("omits connectors for an unexpanded root", () => {
  const { container } = render(<TreeBranch path={[]} />);
  expect(container.childNodes).toHaveLength(0);
});

it.each<{ path: TreeBranchPath; expanded: boolean }>([
  { path: [], expanded: true },
  { path: [true], expanded: false },
  { path: [false], expanded: true },
  { path: [true, true], expanded: true },
  { path: [true, false], expanded: false },
  { path: [false, true], expanded: false },
  { path: [false, false], expanded: false },
  { path: [true, false, true], expanded: true },
])("hides decorative connectors from accessibility for $path (expanded: $expanded)", ({ path, expanded }) => {
  const { container } = render(<TreeBranch path={path} expanded={expanded} />);
  const decoration = container.firstElementChild;
  expect(decoration && isInaccessible(decoration)).toBe(true);
});
