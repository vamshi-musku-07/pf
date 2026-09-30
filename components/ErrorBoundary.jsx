import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";

/**
 * Catches uncaught JS errors in the React tree below it and shows a
 * recovery UI instead of a blank/crashed screen.
 *
 * Usage — wrap major screen areas:
 *   <ErrorBoundary>
 *     <HeavyComponent />
 *   </ErrorBoundary>
 *
 * Props:
 *   fallback   — optional custom fallback element (replaces default UI)
 *   onError    — optional (error, info) => void callback for logging
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    SplashScreen.hideAsync().catch(() => {});
    const { onError } = this.props;
    if (onError) {
      try { onError(error, info); } catch { /* logging must not rethrow */ }
    } else {
      console.error("[ErrorBoundary]", error?.message, info?.componentStack);
    }
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) return children;

    if (fallback) return fallback;

    return (
      <View style={S.container}>
        <Ionicons name="warning-outline" size={48} color="#EF4444" />
        <Text style={S.title}>Something went wrong</Text>
        <Text style={S.message} numberOfLines={3}>
          {error?.message || "An unexpected error occurred."}
        </Text>
        <TouchableOpacity
          style={S.btn}
          onPress={this.reset}
          activeOpacity={0.8}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <Text style={S.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  message: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default ErrorBoundary;
