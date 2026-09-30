import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { showToast } from "@/context/ToastContext";
import { goBackTo, BACK_TO_HOME } from "@/lib/navigationBack";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import { getTeamsAPI } from "@/services/TeamApi";
import {
  getFollowCountsAPI,
  getFollowStatusAPI,
  followTargetAPI,
  unfollowTargetAPI,
  listCommunityPostsAPI,
} from "@/services/CommunityPostApi";
import { inferBadgeIdsFromSignals } from "@/lib/achievementsStore";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { TrophyCaseStrip, buildCaseSlots } from "@/components/TrophyCase";
import { prefetchBadgeAssets } from "@/hooks/useAchievements";
import { useAchievements } from "@/hooks/useAchievements";
import AvatarRoleBadge from "@/components/AvatarRoleBadge";
import { getRoleById } from "@/lib/roleBadges";

const DEFAULT_AVATAR = require("../../assets/images/default_profile.webp");

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const { backendUser, isSignedIn } = useBackendAuth();
  const ownAchievements = useAchievements();

  const userId = String(
    Array.isArray(params.userId) ? params.userId[0] : params.userId || "",
  );
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const seedName = Array.isArray(params.name) ? params.name[0] : params.name || "";
  const seedAvatar = Array.isArray(params.avatar)
    ? params.avatar[0]
    : params.avatar || "";

  const myId = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");
  const isOwn = Boolean(myId && userId && myId === userId);
  const profileBackTo = backTo || `/user/${userId}`;

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState(seedName || "Player");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(seedAvatar || "");
  const [profileRole, setProfileRole] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [publicEarnedMap, setPublicEarnedMap] = useState({});

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    prefetchBadgeAssets({ all: false });

    try {
      const tasks = [
        getUsersByIdsAPI([userId]).catch(() => ({})),
        getFollowCountsAPI(userId).catch(() => null),
        !isOwn
          ? getFollowStatusAPI(`user:${userId}`).catch(() => null)
          : Promise.resolve(null),
        listCommunityPostsAPI({ page: 1, limit: 30, authorId: userId }).catch(
          () => ({ data: [] }),
        ),
        isOwn
          ? getTeamsAPI({ page: 1, limit: 100 }).catch(() => null)
          : Promise.resolve(null),
      ];

      const [profileMap, countsRes, statusRes, postsRes, teamsRes] =
        await Promise.all(tasks);

      const profile = profileMap?.[userId] || profileMap?.[String(userId)] || {};
      setDisplayName(
        profile.username ||
          profile.fullname ||
          profile.name ||
          seedName ||
          "Player",
      );
      setEmail(profile.email || "");
      setAvatar(
        profile.profilePicture ||
          profile.profileImage ||
          profile.avatar ||
          seedAvatar ||
          "",
      );
      setProfileRole(
        getRoleById(profile.profileRole) ? profile.profileRole : null,
      );

      const followersN = Number(countsRes?.data?.followers) || 0;
      const followingN = Number(countsRes?.data?.following) || 0;
      setFollowers(followersN);
      setFollowing(followingN);

      if (statusRes?.data) {
        setIsFollowing(Boolean(statusRes.data[`user:${userId}`]));
      }

      if (isOwn) {
        const teams = teamsRes?.data || teamsRes?.teams || teamsRes || [];
        setTeamsCount(Array.isArray(teams) ? teams.length : 0);
      } else {
        // Best-effort: use profile field if present, else 0 until public teams API exists
        setTeamsCount(
          Number(profile.teamsCount || profile.teamCount || profile.teams?.length) ||
            0,
        );
      }

      const posts = postsRes?.data || [];
      const likeCountReceived = posts.reduce(
        (sum, p) => sum + (Number(p.likeCount) || 0),
        0,
      );
      const inferred = inferBadgeIdsFromSignals({
        hasCommunityPost: posts.length > 0,
        likeCountReceived,
        followerCount: followersN,
      });
      const map = {};
      inferred.forEach((id) => {
        map[id] = true;
      });
      setPublicEarnedMap(map);
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to load profile", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, isOwn, seedName, seedAvatar]);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      if (isOwn) {
        router.replace("/(tabs)/settings");
        return;
      }
      load();
    }, [isSignedIn, isOwn, load, router]),
  );

  const onToggleFollow = async () => {
    if (!userId || isOwn || followBusy) return;
    const next = !isFollowing;
    setFollowBusy(true);
    setIsFollowing(next);
    setFollowers((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) await followTargetAPI("user", userId);
      else await unfollowTargetAPI("user", userId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      setIsFollowing(!next);
      setFollowers((c) => Math.max(0, c + (next ? -1 : 1)));
      showToast(error?.response?.data?.message || "Could not update follow", "error");
    } finally {
      setFollowBusy(false);
    }
  };

  const caseSlots = isOwn
    ? ownAchievements.caseSlots
    : buildCaseSlots(publicEarnedMap, { earnedFirst: true });

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
          onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
          hitSlop={10}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={28} color={T.text} />
        </TouchableOpacity>
        <Text
          style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: T.text }}
          numberOfLines={1}
        >
          Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
        >
          {/* Same top section as own profile */}
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 88, height: 88 }}>
                <Image
                  source={avatar?.trim() ? { uri: avatar } : DEFAULT_AVATAR}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: T.surfaceAlt,
                  }}
                  contentFit="cover"
                />
                <AvatarRoleBadge roleId={profileRole} avatarSize={88} size={28} bordered />
              </View>
              <View style={{ flex: 1, marginLeft: 16, justifyContent: "center" }}>
                <Text
                  style={{ fontSize: 22, fontWeight: "700", color: T.text }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {email ? (
                  <Text
                    style={{ color: T.textDim, fontSize: 14, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {email}
                  </Text>
                ) : null}
                {profileRole ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 8,
                      backgroundColor: isDark ? "rgba(154,234,98,0.16)" : "#E8F8D8",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isDark ? "#BAF072" : "#3F6212",
                      }}
                    >
                      {getRoleById(profileRole)?.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                marginTop: 20,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Following</Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "700", color: T.text, marginTop: 2 }}
                >
                  {following}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Followers</Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "700", color: T.text, marginTop: 2 }}
                >
                  {followers}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Teams</Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "700", color: T.text, marginTop: 2 }}
                >
                  {teamsCount}
                </Text>
              </View>
            </View>

            {!isOwn ? (
              <TouchableOpacity
                onPress={onToggleFollow}
                disabled={followBusy}
                activeOpacity={0.85}
                style={{
                  marginTop: 16,
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isFollowing ? T.surface : T.text,
                  borderWidth: isFollowing ? 1 : 0,
                  borderColor: T.border,
                  opacity: followBusy ? 0.65 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: isFollowing ? T.text : isDark ? "#0A0A0C" : "#FFFFFF",
                  }}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TrophyCaseStrip
            isDark={isDark}
            theme={T}
            caseSlots={caseSlots}
            backTo={profileBackTo}
            userId={isOwn ? null : userId}
          />
        </ScrollView>
      )}
    </View>
  );
}
