import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackTo, BACK_TO_PROFILE } from "@/lib/navigationBack";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  BADGE_CATEGORIES,
  badgesForCategory,
} from "@/lib/achievementBadges";
import { BADGE_IMAGES } from "@/lib/badgeImages";
import { LockedTrophyBadge } from "@/components/TrophyCase";
import { useAchievements, prefetchBadgeAssets } from "@/hooks/useAchievements";
import { listCommunityPostsAPI, getFollowCountsAPI } from "@/services/CommunityPostApi";
import { inferBadgeIdsFromSignals } from "@/lib/achievementsStore";
import { useBackendAuth } from "@/context/BackendAuthContext";

export default function TrophiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const viewUserId = String(
    Array.isArray(params.userId) ? params.userId[0] : params.userId || "",
  );
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const { backendUser } = useBackendAuth();
  const myId = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");
  const isOther = Boolean(viewUserId && viewUserId !== myId);

  const own = useAchievements();
  const [publicEarned, setPublicEarned] = useState({});
  const [selected, setSelected] = useState(null);

  const loadPublic = useCallback(async () => {
    if (!isOther) return;
    try {
      const [postsRes, countsRes] = await Promise.all([
        listCommunityPostsAPI({ page: 1, limit: 30, authorId: viewUserId }).catch(
          () => ({ data: [] }),
        ),
        getFollowCountsAPI(viewUserId).catch(() => null),
      ]);
      const posts = postsRes?.data || [];
      const likeCountReceived = posts.reduce(
        (sum, p) => sum + (Number(p.likeCount) || 0),
        0,
      );
      const ids = inferBadgeIdsFromSignals({
        hasCommunityPost: posts.length > 0,
        likeCountReceived,
        followerCount: Number(countsRes?.data?.followers) || 0,
      });
      const map = {};
      ids.forEach((id) => {
        map[id] = true;
      });
      setPublicEarned(map);
    } catch {
      setPublicEarned({});
    }
  }, [isOther, viewUserId]);

  useEffect(() => {
    prefetchBadgeAssets({ all: true });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPublic();
    }, [loadPublic]),
  );

  const isEarned = (badgeId) =>
    isOther ? Boolean(publicEarned[badgeId]) : own.isEarned(badgeId);
  const earnedCount = isOther
    ? Object.keys(publicEarned).length
    : own.earnedBadges.length;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)}
          hitSlop={10}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={28} color={T.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "700",
            color: T.text,
          }}
        >
          Trophy Case
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text style={{ color: T.textDim, fontSize: 14, marginBottom: 18 }}>
          {earnedCount} unlocked
          {isOther ? "" : " · complete activities to earn more"}
        </Text>

        {BADGE_CATEGORIES.map((cat) => {
          const badges = badgesForCategory(cat.id);
          return (
            <View key={cat.id} style={{ marginBottom: 28 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: T.text,
                  marginBottom: 4,
                }}
              >
                {cat.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: T.textDim,
                  marginBottom: 14,
                }}
              >
                {cat.subtitle}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                }}
              >
                {badges.map((badge) => {
                  const earned = isEarned(badge.id);
                  const img = BADGE_IMAGES[badge.id];
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      activeOpacity={0.85}
                      onPress={() => setSelected({ badge, earned })}
                      style={{
                        width: "23%",
                        alignItems: "center",
                        marginBottom: 22,
                      }}
                    >
                      {earned && img ? (
                        <Image
                          source={img}
                          style={{ width: 72, height: 72 }}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          recyclingKey={badge.id}
                          transition={0}
                        />
                      ) : (
                        <LockedTrophyBadge size={64} isDark={isDark} />
                      )}
                      <Text
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          fontWeight: "500",
                          color: T.text,
                          textAlign: "center",
                          lineHeight: 15,
                          opacity: earned ? 1 : 0.75,
                        }}
                      >
                        {badge.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          onPress={() => setSelected(null)}
          style={{
            flex: 1,
            backgroundColor: T.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 340,
              backgroundColor: T.surface,
              borderRadius: 20,
              padding: 22,
              borderWidth: 1,
              borderColor: T.border,
              alignItems: "center",
            }}
          >
            {selected?.earned && BADGE_IMAGES[selected.badge.id] ? (
              <Image
                source={BADGE_IMAGES[selected.badge.id]}
                style={{ width: 140, height: 140 }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
            ) : (
              <LockedTrophyBadge size={110} isDark={isDark} />
            )}
            <Text
              style={{
                marginTop: 14,
                fontSize: 20,
                fontWeight: "800",
                color: T.text,
                textAlign: "center",
              }}
            >
              {selected?.badge?.emoji} {selected?.badge?.title}
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: T.textDim,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {selected?.badge?.description}
            </Text>
            <Text
              style={{
                marginTop: 14,
                fontSize: 13,
                fontWeight: "700",
                color: selected?.earned ? "#22C55E" : T.textMuted,
              }}
            >
              {selected?.earned ? "Unlocked" : "Locked"}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
