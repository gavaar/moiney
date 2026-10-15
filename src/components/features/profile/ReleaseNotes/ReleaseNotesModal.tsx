import { useEffect, useState } from "react";
import { Linking, ScrollView, Text } from "react-native";
import Markdown, { MarkdownIt, type RenderRules } from "react-native-markdown-display";
import { Button } from "@ui/Button";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";
import { loadReleaseNotes } from "./releaseNotes";

type NotesState = { status: "loading" } | { status: "error" } | { status: "ready"; notes: string | null };
const markdown = new MarkdownIt({ html: true });
const styles = {
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  heading1: { fontSize: 24, lineHeight: 30 },
  heading2: { fontSize: 20, lineHeight: 26 },
  heading3: { fontSize: 18, lineHeight: 24 },
  link: { color: colors.secondary, textDecorationLine: "underline" as const },
  code_inline: { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
  code_block: { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
  fence: { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
  blockquote: { backgroundColor: colors.background, borderColor: colors.primary },
};

export function ReleaseNotesModal({ version, onClose }: { version: string; onClose: () => void }) {
  const [state, setState] = useState<NotesState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadReleaseNotes(version).then(
      (notes) => { if (active) setState({ status: "ready", notes }); },
      () => { if (active) setState({ status: "error" }); },
    );
    return () => { active = false; };
  }, [version, attempt]);

  const openLink = (href: string) => {
    setLinkFailed(false);
    try {
      const url = new URL(href, `https://github.com/gavaar/moiney/releases/tag/${encodeURIComponent(version)}`);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported link");
      void Linking.openURL(url.href).catch(() => setLinkFailed(true));
    } catch {
      setLinkFailed(true);
    }
  };
  const rules: RenderRules = {
    image: () => null,
    html_inline: () => null,
    html_block: () => null,
    link: (node, children, _parents, linkStyles) => (
      <Text key={node.key} accessibilityRole="link" style={linkStyles.link} onPress={() => openLink(node.attributes.href)}>{children}</Text>
    ),
  };

  return (
    <ModalShell visible onClose={onClose}>
      <ScrollView contentContainerClassName="gap-4" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text accessibilityRole="header" className="text-lg font-bold text-text">{version} changes</Text>
        {state.status === "loading" ? <Text accessibilityLiveRegion="polite" className="text-base text-muted">Loading changes…</Text> : null}
        {state.status === "error" ? <>
          <Text accessibilityRole="alert" className="text-base text-error">Could not load changes. Check your connection and try again.</Text>
          <Button title="Retry" variant="muted" onPress={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }} />
        </> : null}
        {state.status === "ready" ? state.notes !== null
          ? <Markdown markdownit={markdown} style={styles} rules={rules}>{state.notes}</Markdown>
          : <Text className="text-base text-muted">Release notes aren’t available for {version}.</Text>
          : null}
        {linkFailed ? <Text accessibilityRole="alert" className="text-base text-error">Could not open the link. Please try again.</Text> : null}
      </ScrollView>
    </ModalShell>
  );
}
