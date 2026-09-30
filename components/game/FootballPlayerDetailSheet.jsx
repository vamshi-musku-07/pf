import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Platform,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { fonts } from "@/constants/typography";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { playerIdOf } from "./footballFormations";

const NOTIFY_HINT_KEY = "football_player_notify_hint_dismissed";

const shortName = (player) => {
  const first = String(player?.firstName || "").trim();
  const last = String(player?.lastName || "").trim();
  const full = String(player?.playerName || player?.name || "").trim();
  if (first && last) return `${first[0]}. ${last}`;
  if (last) return last;
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}. ${parts[parts.length - 1]}`;
    return full;
  }
  return "Player";
};

const fullName = (player) => {
  const name = [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim();
  return name || player?.playerName || player?.name || "Player";
};

export const computeFootballPlayerRating = (stats) => {
  if (!stats) return null;
  const goals = Number(stats.goals || 0);
  const assists = Number(stats.assists || 0);
  const shotsOn = Number(stats.shots_on_target || 0);
  const saves = Number(stats.saves || 0);
  const tackles = Number(stats.tackles_won || stats.tackles || 0);
  const yellow = Number(stats.yellow_cards || 0);
  const red = Number(stats.red_cards || 0);
  const minutes = Number(stats.minutes_played || 0);
  const hasSignal =
    goals + assists + shotsOn + saves + tackles + yellow + red > 0 || minutes > 0;
  if (!hasSignal) return null;
  let rating =
    6.3 +
    goals * 0.55 +
    assists * 0.35 +
    shotsOn * 0.08 +
    saves * 0.12 +
    tackles * 0.08 -
    yellow * 0.25 -
    red * 0.9;
  if (minutes > 0 && minutes < 30) rating -= 0.15;
  rating = Math.max(5.0, Math.min(9.9, rating));
  return Math.round(rating * 10) / 10;
};

const ratingColor = (rating) => {
  if (rating == null || !Number.isFinite(rating)) return "#64748B";
  if (rating >= 7.5) return "#22C55E";
  if (rating >= 7.0) return "#4ADE80";
  if (rating >= 6.5) return "#EAB308";
  if (rating >= 6.0) return "#F59E0B";
  return "#EF4444";
};

const formatMatchDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}.`;
  } catch {
    return "—";
  }
};

const matchStatusLabel = (base, sport) => {
  const status = String(base?.status || "").toLowerCase();
  const ms = String(sport?.matchStatus || "").toLowerCase();
  if (status === "completed" || status === "finished" || ms === "finished") return "FT";
  if (ms === "half_time" || status === "halftime") return "HT";
  if (ms === "penalties") return "PEN";
  if (status === "live" || status === "in_progress") {
    const half = sport?.currentHalf || sport?.currentPeriod || 1;
    if (half === 1) return "1H";
    if (half === 2) return "2H";
    return "LIVE";
  }
  if (status === "scheduled") return "NS";
  return "FT";
};

const collectPlayerMatchBits = (events = [], playerId) => {
  const pid = String(playerId);
  const bits = { goals: 0, assists: 0, yellow: false, red: false, subIn: false, subOut: false, events: [] };
  for (const ev of events || []) {
    if (!ev) continue;
    const type = ev.eventType;
    if (type === "substitution") {
      const inId = String(ev.playerIn || ev.relatedPlayerId || "");
      const outId = String(ev.playerOut || ev.playerId || "");
      if (inId === pid) {
        bits.subIn = true;
        bits.events.push(ev);
      }
      if (outId === pid) {
        bits.subOut = true;
        bits.events.push(ev);
      }
      continue;
    }
    if (type === "assist" && String(ev.relatedPlayerId || "") === pid) {
      bits.assists += 1;
      bits.events.push(ev);
      continue;
    }
    if (String(ev.playerId || "") !== pid) continue;
    bits.events.push(ev);
    if (type === "goal" || type === "penalty_scored") bits.goals += 1;
    if (type === "assist") bits.assists += 1;
    if (type === "yellow_card" || type === "second_yellow") bits.yellow = true;
    if (type === "red_card" || type === "second_yellow") bits.red = true;
  }
  return bits;
};

function TeamLogo({ uri, name, size = 22, theme }) {
  if (uri) {
    return (
      <ExpoImage
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  const isDark = !!theme?.isDark;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isDark ? (theme?.cardElevated || "#334155") : "#CBD5E1",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: isDark ? (theme?.text || "#E2E8F0") : "#0F172A", fontSize: 9, fontWeight: "800" }}>
        {(name || "T")[0]?.toUpperCase()}
      </Text>
    </View>
  );
}

const AVATAR_COLORS = [
  "#86EFAC",
  "#93C5FD",
  "#FCD34D",
  "#F9A8D4",
  "#C4B5FD",
  "#67E8F9",
  "#FDBA74",
  "#A5B4FC",
];

const avatarColorFor = (seed = "") => {
  const str = String(seed || "?");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

function PlayerAvatar({ player, size = 56, theme }) {
  const photo = player?.profilePicture || player?.playerimage || player?.profileImage;
  const initials = [player?.firstName?.[0], player?.lastName?.[0]].filter(Boolean).join("").toUpperCase()
    || String(player?.playerName || player?.name || "?").slice(0, 2).toUpperCase();
  const seed = playerIdOf(player) || `${player?.firstName || ""}${player?.lastName || ""}` || initials;
  if (photo) {
    return (
      <ExpoImage
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  const isDark = !!theme?.isDark;
  const bg = isDark ? (theme?.cardElevated || "#334155") : avatarColorFor(seed);
  const fg = isDark ? (theme?.text || "#F5F5F7") : "#0F172A";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: isDark ? 0 : 1,
        borderColor: "rgba(15,23,42,0.1)",
      }}
    >
      <Text style={{ color: fg, fontWeight: "900", fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

/**
 * Player detail sheet opened from football lineup taps (light + dark).
 */
export default function FootballPlayerDetailSheet({
  visible,
  onClose,
  player,
  side = "home",
  sport,
  gameBase,
  teamNames = {},
  teamLogos = {},
  rosterPlayers = [],
  onSelectPlayer,
}) {
  const UI = useGameScoringTheme();
  const styles = useMemo(() => createStyles(UI), [UI]);
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [suppressNotifyHint, setSuppressNotifyHint] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFavorited(false);
    setDontShowAgain(false);
    AsyncStorage.getItem(NOTIFY_HINT_KEY)
      .then((v) => setSuppressNotifyHint(v === "1"))
      .catch(() => {});
  }, [visible, player?._id, player?.id]);

  const pid = playerIdOf(player);
  const stats = useMemo(() => {
    const rows = sport?.playerStats || [];
    return rows.find((r) => String(r?.playerId) === String(pid)) || null;
  }, [sport?.playerStats, pid]);

  const rating = computeFootballPlayerRating(stats);
  const bits = useMemo(
    () => collectPlayerMatchBits(sport?.events, pid),
    [sport?.events, pid],
  );

  const homeScore = sport?.score?.home ?? 0;
  const awayScore = sport?.score?.away ?? 0;
  const statusLabel = matchStatusLabel(gameBase, sport);
  const dateLabel = formatMatchDate(gameBase?.startTime || gameBase?.scheduledAt || gameBase?.createdAt);

  const stripPlayers = useMemo(() => {
    const list = (rosterPlayers || []).filter((p) => p && playerIdOf(p));
    if (!list.length && player) return [player];
    return list;
  }, [rosterPlayers, player]);

  const handleFavorite = async () => {
    if (favorited) {
      setFavorited(false);
      return;
    }
    setFavorited(true);
    if (suppressNotifyHint) return;
    setNotifyOpen(true);
  };

  const closeNotify = async () => {
    if (dontShowAgain) {
      try {
        await AsyncStorage.setItem(NOTIFY_HINT_KEY, "1");
        setSuppressNotifyHint(true);
      } catch {}
    }
    setNotifyOpen(false);
  };

  const goToNotificationSettings = async () => {
    await closeNotify();
    onClose?.();
    router.push({
      pathname: "/(tabs)/settings",
      params: { section: "notifications" },
    });
  };

  if (!player) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <PlayerAvatar player={player} size={52} theme={UI} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {fullName(player)}
                </Text>
                <Text style={styles.playerMeta} numberOfLines={1}>
                  {[
                    player.jerseyNumber != null && player.jerseyNumber !== ""
                      ? `#${player.jerseyNumber}`
                      : null,
                    player.position || null,
                    teamNames?.[side] || (side === "home" ? "Home" : "Away"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <TouchableOpacity onPress={handleFavorite} hitSlop={12} style={styles.starBtn}>
                <Ionicons
                  name={favorited ? "star" : "star-outline"}
                  size={24}
                  color={favorited ? UI.accent : UI.muted}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.matchRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateText}>{dateLabel}</Text>
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>

                <View style={styles.teamsCol}>
                  <View style={styles.teamLine}>
                    <TeamLogo uri={teamLogos?.home} name={teamNames?.home} theme={UI} />
                    <Text
                      style={[
                        styles.teamName,
                        side === "home" && styles.teamNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {teamNames?.home || "Home"}
                    </Text>
                  </View>
                  <View style={[styles.teamLine, { marginTop: 8 }]}>
                    <TeamLogo uri={teamLogos?.away} name={teamNames?.away} theme={UI} />
                    <Text
                      style={[
                        styles.teamName,
                        side === "away" && styles.teamNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {teamNames?.away || "Away"}
                    </Text>
                  </View>
                </View>

                <View style={styles.scoreCol}>
                  <Text style={styles.scoreText}>{homeScore}</Text>
                  <Text style={[styles.scoreText, { marginTop: 6 }]}>{awayScore}</Text>
                </View>

                <View style={styles.ratingCol}>
                  {rating != null ? (
                    <View style={[styles.ratingBox, { backgroundColor: ratingColor(rating) }]}>
                      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.naText}>N/A</Text>
                  )}
                  <View style={styles.iconRow}>
                    {bits.goals > 0 ? (
                      <View style={styles.eventIcon}>
                        <Ionicons name="football" size={12} color="#fff" />
                        {bits.goals > 1 ? (
                          <Text style={styles.eventCount}>{bits.goals}</Text>
                        ) : null}
                      </View>
                    ) : null}
                    {bits.assists > 0 ? (
                      <View style={styles.eventIcon}>
                        <Ionicons name="git-commit-outline" size={12} color={UI.accent} />
                      </View>
                    ) : null}
                    {bits.subIn || bits.subOut ? (
                      <Ionicons name="swap-horizontal" size={14} color={UI.muted} />
                    ) : null}
                    {bits.yellow ? (
                      <View style={[styles.cardDot, { backgroundColor: "#EAB308" }]} />
                    ) : null}
                    {bits.red ? (
                      <View style={[styles.cardDot, { backgroundColor: "#EF4444" }]} />
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.statsGrid}>
                {[
                  { label: "Goals", value: Number(stats?.goals || bits.goals || 0) },
                  { label: "Assists", value: Number(stats?.assists || bits.assists || 0) },
                  { label: "Shots", value: Number(stats?.shots || stats?.total_shots || 0) },
                  { label: "On target", value: Number(stats?.shots_on_target || 0) },
                  { label: "Tackles", value: Number(stats?.tackles || stats?.tackles_won || 0) },
                  { label: "Saves", value: Number(stats?.saves || 0) },
                ].map((item) => (
                  <View key={item.label} style={styles.statChip}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {bits.events.length > 0 ? (
                <View style={styles.timelineBlock}>
                  <Text style={styles.sectionTitle}>This match</Text>
                  {bits.events
                    .slice()
                    .reverse()
                    .map((ev, idx) => {
                      const minute = Number.isFinite(Number(ev.minute)) ? `${ev.minute}'` : "";
                      const type = String(ev.eventType || "event").replace(/_/g, " ");
                      return (
                        <View key={`${ev.timestamp || idx}-${type}`} style={styles.timelineRow}>
                          <Text style={styles.timelineMin}>{minute || "—"}</Text>
                          <Text style={styles.timelineType} numberOfLines={1}>
                            {type}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              ) : (
                <Text style={styles.emptyEvents}>No recorded actions for this player yet.</Text>
              )}
            </ScrollView>

            {stripPlayers.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripContent}
                style={styles.strip}
              >
                {stripPlayers.map((p) => {
                  const id = playerIdOf(p);
                  const active = id === pid;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => onSelectPlayer?.(p, side)}
                      style={[styles.stripCard, active && styles.stripCardActive]}
                    >
                      <PlayerAvatar player={p} size={36} theme={UI} />
                      <Text
                        style={[styles.stripName, active && styles.stripNameActive]}
                        numberOfLines={1}
                      >
                        {shortName(p)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={notifyOpen} transparent animationType="fade" onRequestClose={closeNotify}>
        <View style={styles.notifyBackdrop}>
          <View style={styles.notifyCard}>
            <View style={styles.notifyIconWrap}>
              <Ionicons name="notifications" size={22} color={UI.onAccent} />
            </View>
            <Text style={styles.notifyTitle}>Notifications on</Text>
            <Text style={styles.notifyName}>{fullName(player)}</Text>
            <Text style={styles.notifyBody}>
              You&apos;ll get alerts when this player scores, assists, or gets a card.
            </Text>
            <TouchableOpacity
              onPress={() => setDontShowAgain((v) => !v)}
              style={styles.checkRow}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, dontShowAgain && styles.checkboxOn]}>
                {dontShowAgain ? <Ionicons name="checkmark" size={12} color={UI.onAccent} /> : null}
              </View>
              <Text style={styles.checkLabel}>Don&apos;t show this again</Text>
            </TouchableOpacity>
            <View style={styles.notifyDivider} />
            <View style={styles.notifyActions}>
              <TouchableOpacity onPress={goToNotificationSettings} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.notifySettings}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeNotify} style={styles.notifyOkBtn} activeOpacity={0.85}>
                <Text style={styles.notifyOkText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(UI) {
  const accent = UI.accent;
  const onAccent = UI.onAccent;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: UI.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: UI.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: "88%",
      paddingBottom: 10,
      borderTopWidth: 1,
      borderColor: UI.border,
    },
    handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    playerName: { color: UI.text, fontSize: 18, fontWeight: "800" },
    playerMeta: { color: UI.muted, fontSize: 12, marginTop: 2, fontWeight: "600" },
    starBtn: { padding: 6 },

    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: UI.border,
    },
    dateCol: { width: 62 },
    dateText: { color: UI.muted, fontSize: 11, fontWeight: "600" },
    statusText: { color: UI.muted, fontSize: 11, fontWeight: "700", marginTop: 4 },
    teamsCol: { flex: 1, paddingHorizontal: 8 },
    teamLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    teamName: { color: UI.muted, fontSize: 13, fontWeight: "600", flex: 1 },
    teamNameActive: { color: UI.text, fontWeight: "800" },
    scoreCol: { width: 28, alignItems: "center" },
    scoreText: {
      color: UI.text,
      fontSize: 15,
      fontWeight: "800",
      fontFamily: fonts.scoreDisplay,
    },
    ratingCol: { width: 54, alignItems: "flex-end", gap: 6 },
    ratingBox: {
      minWidth: 36,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 5,
      alignItems: "center",
    },
    ratingText: { color: "#fff", fontWeight: "900", fontSize: 12 },
    naText: { color: UI.muted, fontWeight: "700", fontSize: 12 },
    iconRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    eventIcon: { flexDirection: "row", alignItems: "center", gap: 2 },
    eventCount: { color: UI.text, fontSize: 9, fontWeight: "800" },
    cardDot: { width: 8, height: 10, borderRadius: 1.5 },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingTop: 12,
      gap: 8,
    },
    statChip: {
      width: "31%",
      backgroundColor: UI.card,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: UI.border,
    },
    statValue: { color: UI.text, fontWeight: "900", fontSize: 16 },
    statLabel: { color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 2 },

    timelineBlock: { paddingHorizontal: 16, paddingTop: 14 },
    sectionTitle: {
      color: UI.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    timelineRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: UI.border,
    },
    timelineMin: { width: 40, color: UI.muted, fontWeight: "700", fontSize: 12 },
    timelineType: { flex: 1, color: UI.text, fontWeight: "600", fontSize: 13, textTransform: "capitalize" },
    emptyEvents: {
      color: UI.muted,
      fontSize: 12,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },

    strip: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: UI.border,
      marginTop: 8,
    },
    stripContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    stripCard: {
      width: 78,
      backgroundColor: UI.card,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: UI.border,
    },
    stripCardActive: {
      backgroundColor: UI.isDark ? "#F5F5F7" : UI.accent,
      borderColor: UI.isDark ? "#60A5FA" : UI.accent,
    },
    stripName: { color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 6 },
    stripNameActive: { color: UI.isDark ? "#0B1324" : onAccent },

    notifyBackdrop: {
      flex: 1,
      backgroundColor: UI.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    notifyCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: UI.isDark ? "#FFFFFF" : UI.card,
      borderRadius: 20,
      paddingTop: 22,
      paddingHorizontal: 20,
      paddingBottom: 18,
      borderWidth: 1,
      borderColor: UI.isDark ? "rgba(154,234,98,0.35)" : UI.border,
      ...Platform.select({
        ios: {
          shadowColor: "#0B1324",
          shadowOpacity: 0.22,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
        },
        android: { elevation: 12 },
      }),
    },
    notifyIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    notifyTitle: {
      color: UI.isDark ? "#0B1324" : UI.text,
      fontWeight: "800",
      fontSize: 18,
      letterSpacing: -0.3,
    },
    notifyName: {
      color: UI.isDark ? "#374151" : UI.textDim,
      fontWeight: "700",
      fontSize: 14,
      marginTop: 4,
    },
    notifyBody: {
      color: UI.isDark ? "#6B7280" : UI.muted,
      fontSize: 13,
      marginTop: 10,
      lineHeight: 19,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: UI.isDark ? "#F8FAFC" : UI.cardElevated,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: UI.isDark ? "#CBD5E1" : UI.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: UI.isDark ? "#FFFFFF" : UI.card,
    },
    checkboxOn: { backgroundColor: accent, borderColor: accent },
    checkLabel: { color: UI.isDark ? "#374151" : UI.text, fontSize: 13, fontWeight: "600", flex: 1 },
    notifyDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: UI.isDark ? "#E5E7EB" : UI.border,
      marginTop: 16,
      marginBottom: 14,
    },
    notifyActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    notifySettings: {
      color: UI.isDark ? "#6B7280" : UI.muted,
      fontWeight: "700",
      fontSize: 14,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    notifyOkBtn: {
      backgroundColor: accent,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 12,
      minWidth: 96,
      alignItems: "center",
    },
    notifyOkText: {
      color: onAccent,
      fontWeight: "800",
      fontSize: 14,
    },
  });
}
