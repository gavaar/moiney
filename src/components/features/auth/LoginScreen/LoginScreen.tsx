import { Text, View } from "react-native";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { useAuth } from "@/lib/auth";
import { useForm } from "@/lib/forms";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { colors } from "@/lib/styles";
import { AuthScreenLayout } from "@features/auth/AuthScreenLayout";
import { MoineyVers } from "@features/app/AppScreenHeader";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, biometrics } = useAuth();
  const attemptedBiometrics = useRef(false);

  const { values, setField, errors, loading, handleSubmit } = useForm({
    initialValues: { username: "", password: "" },
    validate: (v) => {
      const e: Record<string, string> = {};
      if (!v.username) e.username = "Please fill in all fields";
      if (!v.password) e.password = "Please fill in all fields";
      return e;
    },
    onSubmit: async (v) => {
      attemptedBiometrics.current = true;
      await login(v.username, v.password);
    },
  });

  useEffect(() => {
    if (loading || biometrics.loading || biometrics.busy || !biometrics.available || !biometrics.enabled || attemptedBiometrics.current) return;
    attemptedBiometrics.current = true;
    void biometrics.login();
  }, [biometrics, loading]);

  return (
    <AuthScreenLayout
      title="Sign In"
      subtitle="Welcome back to moiney"
      footer={
        <View className="items-center">
          {!biometrics.busy && <Link
            href="/sign-up"
            replace
            style={{ color: colors.secondary }}
            className="text-sm font-medium"
          >
            Don&apos;t have an account? Sign Up
          </Link>}
          < MoineyVers />
        </View>
      }
    >
      <Input
        label="Username"
        placeholder="Enter your username"
        value={values.username}
        onChange={(v) => setField("username", v)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Input
        label="Password"
        placeholder="Enter your password"
        value={values.password}
        onChange={(v) => setField("password", v)}
        secureTextEntry={!showPassword}
        endIcon={showPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowPassword((v) => !v)}
      />

      {errors.form ? <Text className="text-sm text-error">{errors.form}</Text> : null}
      {biometrics.error ? <Text accessibilityRole="alert" className="text-sm text-error">{biometrics.error}</Text> : null}

      {biometrics.available && biometrics.enabled ? (
        <Button title="Use biometrics" loading={biometrics.busy} disabled={loading} onPress={() => void biometrics.login()} />
      ) : null}

      <Button
        title="Sign In"
        loading={loading}
        disabled={biometrics.busy || !values.username || !values.password}
        onPress={handleSubmit}
      />
    </AuthScreenLayout>
  );
}
