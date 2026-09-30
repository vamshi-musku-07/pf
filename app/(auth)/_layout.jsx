import { Stack } from "expo-router";

/**
 * Auth layout — simple stack for auth screens.
 * Sign In / Create Account switch in-place on the credentials screen (no slide).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Stack.Screen name="sign-in" options={{ animation: "none" }} />
      <Stack.Screen name="sign-up" options={{ animation: "none" }} />
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="forgot-password" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
