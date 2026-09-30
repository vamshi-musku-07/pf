import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useRef } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getAuthRedirectParams } from "@/lib/authRedirect";
import { goBackTo } from "@/lib/navigationBack";

// Step 1: Enter email
// Step 2: Enter OTP sent to email
// Step 3: Enter new password

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { forgotPassword, verifyPasswordResetOTP, resetPassword } = useBackendAuth();
  const authRedirectParams = getAuthRedirectParams(params.redirect);

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimerRef = useRef(null);

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

  const handleSendOTP = async () => {
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep(2);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Could not send reset code. Check your email and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    setLoading(true);
    try {
      await verifyPasswordResetOTP(email.trim(), otp.trim());
      setStep(3);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Invalid or expired code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setError("");
    try {
      await forgotPassword(email.trim());
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
  };

  const handleResetPassword = async () => {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim(), otp.trim(), password, confirmPassword);
      router.replace({
        pathname: "/(auth)/sign-in",
        params: authRedirectParams,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Could not reset password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const stepConfig = [
    { icon: "mail", title: "Forgot Password", subtitle: "Enter your email and we'll send a reset code." },
    { icon: "keypad-outline", title: "Check Your Email", subtitle: `We sent a 6-digit code to\n` },
    { icon: "lock-closed", title: "New Password", subtitle: "Choose a strong new password." },
  ];

  const current = stepConfig[step - 1];

  return (
    <KeyboardAwareScreen
      backgroundColor="#F5F7FA"
      horizontalPadding={24}
      centerWhenIdle={false}
    >
          <TouchableOpacity
            onPress={() => {
              if (step > 1) {
                setStep(step - 1);
                setError("");
              } else {
                goBackTo(router);
              }
            }}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
          >
            <Ionicons name="arrow-back" size={22} color="#6B7280" />
            <Text style={{ color: "#6B7280", marginLeft: 4, fontSize: 14 }}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#9AEA62",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              shadowColor: "#10B981",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}>
              <Ionicons name={current.icon} size={32} color="#161515" />
            </View>
            <Text style={{ color: "#1F2937", fontSize: 26, fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5 }}>
              {current.title}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 16 }}>
              {step === 2
                ? `We sent a 6-digit code to\n`
                : current.subtitle}
              {step === 2 && (
                <Text style={{ color: "#57ac1a", fontWeight: "bold" }}>{email}</Text>
              )}
            </Text>
          </View>

          {/* Step indicators */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 32, gap: 8 }}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={{
                width: s === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s === step ? "#9AEA62" : s < step ? "#57ac1a" : "#D1D5DB",
              }} />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View style={{ backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
              <Text style={{ color: "#DC2626", fontSize: 13, textAlign: "center" }}>{error}</Text>
            </View>
          ) : null}

          {/* Step 1: Email */}
          {step === 1 && (
            <>
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: "#4B5563", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                  Email
                </Text>
                <View style={inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, color: "#1F2937", fontSize: 15 }}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSendOTP}
                activeOpacity={0.8}
                disabled={loading || !email}
                style={[primaryBtn, { opacity: loading || !email ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#161515" />
                ) : (
                  <Text style={primaryBtnText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <>
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: "#4B5563", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                  Reset Code
                </Text>
                <View style={inputContainer}>
                  <Ionicons name="keypad-outline" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{ flex: 1, color: "#1F2937", fontSize: 15, letterSpacing: 8 }}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleVerifyOTP}
                activeOpacity={0.8}
                disabled={loading || otp.length < 6}
                style={[primaryBtn, { opacity: loading || otp.length < 6 ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#161515" />
                ) : (
                  <Text style={primaryBtnText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendLoading || resendCooldown > 0}
                style={{ alignItems: "center", marginTop: 16 }}
              >
                {resendLoading ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : resendCooldown > 0 ? (
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
                    Resend in <Text style={{ fontWeight: "bold" }}>{resendCooldown}s</Text>
                  </Text>
                ) : (
                  <Text style={{ color: "#6B7280", fontSize: 14 }}>
                    Didn't receive a code? <Text style={{ color: "#10B981", fontWeight: "bold" }}>Resend</Text>
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#4B5563", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                  New Password
                </Text>
                <View style={inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create new password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    style={{ flex: 1, color: "#1F2937", fontSize: 15 }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: "#4B5563", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                  Confirm Password
                </Text>
                <View style={inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirm}
                    style={{ flex: 1, color: "#1F2937", fontSize: 15 }}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={loading || !password || !confirmPassword}
                style={[primaryBtn, { opacity: loading || !password || !confirmPassword ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#161515" />
                ) : (
                  <Text style={primaryBtnText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}
    </KeyboardAwareScreen>
  );
}

const inputContainer = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#F9FAFB",
  borderRadius: 16,
  paddingHorizontal: 16,
  height: 56,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
  borderWidth: 1,
  borderColor: "#E5E7EB",
};

const primaryBtn = {
  backgroundColor: "#9AEA62",
  height: 56,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 16,
  shadowColor: "#172f06",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 6,
};

const primaryBtnText = {
  color: "#161515",
  fontWeight: "bold",
  fontSize: 16,
};
