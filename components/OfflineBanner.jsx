/**
 * OfflineBanner — slides in from the top when the device loses internet.
 * Uses fetch-based connectivity probing — no external packages required.
 */
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOnline ? -80 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [isOnline]);

  return (
    <Animated.View
      style={[
        S.banner,
        { paddingTop: insets.top + 6, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityLabel="You are offline. Check your internet connection."
      accessibilityRole="alert"
    >
      <View style={S.inner}>
        <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
        <Text style={S.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#EF4444",
    zIndex: 9998,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  text: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});
