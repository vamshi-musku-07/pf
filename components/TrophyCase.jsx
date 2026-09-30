import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polygon, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { BACK_TO_PROFILE } from "@/lib/navigationBack";
import { BADGE_IMAGES } from "@/lib/badgeImages";
import { TROPHY_CASE_FEATURED_IDS, BADGE_BY_ID } from "@/lib/achievementBadges";
import { useAchievements } from "@/hooks/useAchievements";

/**
 * Locked hexagon badge — small lock + soft glow border (dark + light).
 */
export function LockedTrophyBadge({ size = 72, isDark }) {
  const pad = size * 0.12;
  const vb = size + pad * 2;
  const points = useMemo(() => {
    const cx = vb / 2;
    const cy = vb / 2;
    const r = size / 2 - 1;
    return [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const a = ((Math.PI * 2) / 6) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(" ");
  }, [size, vb]);

  const fill = isDark ? "rgba(55,55,55,0.72)" : "rgba(220,220,224,0.85)";
  const edge = isDark ? "rgba(220,220,220,0.95)" : "rgba(90,90,95,0.75)";
  const glow = isDark ? "#FFFFFF" : "#6B6B70";
  const lock = isDark ? "#FFFFFF" : "#2F2F33";

  const s = size * 0.11;
  const lx = vb / 2;
  const ly = vb / 2 + s * 0.15;
  const strokeW = Math.max(1.4, size * 0.022);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: isDark ? "#FFFFFF" : "#000000",
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: isDark ? 8 : 5,
        shadowOffset: { width: 0, height: 0 },
        elevation: isDark ? 6 : 2,
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        <Polygon
          points={points}
          fill="none"
          stroke={glow}
          strokeWidth={size * 0.09}
          strokeOpacity={isDark ? 0.12 : 0.1}
        />
        <Polygon
          points={points}
          fill="none"
          stroke={glow}
          strokeWidth={size * 0.05}
          strokeOpacity={isDark ? 0.22 : 0.16}
        />
        <Polygon
          points={points}
          fill="none"
          stroke={glow}
          strokeWidth={size * 0.025}
          strokeOpacity={isDark ? 0.4 : 0.28}
        />
        <Polygon points={points} fill={fill} stroke={edge} strokeWidth={1.4} />
        <Path
          d={`M ${lx - s * 0.55} ${ly - s * 0.15}
              V ${ly - s * 0.85}
              Q ${lx - s * 0.55} ${ly - s * 1.45} ${lx} ${ly - s * 1.45}
              Q ${lx + s * 0.55} ${ly - s * 1.45} ${lx + s * 0.55} ${ly - s * 0.85}
              V ${ly - s * 0.15}`}
          stroke={lock}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={`M ${lx - s * 0.78} ${ly - s * 0.15}
              H ${lx + s * 0.78}
              V ${ly + s * 0.95}
              H ${lx - s * 0.78}
              Z`}
          stroke={lock}
          strokeWidth={strokeW}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export function EarnedBadgeSticker({ badgeId, size = 78 }) {
  const source = BADGE_IMAGES[badgeId];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={badgeId}
      transition={0}
    />
  );
}

export function buildCaseSlots(earnedMap = {}, { earnedFirst = false } = {}) {
  const slots = TROPHY_CASE_FEATURED_IDS.map((id) => ({
    badge: BADGE_BY_ID[id],
    earned: Boolean(earnedMap[id]),
  })).filter((s) => s.badge);

  if (!earnedFirst) return slots;

  return [
    ...slots.filter((s) => s.earned),
    ...slots.filter((s) => !s.earned),
  ];
}

/**
 * Shared Trophy Case strip — pass caseSlots for other users, or omit for own profile.
 */
export function TrophyCaseStrip({
  isDark,
  theme,
  caseSlots,
  backTo = BACK_TO_PROFILE,
  userId = null,
}) {
  const router = useRouter();
  const T = theme;
  const slots = caseSlots || [];

  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: T.text,
          marginBottom: 18,
        }}
      >
        Trophy Case
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 2,
        }}
      >
        {slots.map(({ badge, earned }) => (
          <View key={badge.id} style={{ width: "23%", alignItems: "center" }}>
            {earned ? (
              <EarnedBadgeSticker badgeId={badge.id} size={78} />
            ) : (
              <LockedTrophyBadge size={70} isDark={isDark} />
            )}
            <Text
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: "500",
                color: T.text,
                textAlign: "center",
                lineHeight: 17,
                opacity: earned ? 1 : 0.85,
              }}
            >
              {badge.label}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/trophies",
            params: {
              backTo,
              ...(userId ? { userId: String(userId) } : {}),
            },
          })
        }
        activeOpacity={0.7}
        style={{
          marginTop: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 4,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "400", color: T.text }}>
          All trophies
        </Text>
        <Ionicons name="chevron-forward" size={18} color={T.text} />
      </TouchableOpacity>
    </View>
  );
}

/** Own-profile Trophy Case (loads local unlocks). */
export default function TrophyCase({ isDark, theme }) {
  const { caseSlots } = useAchievements();
  return (
    <TrophyCaseStrip
      isDark={isDark}
      theme={theme}
      caseSlots={caseSlots}
      backTo={BACK_TO_PROFILE}
    />
  );
}
