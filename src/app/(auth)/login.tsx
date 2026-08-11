import { Text, View } from "react-native";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { useAuth } from "@/lib/auth";
import { useForm } from "@/lib/forms";
import { AuthScreenLayout } from "@ui/AuthScreenLayout";
import { Link } from "expo-router";
import { useState } from "react";
import { colors } from "@/lib/styles";
import { MoineyVers } from '@features/components/MoineyVers';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
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
      await login(v.username, v.password);
    },
  });

  return (
    <AuthScreenLayout
      title="Sign In"
      subtitle="Welcome back to moiney"
      footer={
        <View className="items-center">
          <Link
            href="/sign-up"
            replace
            style={{ color: colors.secondary }}
            className="text-sm font-medium"
          >
            Don't have an account? Sign Up
          </Link>
          < MoineyVers />
        </View>
      }
    >
      <Input
        label="Username"
        placeholder="Enter your username"
        value={values.username}
        onChangeText={(v) => setField("username", v)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Input
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
