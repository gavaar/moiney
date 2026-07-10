import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { InputText } from "@/components/InputText";
import { useAuth } from "@/lib/auth";
import { useRedirectOnAuth } from "@/lib/auth";
import { useForm } from "@/lib/forms";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { Link } from "expo-router";
import { useState } from "react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { markLoginAttempted } = useRedirectOnAuth();
  const { login } = useAuth();

  const { values, setField, errors, loading, handleSubmit } = useForm({
    initialValues: { username: "", password: "" },
    validate: (v) => {
      const e: Record<string, string> = {};
      if (!v.username) e.username = "Please fill in all fields";
      if (!v.password) e.password = "Please fill in all fields";
      return e;
    },
    onSubmit: async (v) => {
      markLoginAttempted();
      await login(v.username, v.password);
    },
  });

  return (
    <AuthScreenLayout
      title="Sign In"
      subtitle="Welcome back to moiney"
      footer={
        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-secondary">
            Don't have an account?
          </Text>
          <Link href="/sign-up" className="text-sm font-medium text-primary">
            Sign Up
          </Link>
        </View>
      }
    >
      <InputText
        label="Username"
        placeholder="Enter your username"
        value={values.username}
        onChangeText={(v) => setField("username", v)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <InputText
        label="Password"
        placeholder="Enter your password"
        value={values.password}
        onChangeText={(v) => setField("password", v)}
        secureTextEntry={!showPassword}
        endIcon={showPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowPassword((v) => !v)}
      />

      {errors.form ? <Text className="text-sm text-error">{errors.form}</Text> : null}

      <Button
        title="Sign In"
        loading={loading}
        disabled={!values.username || !values.password}
        onPress={handleSubmit}
      />
    </AuthScreenLayout>
  );
}