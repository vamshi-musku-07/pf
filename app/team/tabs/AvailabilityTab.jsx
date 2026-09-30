import { useState, useEffect, useRef, useCallback } from "react";
import { Animated, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { getAccessToken } from "@/lib/tokenStorage";
import { PLAYER_WS_URL } from "@/config/api";
import { getTeamAllAvailabilitiesAPI, updateMyAvailabilityAPI } from "@/services/AvailabilityApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { PlayerAvatar, LegendDot } from "./helpers";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";

function AvailabilitySkeleton({ isDark = false }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bone = isDark ? "#2A2A2E" : "#E2E8F0";
  const cardBg = isDark ? "#16161A" : "#fff";
  const B = ({ w, h = 12, r = 6, mt = 0 }) => (
    <Animated.View style={{ opacity: pulse, width: w, height: h, borderRadius: r, backgroundColor: bone, marginTop: mt }} />
  );
  const cardStyle = {
    backgroundColor: cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    ...(isDark
      ? { borderWidth: 1, borderColor: "#2A2A2E" }
      : { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }),
  };
  return (
    <ScrollView
      className="flex-1 px-4 pt-4"
      showsVerticalScrollIndicator={false}
      {...(isDark ? { style: { backgroundColor: "#0A0A0C" } } : {})}
    >
      {/* My Availability card */}
      <View style={cardStyle}>
        <B w={130} h={16} r={8} />
        {[0, 1].map((i) => (
          <View key={i} style={{ marginTop: 18 }}>
            <B w={70} h={11} r={5} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[0, 1, 2].map((j) => (
                <Animated.View key={j} style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: bone, opacity: pulse }} />
              ))}
            </View>
          </View>
        ))}
      </View>
      {/* Team Status card */}
      <View style={cardStyle}>
        <B w={110} h={16} r={8} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 16 }}>
          {[60, 50, 80, 60].map((w, i) => <B key={i} w={w} h={10} r={5} />)}
        </View>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: i < 4 ? 1 : 0,
              borderBottomColor: isDark ? "#27272A" : "#F1F5F9",
            }}
          >
            <Animated.View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bone, opacity: pulse, marginRight: 10 }} />
            <B w={90} h={11} r={5} />
            <View style={{ flexDirection: "row", gap: 10, marginLeft: "auto" }}>
              {[0, 1, 2].map((j) => (
                <Animated.View key={j} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: bone, opacity: pulse }} />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function AvailabilityTab({ teamId, players, isOwner, schedules, refreshing, onRefresh, isSelfOwnedOpponent = false, opponentTeamId = null }) {
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [availPlayers, setAvailPlayers] = useState([]);
  const [opponentPlayers, setOpponentPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadAvailability();
  }, []);

  // Real-time availability updates via socket
  useEffect(() => {
    let isMounted = true;
    let socket = null;

    const connect = async () => {
      try {
        const token = await getAccessToken();
        if (!isMounted || !token || !teamId) return;

        socket = io(PLAYER_WS_URL, {
          path: "/player-io",
          transports: ["websocket", "polling"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        socket.on("connect", () => {
          socket.emit("join-team", teamId);
          if (isSelfOwnedOpponent && opponentTeamId) {
            socket.emit("join-team", opponentTeamId);
          }
        });

        socket.on("reconnect", () => {
          socket.emit("join-team", teamId);
          if (isSelfOwnedOpponent && opponentTeamId) {
            socket.emit("join-team", opponentTeamId);
          }
        });

        socket.on("availability-updated", ({ teamId: updTeamId } = {}) => {
          if (!isMounted) return;
          const updStr = String(updTeamId || "");
          if (updStr === String(teamId) || (opponentTeamId && updStr === String(opponentTeamId))) {
            loadAvailability(true); // silent — don't show skeleton, just refresh data
          }
        });
      } catch {}
    };

    connect();

    return () => {
      isMounted = false;
      if (socket) { socket.disconnect(); socket = null; }
    };
  }, [teamId, opponentTeamId, isSelfOwnedOpponent]);

  // Combined pull-to-refresh: reload parent data AND local availability
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setLocalRefreshing(true);
    try {
      await Promise.all([
        onRefresh ? onRefresh() : Promise.resolve(),
        loadAvailability(true),
      ]);
    } finally {
      setLocalRefreshing(false);
    }
  }, [onRefresh]);

  const loadAvailability = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getTeamAllAvailabilitiesAPI(teamId);
      const d = res.data || res;
      let combined = Array.isArray(d.players) ? [...d.players] : [];

      if (isSelfOwnedOpponent && opponentTeamId) {
        // Merge opponent availabilities
        try {
          const oppRes = await getTeamAllAvailabilitiesAPI(opponentTeamId);
          const od = oppRes.data || oppRes;
          const oppAvail = Array.isArray(od.players) ? od.players : [];
          const existingIds = new Set(combined.map((p) => p.playerId || p._id));
          for (const p of oppAvail) {
            const pid = p.playerId || p._id;
            if (!existingIds.has(pid)) { existingIds.add(pid); combined.push(p); }
          }
        } catch {}

        // Fetch opponent players for the grid
        try {
          const pr = await getPlayersByTeamAPI(opponentTeamId);
          const oppPls = pr?.data || pr?.players || [];
          setOpponentPlayers(Array.isArray(oppPls) ? oppPls : []);
        } catch {
          setOpponentPlayers([]);
        }
      } else {
        setOpponentPlayers([]);
      }

      setAvailPlayers(combined);
    } catch {
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleUpdate = async (eventType, status) => {
    setUpdating(eventType);
    // Optimistic update — reflect change immediately in UI
    setAvailPlayers((prev) =>
      prev.map((a) =>
        a.isMe
          ? { ...a, availabilityAll: { ...a.availabilityAll, [eventType]: status } }
          : a,
      ),
    );
    // Use the team that owns the current user's player record.
    // For self-owned opponents the user's record may live in opponentTeamId.
    const updateTeamId = myAvail?.playerTeamId || teamId;
    try {
      await updateMyAvailabilityAPI(status, eventType, updateTeamId);
      loadAvailability(true);
    } catch {
      loadAvailability(true);
    } finally {
      setUpdating(null);
    }
  };

  // Backend sets isMe flag — use it directly
  const myAvail = availPlayers.find((a) => a.isMe === true);

  // Only show event types that have at least one scheduled event
  const allEventTypes = ["game", "practice", "other"];
  const scheduledSet = new Set((schedules || []).map((s) => s.eventType).filter(Boolean));
  const eventTypes = allEventTypes.filter((t) => scheduledSet.has(t));

  const cardClass = isDark
    ? "rounded-2xl p-5 mb-4"
    : "bg-white rounded-2xl p-5 mb-4 shadow-sm";
  const cardStyle = isDark
    ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
    : undefined;
  const pendingColor = isDark ? "#71717A" : "#D1D5DB";
  const unselectedBtnBg = isDark ? T.inputBg : "#F3F4F6";
  const unselectedIcon = isDark ? T.textMuted : "#9CA3AF";
  const unselectedText = isDark ? T.textDim : "#6B7280";

  if (loading) return <AvailabilitySkeleton isDark={isDark} />;

  return (
    <ScrollView
      className="flex-1 px-4 pt-4"
      showsVerticalScrollIndicator={false}
      {...(isDark ? { style: { backgroundColor: T.bg } } : {})}
      refreshControl={
        <RefreshControl
          refreshing={!!refreshing || localRefreshing}
          onRefresh={handleRefresh}
          colors={[isDark ? T.refresh : "#081126"]}
          tintColor={isDark ? T.refresh : "#081126"}
        />
      }
    >
      {/* No events banner */}
      {eventTypes.length === 0 && (
        <View
          className={
            isDark
              ? "rounded-2xl p-6 mb-4 items-center gap-2"
              : "bg-white rounded-2xl p-6 mb-4 shadow-sm items-center gap-2"
          }
          style={cardStyle}
        >
          <ExpoImage
            source={TEAM_EMPTY_ICONS.events}
            style={TEAM_EMPTY_ICON_STYLE}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text
            className="text-gray-400 font-semibold text-base mt-1"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            No Events Scheduled
          </Text>
          <Text
            className="text-gray-400 text-xs text-center"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            Once the coach schedules games or practices, your availability options will appear here.
          </Text>
        </View>
      )}

      {/* My RSVP — shown for any team member (player/manager/spectator) who has a linked account */}
      {myAvail != null && eventTypes.length > 0 && (
        <View className={cardClass} style={cardStyle}>
          <Text
            className="text-lg font-bold text-gray-900 mb-4"
            style={isDark ? { color: T.text } : undefined}
          >
            My Availability
          </Text>
          {eventTypes.map((et) => {
            const current = myAvail?.availabilityAll?.[et] || "pending";
            return (
              <View key={et} className="mb-4">
                <Text
                  className="text-gray-600 font-semibold capitalize mb-2"
                  style={isDark ? { color: T.textDim } : undefined}
                >
                  {et}s
                </Text>
                <View className="flex-row gap-2">
                  {[
                    {
                      s: "yes",
                      l: "Available",
                      c: "#22C55E",
                      icon: "checkmark-circle",
                    },
                    {
                      s: "maybe",
                      l: "Maybe",
                      c: "#F59E0B",
                      icon: "help-circle",
                    },
                    {
                      s: "no",
                      l: "Unavailable",
                      c: "#EF4444",
                      icon: "close-circle",
                    },
                  ].map(({ s, l, c, icon }) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => handleUpdate(et, s)}
                      disabled={updating === et}
                      className="flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1"
                      style={{
                        backgroundColor: current === s ? c : unselectedBtnBg,
                        opacity: updating === et ? 0.5 : 1,
                        ...(isDark && current !== s
                          ? { borderWidth: 1, borderColor: T.border }
                          : {}),
                      }}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={current === s ? "white" : unselectedIcon}
                      />
                      <Text
                        style={{
                          color: current === s ? "white" : unselectedText,
                        }}
                        className="font-bold text-xs"
                      >
                        {l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Team Status Grid */}
      {eventTypes.length > 0 && (
        <View className={cardClass} style={cardStyle}>
          <Text
            className="text-lg font-bold text-gray-900 mb-4"
            style={isDark ? { color: T.text } : undefined}
          >
            Team Status
          </Text>
          <View className="flex-row gap-3 mb-4 flex-wrap">
            <LegendDot color="#22C55E" label="Available" isDark={isDark} />
            <LegendDot color="#F59E0B" label="Maybe" isDark={isDark} />
            <LegendDot color="#EF4444" label="Unavailable" isDark={isDark} />
            <LegendDot color={pendingColor} label="Pending" isDark={isDark} />
          </View>

          <View
            className={
              isDark
                ? "flex-row items-center py-2 mb-1"
                : "flex-row items-center py-2 border-b border-gray-200 mb-1"
            }
            style={
              isDark
                ? { borderBottomWidth: 1, borderBottomColor: T.border }
                : undefined
            }
          >
            <Text
              className="flex-1 text-gray-500 text-xs font-bold"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              MEMBER
            </Text>
            {eventTypes.map((et) => (
              <Text
                key={et}
                className="w-16 text-center text-gray-500 text-xs font-bold capitalize"
                style={isDark ? { color: T.textMuted } : undefined}
              >
                {et}
              </Text>
            ))}
          </View>

          {/* Render a group of players with optional section label */}
          {[
            { list: players || [], label: isSelfOwnedOpponent && opponentPlayers.length > 0 ? "Our Team" : null },
            ...(isSelfOwnedOpponent && opponentPlayers.length > 0
              ? [{ list: opponentPlayers, label: "Opponents" }]
              : []),
          ].map(({ list, label }) => (
            <View key={label || "main"}>
              {label && (
                <View
                  style={{
                    backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                    paddingVertical: 6,
                    paddingHorizontal: 4,
                    marginVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: isDark ? T.textDim : "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {label}
                  </Text>
                </View>
              )}
              {list.map((p, pidx) => {
                const pid = String(p._id || p.id || "");
                const pa = availPlayers.find(
                  (a) => String(a.id || "") === pid || String(a.playerId || "") === pid,
                );
                const avColors = {
                  yes: "#22C55E",
                  maybe: "#F59E0B",
                  no: "#EF4444",
                  pending: pendingColor,
                };
                const avIcons = { yes: "checkmark", maybe: "help", no: "close", pending: "remove" };
                return (
                  <View
                    key={p._id || p.id || pidx}
                    className={
                      isDark
                        ? "flex-row items-center py-2.5"
                        : "flex-row items-center py-2.5 border-b border-gray-50"
                    }
                    style={
                      isDark
                        ? { borderBottomWidth: 1, borderBottomColor: T.borderSubtle }
                        : undefined
                    }
                  >
                    <View className="flex-1 flex-row items-center gap-2">
                      <PlayerAvatar player={p} size={28} />
                      <Text
                        className="text-gray-800 text-sm font-medium"
                        style={isDark ? { color: T.text } : undefined}
                        numberOfLines={1}
                      >
                        {p.firstName}
                      </Text>
                    </View>
                    {eventTypes.map((et) => {
                      const val = pa?.availabilityAll?.[et] || "pending";
                      return (
                        <View key={et} className="w-16 items-center">
                          <View
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: avColors[val] + "20" }}
                          >
                            <Ionicons name={avIcons[val]} size={14} color={avColors[val]} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Availability Stats */}
      {eventTypes.length > 0 && (
        <View
          className={
            isDark
              ? "rounded-2xl p-5 mb-6"
              : "bg-white rounded-2xl p-5 mb-6 shadow-sm"
          }
          style={cardStyle}
        >
          <Text
            className="text-lg font-bold text-gray-900 mb-3"
            style={isDark ? { color: T.text } : undefined}
          >
            Availability Stats
          </Text>
          {eventTypes.map((et) => {
            const total = (players || []).length + (isSelfOwnedOpponent ? opponentPlayers.length : 0);
            const available = availPlayers.filter(
              (a) => a.availabilityAll?.[et] === "yes",
            ).length;
            return (
              <View
                key={et}
                className="flex-row items-center justify-between py-2"
              >
                <Text
                  className="text-gray-600 capitalize font-medium"
                  style={isDark ? { color: T.textDim } : undefined}
                >
                  {et}s
                </Text>
                <Text
                  className="text-gray-900 font-bold"
                  style={isDark ? { color: T.text } : undefined}
                >
                  {available}/{total} available
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View className="h-10" />
    </ScrollView>
  );
}

// =============================================
// STATS TAB - Game history + scores
// =============================================
