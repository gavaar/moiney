import { StyleSheet, View } from "react-native";
import { colors } from "@/lib/styles";

/** Each flag says whether that nested node has a following sibling; [] is a root. */
export type TreeBranchPath = readonly boolean[];

const indent = 32;
const railOffset = 16;

/** The gutter stretches with its row, so adjacent virtualized cells join without measurement. */
export function TreeBranch({ path, expanded = false }: { path: TreeBranchPath; expanded?: boolean }) {
  if (path.length === 0 && !expanded) return null;
  const width = path.length * indent;

  return <View
    pointerEvents="none"
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    aria-hidden
    style={[styles.gutter, { width }]}>
      {path.map((hasFollowingSibling, index) => {
        const last = index === path.length - 1;
        const left = index * indent + railOffset;

        return <View
          key={index}
          style={StyleSheet.absoluteFill}
        >
          {(last || hasFollowingSibling) && <View style={[styles.vertical, { left, top: 0, bottom: last && !hasFollowingSibling ? "50%" : 0 }]} />}
          {last && <View style={[styles.horizontal, { left, width: indent - railOffset }]} />}
        </View>;
      })}
      {expanded && <View style={[styles.vertical, { left: width + railOffset, top: "50%", marginTop: 8, bottom: 0 }]} />}
    </View>;
}

const styles = StyleSheet.create({
  gutter: { alignSelf: "stretch", flexShrink: 0 },
  vertical: { position: "absolute", borderLeftWidth: 1, borderColor: `${colors.text}40` },
  horizontal: { position: "absolute", top: "50%", borderTopWidth: 1, borderColor: `${colors.text}40` },
});
