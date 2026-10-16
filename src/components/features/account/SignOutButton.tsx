import { useEffect, useState } from "react";
import { Button } from "@ui/Button";
import { useAuth } from "@/lib/auth";

type Props = {
  onSignedOut: () => void;
};

export function SignOutButton({ onSignedOut }: Props) {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  const handlePress = async () => {
    if (loading) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setLoading(true);
    try {
      await signOut();
      onSignedOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      title={confirming ? "confirm?" : "Sign out"}
      variant="error"
      loading={loading}
      disabled={loading}
      testID="sign-out-button"
      onPress={handlePress}
    />
  );
}
