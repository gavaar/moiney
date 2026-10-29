// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "../data/pipes";
import { TreeRow } from "../PipeTreeView/TreeRow";
import { PipeBox } from "./PipeBox";
import { MiniChildBox } from "./PipeBox/components/MiniChildBox";
import { MinimizedPipe } from "./PipesList/MinimizedPipe";

const pipe: PipeModel = {
  id: "pipe" as Id<"pipes">,
  name: "Budget",
  icon: "unknown-server-icon",
  capacity: 100,
  fed: 100,
  spent: 0,
  priority: 0,
};

it.each([
  { name: "tree row", content: <TreeRow row={{ id: pipe.id, depth: 0, prefix: "", pipe, groupMax: 100, path: [pipe.id], isLeaf: true }} onPress={() => {}} /> },
  { name: "pipe card", content: <PipeBox {...pipe} showPriority={false} /> },
  { name: "child snapshot", content: <MiniChildBox {...pipe} /> },
  { name: "minimized tile", content: <MinimizedPipe pipe={pipe} onPress={() => {}} onLongPress={() => {}} /> },
])("renders a safe fallback for an unknown icon in a $name", ({ content }) => {
  render(content);
  expect(screen.getByTestId("mock-icon").getAttribute("name")).toBe("pipe");
});
