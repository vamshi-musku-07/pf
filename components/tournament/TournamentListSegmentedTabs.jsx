import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";

export const TOURNAMENT_LIST_TABS = [
  { id: "mine", label: "Mine", icon: "shield-outline", activeIcon: "shield" },
  { id: "applied", label: "Applied", icon: "paper-plane-outline", activeIcon: "paper-plane" },
  { id: "browse", label: "Browse", icon: "compass-outline", activeIcon: "compass" },
];

const SPRING = { damping: 20, stiffness: 260, mass: 0.8 };

function TabItem({ tab, active, onPress, badge, isDark }) {
  const progress = useSharedValue(active ? 1 : 0);
  const inactiveLabel = isDark ? "#A1A1AA" : "#64748B";
  const inactiveIcon = isDark ? "#A1A1AA" : "#94A3B8";

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, SPRING);
  }, [active, progress]);

  const labelStyle = useAnimatedStyle(
    () => ({
      color: interpolateColor(progress.value, [0, 1], [inactiveLabel, "#BAF072"]),
    }),
    [inactiveLabel],
  );

  const iconColor = active ? "#BAF072" : inactiveIcon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.88 : 1,
      })}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={active ? tab.activeIcon : tab.icon} size={17} color={iconColor} />
        <Animated.Text style={[{ fontSize: 13, fontWeight: "800", letterSpacing: 0.2 }, labelStyle]}>
          {tab.label}
        </Animated.Text>
        {badge > 0 ? (
          <View
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 5,
              backgroundColor: active ? "#BAF072" : "#F59E0B",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "900",
                color: active ? "#0B1324" : "#fff",
              }}
            >
              {badge > 9 ? "9+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function TournamentListSegmentedTabs({
  activeTab,
  onChange,
  appliedPending = 0,
  isDark = false,
  T,
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    TOURNAMENT_LIST_TABS.findIndex((tab) => tab.id === activeTab),
  );
  const indicatorX = useSharedValue(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - 8) / TOURNAMENT_LIST_TABS.length : 0;

  useEffect(() => {
    if (segmentWidth > 0) {
      indicatorX.value = withSpring(activeIndex * segmentWidth, SPRING);
    }
  }, [activeIndex, segmentWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: indicatorX.value }],
  }));

  const handlePress = (tabId) => {
    if (tabId === activeTab) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onChange(tabId);
  };

  return (
    <View
      style={{
        paddingHorizontal: 16,
        marginTop: -20,
        marginBottom: 6,
        zIndex: 20,
      }}
    >
      <View
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{
          backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "#FFFFFF",
          borderRadius: 18,
          padding: 4,
          flexDirection: "row",
          position: "relative",
          borderWidth: 1,
          borderColor: isDark ? T?.border || "#2A2A2E" : "rgba(15,23,42,0.06)",
          ...Platform.select({
            ios: {
              shadowColor: "#0B1324",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.35 : 0.14,
              shadowRadius: 20,
            },
            android: { elevation: isDark ? 4 : 8 },
            default: {},
          }),
        }}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              indicatorStyle,
              {
                position: "absolute",
                top: 4,
                left: 4,
                bottom: 4,
                backgroundColor: isDark ? "#16161A" : "#0B1324",
                borderRadius: 14,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? "#2A2A2E" : "transparent",
              },
            ]}
          />
        ) : null}

        {TOURNAMENT_LIST_TABS.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            badge={tab.id === "applied" ? appliedPending : 0}
            onPress={() => handlePress(tab.id)}
            isDark={isDark}
          />
        ))}
      </View>
    </View>
  );
}
