import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import LightOnDarkStatusBar from "@/components/LightOnDarkStatusBar";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getUserInvitationsAPI } from "@/services/PlayerApi";
import { getGamesByTeamAPI } from "@/services/GameApi";
import { goBackTo, BACK_TO_PROFILE, getBackToParam } from "@/lib/navigationBack";
import { showToast } from "@/context/ToastContext";
import { logoRequireMap } from "@/app/team/tabs/helpers";
import { SPORT_ICONS } from "@/constants/sports";
import { teamAbbrev } from "@/lib/homeUpcomingGames";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isAcceptedMembership = (inv) => {
  const status = String(inv.status || inv.invitationStatus || "").toLowerCase();
  return inv.isAccepted === true || status === "accepted" || !!inv.invitationAcceptedAt;
};

function resolveTeamLogoSource(teamLogo) {
  if (!teamLogo || typeof teamLogo !== "string") return null;
  if (logoRequireMap[teamLogo]) return logoRequireMap[teamLogo];
  if (/^https?:\/\//i.test(teamLogo)) return { uri: teamLogo };
  return null;
}

function buildLinkedTeams(invitations, userEmail) {
  const teamMap = new Map();

  for (const inv of invitations) {
    if (inv.teamDeleted || inv.isActive === false) continue;
    const teamId = inv.teamId;
    if (!teamId) continue;

    const recordEmail = normalizeEmail(inv.email || inv.parentEmail);
    const role = String(inv.playerRole || inv.role || "").toLowerCase();
    const isSpectator = role === "spectator" && isAcceptedMembership(inv);
    const isParentOfChild = userEmail && recordEmail === userEmail && role !== "spectator";

    if (!isParentOfChild && !isSpectator) continue;

    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        _id: teamId,
        teamName: inv.teamName || "Team",
        teamLogo: inv.teamLogo,
        sport: inv.sport,
        children: [],
        role: isSpectator ? "spectator" : "parent",
      });
    }

    const team = teamMap.get(teamId);
    if (isParentOfChild) {
      const childName =
        inv.playerName ||
        [inv.playerFirstName, inv.playerLastName].filter(Boolean).join(" ");
      if (childName && !team.children.includes(childName)) {
        team.children.push(childName);
      }
      if (team.children.length > 0) team.role = "parent";
    }
    if (isSpectator && team.children.length === 0) team.role = "spectator";
  }

  return Array.from(teamMap.values());
}

function HeaderStat({ label, value, color }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
      }}
    >
      <Text style={{ color: color || "#BAF072", fontSize: 32, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function TeamAvatar({ team }) {
  const logoSource = resolveTeamLogoSource(team.teamLogo);
  const sportIcon = team.sport && SPORT_ICONS[team.sport] ? SPORT_ICONS[team.sport] : null;
  const abbrev = teamAbbrev(team.teamName, "TM");

  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#081126",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {logoSource ? (
        <ExpoImage source={logoSource} style={{ width: 40, height: 40 }} contentFit="contain" cachePolicy="memory-disk" />
      ) : sportIcon ? (
        <ExpoImage source={sportIcon} style={{ width: 28, height: 28 }} contentFit="contain" />
      ) : (
        <Text style={{ color: "#BAF072", fontWeight: "800", fontSize: 14 }}>{abbrev}</Text>
      )}
    </View>
  );
}

function LiveMatchCard({ game, onPress, isDark, T }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
        overflow: "hidden",
        ...Platform.select({
          ios: { shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
          android: { elevation: 2 },
        }),
      }}
    >
      <View style={{ height: 3, backgroundColor: "#EF4444" }} />
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>LIVE</Text>
            <Text style={{ color: T.textMuted, fontSize: 11 }}>·</Text>
            <Text style={{ color: T.textDim, fontSize: 11, fontWeight: "600" }}>{game.sport || "Match"}</Text>
          </View>
          <Text style={{ color: T.text, fontWeight: "800", fontSize: 16, marginTop: 2 }} numberOfLines={1}>
            {game.teamName}
          </Text>
          <Text style={{ color: T.textDim, fontSize: 12, marginTop: 2 }}>Tap to watch live scores</Text>
        </View>
        <Ionicons name="play-circle" size={28} color={T.text} />
      </View>
    </TouchableOpacity>
  );
}

function TeamCard({ team, onPress, isDark, T }) {
  const subtitle = [
    team.sport,
    team.children?.length ? `Child: ${team.children.join(", ")}` : null,
    `${team.role} access`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ marginBottom: 10 }}>
      <View
        style={{
          backgroundColor: isDark ? T.surface : "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isDark ? T.border : "#E2E8F0",
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TeamAvatar team={team} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: T.text }} numberOfLines={1}>
            {team.teamName}
          </Text>
          <Text style={{ color: T.textDim, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={T.borderSubtle} />
      </View>
    </TouchableOpacity>
  );
}

export default function ParentPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params) || BACK_TO_PROFILE;
  const { backendUser } = useBackendAuth();
  const userEmail = normalizeEmail(backendUser?.email);
  const userId = String(backendUser?.userId || backendUser?.id || "");
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [teams, setTeams] = useState([]);
  const [liveGames, setLiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const childCount = useMemo(
    () => new Set(teams.flatMap((t) => t.children || [])).size,
    [teams],
  );

  const fetchParentData = useCallback(async () => {
    if (!userEmail && !userId) {
      setTeams([]);
      setLiveGames([]);
      setLoadError("Sign in to use the parent portal.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoadError(null);
      const invRes = await getUserInvitationsAPI();
      const invitations = invRes?.data || invRes || [];
      const list = Array.isArray(invitations) ? invitations : [];
      const linked = buildLinkedTeams(list, userEmail);

      const live = [];
      await Promise.all(
        linked.map(async (team) => {
          try {
            const gamesRes = await getGamesByTeamAPI(team._id, {
              sport: team.sport || undefined,
              status: "live",
            });
            const games = gamesRes?.data || gamesRes || [];
            (Array.isArray(games) ? games : []).forEach((g) => {
              live.push({ ...g, teamName: team.teamName, teamId: team._id });
            });
          } catch {
            /* optional */
          }
        }),
      );

      setTeams(linked);
      setLiveGames(live);
    } catch {
      setTeams([]);
      setLiveGames([]);
      setLoadError("Could not load parent portal. Pull to refresh.");
      showToast("Failed to load parent portal", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, userId]);

  useEffect(() => {
    fetchParentData();
  }, [fetchParentData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchParentData();
  }, [fetchParentData]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? T.bg : "#F0F4F8" }}>
      <StatusBar barStyle="light-content" />
      <LightOnDarkStatusBar />

      <LinearGradient
        colors={["#0B1324", "#141D35", "#0B1324"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/help-center",
                params: { role: "parent", screen: "parent_portal", backTo: "/parent" },
              })
            }
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="help-circle-outline" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "rgba(52,211,153,0.15)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(52,211,153,0.25)",
            }}
          >
            <Ionicons name="people" size={26} color="#34D399" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 26, letterSpacing: -0.5 }}>Parent Portal</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2, fontWeight: "500" }}>
              Follow teams & live matches
            </Text>
          </View>
        </View>

        {!loading ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <HeaderStat label="Teams" value={teams.length} color="#fff" />
            <HeaderStat label="Live" value={liveGames.length} color="#F87171" />
            <HeaderStat label="Children" value={childCount} color="#34D399" />
          </View>
        ) : null}
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#0B1324" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B1324" />}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <View
              style={{
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={{ color: isDark ? "#FCA5A5" : "#991B1B", fontWeight: "600", fontSize: 13, flex: 1 }}>{loadError}</Text>
            </View>
          ) : null}

          {liveGames.length > 0 ? (
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: T.textMuted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Live now
              </Text>
              {liveGames.map((g) => (
                <LiveMatchCard
                  key={String(g._id)}
                  game={g}
                  onPress={() =>
                    router.push({
                      pathname: `/game/${g._id}`,
                      params: { spectate: "1", backTo: "/parent" },
                    })
                  }
                  isDark={isDark}
                  T={T}
                />
              ))}
            </View>
          ) : null}

          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: T.textMuted,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Linked teams
          </Text>

          {teams.length === 0 ? (
            <View
              style={{
                backgroundColor: isDark ? T.surface : "#fff",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? T.border : "#E2E8F0",
                paddingVertical: 40,
                paddingHorizontal: 24,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Ionicons name="mail-outline" size={30} color={T.textMuted} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: "800", color: T.text }}>No linked teams yet</Text>
              <Text style={{ color: T.textDim, textAlign: "center", marginTop: 8, fontSize: 13, lineHeight: 20 }}>
                Ask the coach to add your email as the parent contact on your child's player profile.
              </Text>
              {userEmail ? (
                <View
                  style={{
                    marginTop: 16,
                    backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: isDark ? T.border : "#E2E8F0",
                  }}
                >
                  <Text style={{ color: T.textDim, fontSize: 11, fontWeight: "600", textAlign: "center" }}>Your email</Text>
                  <Text style={{ color: T.text, fontSize: 13, fontWeight: "700", marginTop: 2, textAlign: "center" }}>{userEmail}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            teams.map((t) => (
              <TeamCard
                key={t._id}
                team={t}
                onPress={() => router.push({ pathname: `/team/${t._id}`, params: { backTo: "/parent" } })}
                isDark={isDark}
                T={T}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
