import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

/**
 * Skeleton shimmer — drop-in placeholder while content loads.
 *
 * Usage:
 *   <Skeleton width={200} height={20} borderRadius={6} />
 *   <Skeleton style={{ marginBottom: 8 }} />
 *
 * Compose with SkeletonTeamCard or SkeletonPlayerRow for consistent
 * placeholder shapes that match the real list items.
 */
export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style, isDark: isDarkProp }) {
  const { isDark: isDarkCtx } = useAppearance();
  const isDark = typeof isDarkProp === "boolean" ? isDarkProp : isDarkCtx;
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[
        S.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? "#2A2A2E" : "#E5E7EB",
        },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={
            isDark
              ? ["transparent", "rgba(255,255,255,0.12)", "transparent"]
              : ["transparent", "rgba(255,255,255,0.55)", "transparent"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Skeleton that matches the shape of a TeamCard in teams.jsx */
export function SkeletonTeamCard({ isDark: isDarkProp } = {}) {
  const { isDark: isDarkCtx } = useAppearance();
  const isDark = typeof isDarkProp === "boolean" ? isDarkProp : isDarkCtx;
  const T = getAppTheme(isDark);

  return (
    <View
      style={[
        S.card,
        {
          backgroundColor: T.surface,
          borderWidth: isDark ? 1 : 0,
          borderColor: T.border,
        },
      ]}
    >
      <Skeleton width={56} height={56} borderRadius={28} isDark={isDark} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={16} width="60%" borderRadius={6} isDark={isDark} />
        <Skeleton height={12} width="80%" borderRadius={6} isDark={isDark} />
        <Skeleton height={12} width="45%" borderRadius={6} isDark={isDark} />
      </View>
    </View>
  );
}

/** Skeleton that matches the shape of a player row */
export function SkeletonPlayerRow({ isDark: isDarkProp } = {}) {
  const { isDark: isDarkCtx } = useAppearance();
  const isDark = typeof isDarkProp === "boolean" ? isDarkProp : isDarkCtx;
  const T = getAppTheme(isDark);

  return (
    <View
      style={[
        S.playerRow,
        { borderBottomColor: isDark ? T.borderSubtle : "#F3F4F6" },
      ]}
    >
      <Skeleton width={40} height={40} borderRadius={20} isDark={isDark} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={14} width="55%" borderRadius={5} isDark={isDark} />
        <Skeleton height={11} width="35%" borderRadius={5} isDark={isDark} />
      </View>
    </View>
  );
}

/** Renders N skeleton team cards for the teams list */
export function SkeletonTeamList({ count = 5, isDark: isDarkProp }) {
  const { isDark: isDarkCtx } = useAppearance();
  const isDark = typeof isDarkProp === "boolean" ? isDarkProp : isDarkCtx;

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTeamCard key={i} isDark={isDark} />
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 12,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
});
