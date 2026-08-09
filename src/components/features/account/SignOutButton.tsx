import { useState } from "react";
import { Button } from "@ui/Button";
import { useAuth } from "@/lib/auth";

type Props = {
  onSignedOut: () => void;
};

export function SignOutButton({ onSignedOut }: Props) {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
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
      title="Sign Out"
      variant="error"
      loading={loading}
      disabled={loading}
      testID="sign-out-button"
      onPress={handlePress}
    />
  );
}