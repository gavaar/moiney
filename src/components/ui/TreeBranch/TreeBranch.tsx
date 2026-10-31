import { Text } from "react-native";

/** Each flag says whether that nested node has a following sibling; [] is a root. */
export type TreeBranchPath = readonly boolean[];

export function TreeBranch({ path }: { path: TreeBranchPath }) {
  if (path.length === 0) return null;
  const ancestors = path.slice(0, -1).map(hasFollowingSibling => hasFollowingSibling ? "│   " : "    ").join("");
  const prefix = `${ancestors}${path[path.length - 1] ? "├── " : "└── "}`;
  return <Text
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    aria-hidden
    className="text-text/25 font-mono text-xs mr-1 shrink-0">
      {prefix}
    </Text>;
}
