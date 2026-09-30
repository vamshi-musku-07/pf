import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import {
  AuthDivider,
  AuthErrorBanner,
  AuthField,
  AuthFooterLink,
  AuthPasswordToggle,
  AuthPrimaryButton,
  AuthSheetHeader,
  AuthSocialRow,
  AUTH_LINK,
  AUTH_SHEET_RADIUS,
  getAuthCopy,
} from "@/components/auth/AuthScreenLayout";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import {
  getAuthRedirectParams,
  parseRedirectParam,
} from "@/lib/authRedirect";
import { showToast } from "@/context/ToastContext";
import useKeyboardInset from "@/hooks/useKeyboardInset";

/**
 * Login / Sign up — reference-style hero + rounded white sheet.
 */
export default function AuthCredentialsForm({ initialMode = "signIn" }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const {
    signInWithGoogle,
    signInWithEmail,
    register,
    verifyOTP,
    resendOTP,
  } = useBackendAuth();

  const [mode, setMode] = useState(initialMode === "signUp" ? "signUp" : "signIn");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimerRef = useRef(null);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const keyboardInset = useKeyboardInset();
  const keyboardVisible = keyboardInset > 0;
  const sheetLift = useRef(new Animated.Value(0)).current;

  const { signIn, isAvailable: googleSignInAvailable } = useGoogleAuth();
  const authRedirectParams = getAuthRedirectParams(params.redirect);
  const redirectTarget = useMemo(
    () => parseRedirectParam(params.redirect),
    [params.redirect],
  );

  useEffect(() => {
    Animated.timing(sheetLift, {
      toValue: keyboardVisible ? (mode === "signUp" ? -150 : -100) : 0,
      duration: keyboardVisible ? 280 : 220,
      easing: keyboardVisible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [keyboardVisible, mode, sheetLift]);

  const navigateAfterAuth = useCallback(() => {
    if (redirectTarget?.pathname) {
      router.replace({
        pathname: redirectTarget.pathname,
        params: redirectTarget.params,
      });
      return;
    }
    router.replace("/(tabs)");
  }, [redirectTarget, router]);

  const switchMode = useCallback(
    (next) => {
      if (next === mode) return;
      setError("");
      setPendingVerification(false);
      setCode("");
      setMode(next);
      if (next === "signIn") {
        router.replace({ pathname: "/(auth)/sign-in", params: authRedirectParams });
      } else {
        router.replace({ pathname: "/(auth)/sign-up", params: authRedirectParams });
      }
    },
    [authRedirectParams, mode, router],
  );

  const handleGoogle = useCallback(async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signIn();
      if (!result) return;
      await signInWithGoogle(result.googleIdToken);
      navigateAfterAuth();
    } catch (err) {
      const data = err?.response?.data;
      let msg;
      if (data?.errors?.length) {
        msg = data.errors.map((e) => e.message).join("\n");
      } else {
        msg =
          data?.message ||
          err?.message ||
          (mode === "signUp" ? "Google sign up failed. Try again." : "Google sign in failed. Try again.");
      }
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [mode, navigateAfterAuth, signIn, signInWithGoogle]);

  const handleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigateAfterAuth();
    } catch (err) {
      const data = err?.response?.data;
      let msg;
      if (data?.errors?.length) {
        msg = data.errors.map((e) => e.message).join("\n");
      } else {
        msg = data?.message || err?.message || "Invalid email or password.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      setPendingVerification(true);
    } catch (err) {
      const data = err?.response?.data;
      let msg;
      if (data?.errors?.length) {
        msg = data.errors.map((e) => e.message).join("\n");
      } else {
        msg = data?.message || err?.message || "Could not create account. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const startCooldown = (seconds) => {
    setResendCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await verifyOTP(email.trim(), code.trim());
      navigateAfterAuth();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid verification code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onComingSoon = (provider) => {
    try {
      showToast(`${provider} login coming soon`, "info");
    } catch {
      Alert.alert("Coming soon", `${provider} login will be available soon.`);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAwareScreen
        backgroundColor="#EEF0FA"
        edges={["top", "bottom"]}
        horizontalPadding={20}
        centerWhenIdle={false}
        bottomOffset={40}
        keyboardDismissMode="none"
      >
        <View
          style={{
            marginTop: 24,
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            padding: 22,
            maxWidth: 420,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setPendingVerification(false);
              setCode("");
              setError("");
            }}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
          >
            <Ionicons name="arrow-back" size={22} color="#6B7280" />
            <Text style={{ color: "#6B7280", marginLeft: 4, fontSize: 14, fontWeight: "600" }}>
              Back
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: "#111827",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Verify email
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            We sent a 6-digit code to{"\n"}
            <Text style={{ color: AUTH_LINK, fontWeight: "700" }}>{email}</Text>
          </Text>

          <AuthErrorBanner message={error} />

          <AuthField
            icon="keypad-outline"
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
          />

          <AuthPrimaryButton
            label="Verify Email"
            onPress={handleVerify}
            disabled={code.length < 6}
            loading={loading}
          />

          <TouchableOpacity
            onPress={async () => {
              if (resendLoading || resendCooldown > 0) return;
              setResendLoading(true);
              setError("");
              try {
                await resendOTP(email.trim());
                startCooldown(60);
              } catch (err) {
                const retryAfter = err?.response?.data?.retryAfter;
                if (retryAfter) {
                  startCooldown(retryAfter);
                } else {
                  setError("Could not resend code. Try again later.");
                }
              } finally {
                setResendLoading(false);
              }
            }}
            style={{ alignItems: "center", marginTop: 22 }}
            disabled={resendLoading || resendCooldown > 0}
          >
            {resendLoading ? (
              <Text style={{ color: AUTH_LINK, fontWeight: "700" }}>Sending…</Text>
            ) : resendCooldown > 0 ? (
              <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
                Resend in <Text style={{ fontWeight: "800" }}>{resendCooldown}s</Text>
              </Text>
            ) : (
              <Text style={{ fontSize: 14, color: "#6B7280" }}>
                Didn&apos;t receive a code?{" "}
                <Text style={{ color: AUTH_LINK, fontWeight: "800" }}>Resend</Text>
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScreen>
    );
  } 

  const isSignIn = mode === "signIn";
  const copy = getAuthCopy(mode);
  const primaryDisabled = isSignIn
    ? !email || !password
    : !email || !password || !username;

  return (
    <ImageBackground
      source={require("@/assets/images/auth-background-court.png")}
      resizeMode="stretch"
      style={{ flex: 1, backgroundColor: "#0F4F59" }}
      imageStyle={{ width: "100%", height: "100%" }}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <KeyboardAwareScreen
        backgroundColor="transparent"
        edges={["bottom"]}
        horizontalPadding={0}
        centerWhenIdle={false}
        bottomOffset={28}
        keyboardDismissMode="none"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 0 }}
      >
        <View
          style={{
            height: 150 + insets.top,
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 12,
          }}
        >
          <View
            style={{
              width: 240,
              height: 78,
            }}
          >
            <Image
              source={require("@/assets/logos/applogo.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
        </View>

        <Animated.View
          style={{
            flex: 1,
            marginTop: 0,
            marginHorizontal: 8,
            marginBottom: 12,
            backgroundColor: "#FFFFFF",
            borderRadius: AUTH_SHEET_RADIUS,
            paddingHorizontal: 24,
            paddingTop: 22,
            paddingBottom: Math.max(insets.bottom, 20),
            minHeight: 620,
            shadowColor: "#111827",
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.12,
            shadowRadius: 14,
            elevation: 12,
            transform: [{ translateY: sheetLift }],
          }}
        >
          <View style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>
            <AuthSheetHeader mode={mode} />
            <AuthErrorBanner message={error} />

            {!isSignIn ? (
              <AuthField
                icon="person-outline"
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            <AuthField
              iconText="@"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <AuthField
              icon="shield-checkmark-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
              rightElement={
                <AuthPasswordToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />

            {isSignIn ? (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/forgot-password",
                    params: authRedirectParams,
                  })
                }
                style={{ alignSelf: "flex-end", marginTop: 2, marginBottom: 4 }}
              >
                <Text style={{ color: AUTH_LINK, fontWeight: "600", fontSize: 13 }}>
                  Forget password?
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ height: 8 }} />
            )}

            <AuthPrimaryButton
              label={copy.primaryLabel}
              onPress={isSignIn ? handleSignIn : handleSignUp}
              disabled={primaryDisabled}
              loading={loading}
            />

            <AuthFooterLink
              mode={mode}
              onPress={() => switchMode(isSignIn ? "signUp" : "signIn")}
            />

            <AuthDivider />

            <AuthSocialRow
              onGoogle={handleGoogle}
              googleLoading={googleLoading}
              googleAvailable={googleSignInAvailable}
              onComingSoon={onComingSoon}
            />
          </View>
        </Animated.View>
      </KeyboardAwareScreen>
    </ImageBackground>
  );
}
