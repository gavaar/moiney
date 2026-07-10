import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/Button";
import { InputText } from "@/components/InputText";
import { useAuth } from "@/lib/auth";
import { useRedirectOnAuth } from "@/lib/auth";
import { useForm } from "@/lib/forms";
import { useDebounce } from "@/lib/hooks";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { Link } from "expo-router";
import { useState } from "react";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const { markLoginAttempted } = useRedirectOnAuth();
  const { signUp } = useAuth();

  const { values, setField, errors, loading, handleSubmit, validateField } = useForm({
    initialValues: {
      username: "",
      email: "",
      password: "",
      repeatPassword: "",
    },
    validate: (v) => {
      const e: Record<string, string> = {};
      if (!v.username) e.username = "Username is required";
      if (!v.email) e.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(v.email)) e.email = "Invalid email";
      if (!v.password) e.password = "Password is required";
      else if (v.password.length < 8)
        e.password = "Password must be at least 8 characters";
      if (v.password !== v.repeatPassword)
        e.repeatPassword = "Passwords do not match";
      return e;
    },
    onSubmit: async (v) => {
      markLoginAttempted();
      await signUp(v.username, v.email, v.password);
    },
  });

  const debouncedUsername = useDebounce(values.username, 400);

  const usernameToCheck =
    debouncedUsername.length >= 1 && !loading ? debouncedUsername : undefined;

  const existingUser = useQuery(
    api.accounts.getUserByUsername,
    usernameToCheck ? { username: usernameToCheck } : "skip",
  );

  let usernameStatus: "checking" | "available" | "unavailable" | undefined;
  if (usernameToCheck) {
    if (existingUser === undefined) {
      usernameStatus = "checking";
    } else if (existingUser !== null) {
      usernameStatus = "unavailable";
    } else {
      usernameStatus = "available";
    }
  }

  const showAsyncError =
    usernameStatus === "unavailable" && values.username === debouncedUsername;
  const asyncUsernameError = showAsyncError
    ? "Username is already taken"
    : undefined;
  const usernameError = errors.username || asyncUsernameError;

  const hasEmptyFields =
    !values.username ||
    !values.email ||
    !values.password ||
    !values.repeatPassword;
  const { form: _formError, ...fieldErrors } = errors;
  const hasClientErrors = Object.keys(fieldErrors).length > 0;
  const isUsernameBlocked =
    usernameStatus === "checking" || usernameStatus === "unavailable";
  const canSubmit =
    !hasEmptyFields && !hasClientErrors && !isUsernameBlocked && !loading;

  return (
    <AuthScreenLayout
      title="Create Account"
      subtitle="Start tracking your finances"
      footer={
        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-secondary">
            Already have an account?
          </Text>
          <Link href="/login" replace className="text-sm font-medium text-primary">
            Sign In
          </Link>
        </View>
      }
    >
      <InputText
        label="Username"
        placeholder="Choose a username"
        value={values.username}
        onChangeText={(v) => setField("username", v)}
        autoCapitalize="none"
        autoCorrect={false}
        error={usernameError}
        status={values.username ? usernameStatus : undefined}
      />
      <InputText
        label="Email"
        placeholder="Enter your email"
        value={values.email}
        onChangeText={(v) => setField("email", v)}
        onBlur={() => validateField("email")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        error={errors.email}
      />
      <InputText
        label="Password"
        placeholder="At least 8 characters"
        value={values.password}
        onChangeText={(v) => setField("password", v)}
        onBlur={() => validateField("password")}
        secureTextEntry={!showPassword}
        endIcon={showPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowPassword((v) => !v)}
        error={errors.password}
      />
      <InputText
        label="Repeat Password"
        placeholder="Confirm your password"
        value={values.repeatPassword}
        onChangeText={(v) => setField("repeatPassword", v)}
        onBlur={() => validateField("repeatPassword")}
        secureTextEntry={!showRepeatPassword}
        endIcon={showRepeatPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowRepeatPassword((v) => !v)}
        error={errors.repeatPassword}
      />

      {errors.form ? (
        <Text className="text-sm text-error">{errors.form}</Text>
      ) : null}

      <Button
        title="Create Account"
        loading={loading}
        disabled={!canSubmit}
        onPress={handleSubmit}
      />
    </AuthScreenLayout>
  );
}
