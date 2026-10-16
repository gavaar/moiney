import { useState } from "react";
import { expo } from "@/../app.json";
import { Button } from "@ui/Button";
import { ReleaseNotesModal } from "./ReleaseNotes/ReleaseNotesModal";

export function ProfileChangesButton() {
  const [showChanges, setShowChanges] = useState(false);
  return <>
    <Button title={`${expo.version} changes`} variant="muted" onPress={() => setShowChanges(true)} />
    {showChanges ? <ReleaseNotesModal version={expo.version} onClose={() => setShowChanges(false)} /> : null}
  </>;
}
