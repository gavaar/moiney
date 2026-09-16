import { Text, View } from "react-native";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { useAuth } from "@/lib/auth";
import { useForm } from "@/lib/forms";
import { useDebounce } from "@/lib/hooks";
import { Link } from "expo-router";
import { useState } from "react";
import { colors } from "@/lib/styles";
import { AuthScreenLayout } from "@features/auth/AuthScreenLayout";
import { MoineyVers } from "@features/app/AppScreenHeader";
import { useUsernameAvailability } from "@features/auth/data/auth";

const validateUsername = (value: string) => value.trim() ? undefined : "Username is required";
const validateEmail = (value: string) => !value ? "Email is required"
  : /\S+@\S+\.\S+/.test(value) ? undefined : "Invalid email";
const validatePassword = (value: string) => !value ? "Password is required"
  : value.length < 8 ? "Password must be at least 8 characters" : undefined;
const validateRepeatPassword = (value: string, password: string) =>
  value === password ? undefined : "Passwords do not match";

function validateSignUp(values: { username: string; email: string; password: string; repeatPassword: string }) {
  const errors: Record<string, string> = {};
  const results = {
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    repeatPassword: validateRepeatPassword(values.repeatPassword, values.password),
  };
  for (const [key, error] of Object.entries(results)) {
    if (error !== undefined) errors[key] = error;
  }
  return errors;
}

export function SignUpScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const { signUp } = useAuth();

  const { values, setField, errors, loading, handleSubmit } = useForm({
    initialValues: {
      username: "",
      email: "",
      password: "",
      repeatPassword: "",
    },
    validate: validateSignUp,
    onSubmit: async (v) => {
      await signUp(v.username, v.email, v.password);
    },
  });

  const debouncedUsername = useDebounce(values.username, 400);

  const usernameToCheck =
    debouncedUsername.trim().length >= 1 && !loading
      ? debouncedUsername
      : undefined;

  const usernameAvailable = useUsernameAvailability(usernameToCheck);

  let usernameStatus: "checking" | "available" | "unavailable" | undefined;
  if (usernameToCheck) {
    if (usernameAvailable === undefined) {
      usernameStatus = "checking";
    } else if (usernameAvailable) {
      usernameStatus = "available";
    } else {
      usernameStatus = "unavailable";
    }
  }

  const usernameValidator = (value: string) => validateUsername(value)
    ?? (usernameStatus === "unavailable" && value === debouncedUsername
      ? "Username is already taken" : undefined);

  const hasEmptyFields =
    !values.username.trim() ||
    !values.email ||
    !values.password ||
    !values.repeatPassword;
  const hasClientErrors = Object.keys(validateSignUp(values)).length > 0;
  const hasCurrentUsernameAvailability =
    values.username === debouncedUsername && usernameStatus === "available";
  const canSubmit =
    !hasEmptyFields && !hasClientErrors && hasCurrentUsernameAvailability && !loading;

  return (
    <AuthScreenLayout
      title="Create Account"
      subtitle="Start tracking your finances"
      footer={
        <View className="items-center">
          <Link
            href="/login"
            replace
            style={{ color: colors.secondary }}
            className="text-sm font-medium"
          >
            Already have an account? Sign In
          </Link>
          < MoineyVers />
        </View>
      }
    >
      <Input
        label="Username"
        placeholder="Choose a username"
        value={values.username}
        onChange={(v) => setField("username", v)}
        autoCapitalize="none"
        autoCorrect={false}
        validator={usernameValidator}
        status={values.username ? usernameStatus : undefined}
      />
      <Input
        label="Email"
        placeholder="Enter your email"
        value={values.email}
        onChange={(v) => setField("email", v)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        validator={validateEmail}
      />
      <Input
        label="Password"
        placeholder="At least 8 characters"
        value={values.password}
        onChange={(v) => setField("password", v)}
        secureTextEntry={!showPassword}
        endIcon={showPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowPassword((v) => !v)}
        validator={validatePassword}
      />
      <Input
        label="Repeat Password"
        placeholder="Confirm your password"
        value={values.repeatPassword}
        onChange={(v) => setField("repeatPassword", v)}
        secureTextEntry={!showRepeatPassword}
        endIcon={showRepeatPassword ? "eye-off" : "eye"}
        onEndIconPress={() => setShowRepeatPassword((v) => !v)}
        validator={value => validateRepeatPassword(value, values.password)}
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
