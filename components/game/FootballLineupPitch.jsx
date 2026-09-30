import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/constants/typography";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import {
  parseFormation,
  assignPlayersToFormation,
  playerIdOf,
} from "./footballFormations";

/** Pitch field colors stay dark green in both themes. */
const PITCH = {
  grass: "#1a3d2e",
  grassAlt: "#163528",
  line: "rgba(255,255,255,0.22)",
  shell: "#12141f",
};

const shortName = (player) => {
  const first = String(player?.firstName || "").trim();
  const last = String(player?.lastName || "").trim();
  const full = String(player?.playerName || player?.name || "").trim();
  if (first && last) return `${first[0]}. ${last}`;
  if (last) return last;
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}. ${parts[parts.length - 1]}`;
    return full.length > 12 ? `${full.slice(0, 11)}…` : full;
  }
  return "Player";
};

const ratingColor = (rating) => {
  if (rating == null || !Number.isFinite(rating)) return "#64748B";
  if (rating >= 7.5) return "#22C55E";
  if (rating >= 7.0) return "#4ADE80";
  if (rating >= 6.5) return "#EAB308";
  if (rating >= 6.0) return "#F59E0B";
  return "#EF4444";
};

/** Match rating from recorded events/stats — only when there is signal. */
const computePlayerRating = (stats) => {
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

const collectPlayerEvents = (events = [], playerId) => {
  const pid = String(playerId);
  const badges = { goals: 0, assists: 0, yellow: false, red: false, subIn: false, subOut: false };
  for (const ev of events || []) {
    if (!ev) continue;
    const type = ev.eventType;
    if (type === "substitution") {
      if (String(ev.playerIn || ev.relatedPlayerId || "") === pid) badges.subIn = true;
      if (String(ev.playerOut || "") === pid) badges.subOut = true;
      if (String(ev.playerId || "") === pid) badges.subOut = true;
      continue;
    }
    if (type === "assist" && String(ev.relatedPlayerId || "") === pid) {
      badges.assists += 1;
      continue;
    }
    if (String(ev.playerId || "") !== pid) continue;
    if (type === "goal" || type === "penalty_scored") badges.goals += 1;
    if (type === "assist") badges.assists += 1;
    if (type === "yellow_card" || type === "second_yellow") badges.yellow = true;
    if (type === "red_card" || type === "second_yellow") badges.red = true;
  }
  return badges;
};

function PlayerMarker({ player, rating, badges, size = 44, onPitch = true, labelColor }) {
  const name = shortName(player);
  const jersey = player?.jerseyNumber ?? player?.number;
  const captain = player?.isCaptain ? "(c) " : "";
  const label = jersey != null && jersey !== "" ? `${jersey} ${captain}${name}` : `${captain}${name}`;
  const photo = player?.profilePicture || player?.playerimage || player?.profileImage;
  const ratingLabel = rating != null ? rating.toFixed(1) : null;
  const badgeBg = ratingColor(rating);
  const nameStyle = onPitch
    ? styles.playerNameOnPitch
    : [styles.playerNameOffPitch, labelColor ? { color: labelColor } : null];

  return (
    <View style={[styles.marker, { width: size + 18 }]}>
      <View style={[styles.avatarRing, { width: size, height: size, borderRadius: size / 2 }]}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              backgroundColor: "#0B1324",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: size * 0.32 }}>
              {jersey != null && jersey !== ""
                ? String(jersey)
                : (name[0] || "?").toUpperCase()}
            </Text>
          </View>
        )}

        {(badges?.subIn || badges?.subOut) && (
          <View style={[styles.subBadge, { backgroundColor: badges.subIn ? "#22C55E" : "#DC2626" }]}>
            <Ionicons
              name={badges.subIn ? "arrow-up" : "arrow-down"}
              size={9}
              color="#fff"
            />
          </View>
        )}

        {badges?.goals > 0 && (
          <View style={styles.goalBadge}>
            <Ionicons name="football" size={9} color="#0B1324" />
            {badges.goals > 1 ? <Text style={styles.goalCount}>{badges.goals}</Text> : null}
          </View>
        )}

        {(badges?.yellow || badges?.red) && (
          <View
            style={[
              styles.cardBadge,
              { backgroundColor: badges.red ? "#EF4444" : "#EAB308" },
            ]}
          />
        )}
      </View>

      {ratingLabel ? (
        <View style={[styles.ratingPill, { backgroundColor: badgeBg }]}>
          <Text style={styles.ratingText}>{ratingLabel}</Text>
        </View>
      ) : null}

      <Text style={nameStyle} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PitchMarkings() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.pitchLine, { top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1.5 }]} />
      <View style={[styles.pitchLine, { top: "50%", left: 8, right: 8, height: 0, borderTopWidth: 1.5 }]} />
      <View
        style={[
          styles.pitchLine,
          {
            width: 88,
            height: 88,
            borderRadius: 44,
            top: "50%",
            left: "50%",
            marginTop: -44,
            marginLeft: -44,
            borderWidth: 1.5,
          },
        ]}
      />
      <View
        style={{
          position: "absolute",
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: PITCH.line,
          top: "50%",
          left: "50%",
          marginTop: -3,
          marginLeft: -3,
        }}
      />
      <View
        style={[
          styles.pitchLine,
          { top: 8, left: "18%", right: "18%", height: "14%", borderWidth: 1.5 },
        ]}
      />
      <View
        style={[
          styles.pitchLine,
          { top: 8, left: "32%", right: "32%", height: "7%", borderWidth: 1.5 },
        ]}
      />
      <View
        style={[
          styles.pitchLine,
          { bottom: 8, left: "18%", right: "18%", height: "14%", borderWidth: 1.5 },
        ]}
      />
      <View
        style={[
          styles.pitchLine,
          { bottom: 8, left: "32%", right: "32%", height: "7%", borderWidth: 1.5 },
        ]}
      />
    </View>
  );
}

/**
 * One team half with absolute slot placement.
 * Slot y: 0 = own goal, 100 = attack.
 * Away (top): own goal at top → screenTop% = y * 0.92 + 4
 * Home (bottom): own goal at bottom → screenTop% = (100 - y) * 0.92 + 4
 */
function TeamHalf({
  side,
  players,
  formationLabel,
  events,
  statsById,
  isTop,
  onPlayerPress,
}) {
  const { placements } = useMemo(
    () => assignPlayersToFormation(players, formationLabel),
    [players, formationLabel],
  );

  return (
    <View style={styles.half}>
      {placements.map(({ slot, player }) => {
        const pid = playerIdOf(player);
        const rating = computePlayerRating(statsById[pid]);
        const badges = collectPlayerEvents(events, pid);
        const topPct = isTop
          ? slot.y * 0.88 + 4
          : (100 - slot.y) * 0.88 + 4;
        return (
          <TouchableOpacity
            key={`${side}-${slot.key}-${pid}`}
            activeOpacity={0.85}
            onPress={() => onPlayerPress?.(player, { side, context: "pitch" })}
            style={[
              styles.absoluteSlot,
              {
                left: `${slot.x}%`,
                top: `${topPct}%`,
              },
            ]}
          >
            <PlayerMarker
              player={player}
              rating={rating}
              badges={badges}
              size={isTop ? 38 : 40}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TeamFooter({
  name,
  logo,
  formationLabel,
  avgRating,
  kitColor = "#E2E8F0",
  theme,
}) {
  const UI = theme;
  return (
    <View style={[styles.teamFooter, { backgroundColor: UI.card, borderColor: UI.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ width: 28, height: 28, borderRadius: 6 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: UI.cardElevated,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: UI.accent, fontWeight: "900", fontSize: 12 }}>
              {(name || "T")[0]}
            </Text>
          </View>
        )}
        <Text style={[styles.teamFooterName, { color: UI.text }]} numberOfLines={1}>
          {name || "Team"}
        </Text>
      </View>

      {avgRating != null ? (
        <View style={[styles.avgPill, { backgroundColor: ratingColor(avgRating) }]}>
          <Text style={styles.avgText}>{avgRating.toFixed(2)}</Text>
        </View>
      ) : (
        <View style={[styles.avgPill, { backgroundColor: UI.cardElevated }]}>
          <Text style={[styles.avgText, { color: UI.muted }]}>—</Text>
        </View>
      )}

      <Text style={[styles.formationLabel, { color: UI.muted }]}>{formationLabel}</Text>
      <View style={[styles.kitSwatch, { backgroundColor: kitColor, borderColor: UI.border }]} />
    </View>
  );
}

function BenchStrip({ title, players, events, statsById, side, onPlayerPress, theme }) {
  if (!players?.length) return null;
  const UI = theme;
  return (
    <View style={styles.benchBlock}>
      <Text style={[styles.benchTitle, { color: UI.muted }]}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 8 }}
      >
        {players.map((player) => {
          const pid = playerIdOf(player);
          return (
            <TouchableOpacity
              key={`bench-${pid}`}
              activeOpacity={0.85}
              onPress={() => onPlayerPress?.(player, { side, context: "bench" })}
            >
              <PlayerMarker
                player={player}
                rating={computePlayerRating(statsById[pid])}
                badges={collectPlayerEvents(events, pid)}
                size={36}
                onPitch={false}
                labelColor={UI.text}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Football lineup pitch (both XIs on one field).
 * Uses saved lineups + formation slots — never invents a random XI.
 */
export default function FootballLineupPitch({
  sport,
  players = {},
  teamNames = {},
  teamLogos = {},
  events,
  onPlayerPress,
}) {
  const UI = useGameScoringTheme();
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState("pitch");

  const matchEvents = events || sport?.events || [];
  const homeFormation = parseFormation(sport?.homeFormation || "4-3-3");
  const awayFormation = parseFormation(sport?.awayFormation || "4-3-3");

  const statsById = useMemo(() => {
    const map = {};
    for (const row of sport?.playerStats || []) {
      if (row?.playerId != null) map[String(row.playerId)] = row;
    }
    return map;
  }, [sport?.playerStats]);

  const resolveLineup = (side) => {
    const lineup = side === "home" ? sport?.homeLineup || [] : sport?.awayLineup || [];
    const roster = (players?.[side] || []).filter((p) => p && p.role !== "manager");
    const rosterById = new Map(roster.map((p) => [playerIdOf(p), p]));

    const mapped = (lineup || [])
      .map((entry) => {
        const pid = String(entry?.playerId || "");
        if (!pid) return null;
        const rosterPlayer = rosterById.get(pid);
        return {
          ...rosterPlayer,
          ...entry,
          _id: pid,
          id: pid,
          firstName:
            rosterPlayer?.firstName ||
            entry?.firstName ||
            (entry?.playerName ? String(entry.playerName).split(/\s+/)[0] : "Player"),
          lastName:
            rosterPlayer?.lastName ||
            entry?.lastName ||
            (entry?.playerName
              ? String(entry.playerName).split(/\s+/).slice(1).join(" ")
              : ""),
          playerName: rosterPlayer
            ? [rosterPlayer.firstName, rosterPlayer.lastName].filter(Boolean).join(" ")
            : entry?.playerName,
          jerseyNumber: entry?.jerseyNumber ?? rosterPlayer?.jerseyNumber ?? rosterPlayer?.number,
          position: entry?.position || rosterPlayer?.position || null,
          slotKey: entry?.slotKey || entry?.formationSlot || null,
          profilePicture: rosterPlayer?.profilePicture || rosterPlayer?.playerimage,
          isGoalkeeper: !!(entry?.isGoalkeeper || rosterPlayer?.isGoalkeeper),
          isCaptain: !!(entry?.isCaptain || rosterPlayer?.isCaptain),
        };
      })
      .filter(Boolean);

    // No saved lineup → do not invent a random first-11.
    // Only auto-show when the whole squad fits on the pitch (≤11), matching scoring panel.
    if (!mapped.length) {
      if (roster.length > 0 && roster.length <= 11) {
        return { onField: roster, bench: [], subbedOff: [], hasLineup: true };
      }
      return { onField: [], bench: [], subbedOff: [], hasLineup: false };
    }

    const hasLeft = (p) => p.substitutionMinute != null && p.substitutionMinute !== undefined;
    const onField = mapped.filter((p) => !p.isSubstitute && !hasLeft(p));
    const bench = mapped.filter((p) => !!p.isSubstitute && !hasLeft(p));
    const subbedOff = mapped.filter((p) => hasLeft(p));
    return { onField, bench, subbedOff, hasLineup: true };
  };

  const home = resolveLineup("home");
  const away = resolveLineup("away");

  const homePlaced = useMemo(
    () => assignPlayersToFormation(home.onField, homeFormation.label),
    [home.onField, homeFormation.label],
  );
  const awayPlaced = useMemo(
    () => assignPlayersToFormation(away.onField, awayFormation.label),
    [away.onField, awayFormation.label],
  );

  const avgFor = (placements) => {
    const ratings = (placements || [])
      .map(({ player }) => computePlayerRating(statsById[playerIdOf(player)]))
      .filter((r) => r != null);
    if (!ratings.length) return null;
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
  };

  const pitchWidth = Math.min(width - 24, 420);
  const pitchHeight = Math.round(pitchWidth * 1.6);
  const empty = !home.hasLineup && !away.hasLineup;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.modeRow}>
        {[
          { id: "pitch", label: "Pitch" },
          { id: "list", label: "List" },
        ].map((opt) => {
          const active = viewMode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setViewMode(opt.id)}
              style={[
                styles.modeChip,
                {
                  backgroundColor: active ? UI.activeTint : UI.cardElevated,
                  borderColor: active ? UI.accent : UI.border,
                },
              ]}
            >
              <Text style={{ fontWeight: "800", fontSize: 12, color: active ? UI.accent : UI.muted }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {empty ? (
        <View style={[styles.emptyBox, { backgroundColor: UI.card, borderColor: UI.border }]}>
          <Ionicons name="people-outline" size={36} color={UI.muted} />
          <Text style={[styles.emptyTitle, { color: UI.text }]}>No lineups yet</Text>
          <Text style={[styles.emptySub, { color: UI.muted }]}>
            Set each team’s starting XI and formation from Scoring — players will appear in real pitch positions (not a random order).
          </Text>
        </View>
      ) : viewMode === "pitch" ? (
        <View style={[styles.pitchShell, { width: pitchWidth, alignSelf: "center", borderColor: UI.border }]}>
          <TeamFooter
            name={teamNames?.away || "Away"}
            logo={teamLogos?.away}
            formationLabel={away.hasLineup ? awayFormation.label : "—"}
            avgRating={away.hasLineup ? avgFor(awayPlaced.placements) : null}
            kitColor="#DC2626"
            theme={UI}
          />
          <View style={[styles.pitch, { height: pitchHeight }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: PITCH.grass }]} />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                backgroundColor: PITCH.grassAlt,
                opacity: 0.35,
              }}
            />
            <PitchMarkings />

            <View style={styles.pitchContent}>
              {away.hasLineup ? (
                <TeamHalf
                  side="away"
                  players={away.onField}
                  formationLabel={awayFormation.label}
                  events={matchEvents}
                  statsById={statsById}
                  isTop
                  onPlayerPress={onPlayerPress}
                />
              ) : (
                <View style={styles.halfEmpty}>
                  <Text style={styles.halfEmptyText}>Away XI not set</Text>
                </View>
              )}
              {home.hasLineup ? (
                <TeamHalf
                  side="home"
                  players={home.onField}
                  formationLabel={homeFormation.label}
                  events={matchEvents}
                  statsById={statsById}
                  isTop={false}
                  onPlayerPress={onPlayerPress}
                />
              ) : (
                <View style={styles.halfEmpty}>
                  <Text style={styles.halfEmptyText}>Home XI not set</Text>
                </View>
              )}
            </View>
          </View>

          <TeamFooter
            name={teamNames?.home || "Home"}
            logo={teamLogos?.home}
            formationLabel={home.hasLineup ? homeFormation.label : "—"}
            avgRating={home.hasLineup ? avgFor(homePlaced.placements) : null}
            kitColor="#F8FAFC"
            theme={UI}
          />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {[
            {
              side: "home",
              label: teamNames?.home || "Home",
              data: home,
              formation: homeFormation,
              placed: homePlaced,
            },
            {
              side: "away",
              label: teamNames?.away || "Away",
              data: away,
              formation: awayFormation,
              placed: awayPlaced,
            },
          ].map((block) => (
            <View key={block.side} style={[styles.listCard, { backgroundColor: UI.card, borderColor: UI.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={[styles.listTitle, { color: UI.text }]}>{block.label}</Text>
                <Text style={[styles.listFormation, { color: UI.muted }]}>
                  {block.data.hasLineup ? block.formation.label : "Not set"}
                </Text>
              </View>
              {!block.data.hasLineup ? (
                <Text style={{ color: UI.muted, fontSize: 12 }}>Starting XI not saved yet.</Text>
              ) : (
                block.placed.placements.map(({ slot, player }) => {
                  const pid = playerIdOf(player);
                  const rating = computePlayerRating(statsById[pid]);
                  return (
                    <TouchableOpacity
                      key={pid}
                      activeOpacity={0.85}
                      onPress={() => onPlayerPress?.(player, { side: block.side, context: "list" })}
                      style={[styles.listRow, { borderBottomColor: UI.border }]}
                    >
                      <Text style={[styles.listJersey, { color: UI.muted }]}>{player.jerseyNumber ?? "·"}</Text>
                      <Text style={[styles.listName, { color: UI.text }]} numberOfLines={1}>
                        {player.isCaptain ? "(c) " : ""}
                        {shortName(player)}
                      </Text>
                      <Text style={[styles.listPos, { color: UI.muted }]} numberOfLines={1}>
                        {slot.code}
                      </Text>
                      {rating != null ? (
                        <View style={[styles.listRating, { backgroundColor: ratingColor(rating) }]}>
                          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.listPos, { color: UI.muted }]}>—</Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ))}
        </View>
      )}

      <BenchStrip
        title={`${teamNames?.home || "Home"} bench`}
        players={home.bench}
        events={matchEvents}
        statsById={statsById}
        side="home"
        onPlayerPress={onPlayerPress}
        theme={UI}
      />
      <BenchStrip
        title={`${teamNames?.away || "Away"} bench`}
        players={away.bench}
        events={matchEvents}
        statsById={statsById}
        side="away"
        onPlayerPress={onPlayerPress}
        theme={UI}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  pitchShell: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: PITCH.shell,
  },
  pitch: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  pitchLine: {
    position: "absolute",
    borderColor: PITCH.line,
  },
  pitchContent: {
    flex: 1,
    flexDirection: "column",
  },
  half: {
    flex: 1,
    position: "relative",
  },
  halfEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  halfEmptyText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "700",
    fontSize: 12,
  },
  absoluteSlot: {
    position: "absolute",
    width: 72,
    marginLeft: -36,
    marginTop: -28,
    alignItems: "center",
  },

  marker: { alignItems: "center" },
  avatarRing: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  ratingPill: {
    marginTop: -8,
    minWidth: 28,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    alignItems: "center",
    zIndex: 2,
  },
  ratingText: {
    color: "#0B1324",
    fontSize: 10,
    fontWeight: "900",
    fontFamily: fonts.scoreDisplay,
  },
  playerNameOnPitch: {
    marginTop: 3,
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    maxWidth: 70,
  },
  playerNameOffPitch: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 70,
  },
  subBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  goalBadge: {
    position: "absolute",
    bottom: -2,
    left: -4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
    gap: 1,
  },
  goalCount: { fontSize: 8, fontWeight: "900", color: "#0B1324" },
  cardBadge: {
    position: "absolute",
    top: 2,
    left: -3,
    width: 8,
    height: 11,
    borderRadius: 1.5,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.3)",
  },

  teamFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  teamFooterName: { fontWeight: "800", fontSize: 14, flexShrink: 1 },
  avgPill: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
  },
  avgText: { color: "#0B1324", fontWeight: "900", fontSize: 12, fontFamily: fonts.scoreDisplay },
  formationLabel: { fontWeight: "800", fontSize: 13 },
  kitSwatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
  },

  benchBlock: { marginTop: 16 },
  benchTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyTitle: { fontWeight: "800", fontSize: 16, marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },

  listCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  listTitle: { fontWeight: "800", fontSize: 15, flex: 1 },
  listFormation: { fontWeight: "700", fontSize: 12 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  listJersey: { width: 28, fontWeight: "800", fontSize: 13 },
  listName: { flex: 1, fontWeight: "700", fontSize: 13 },
  listPos: { width: 56, fontSize: 11, textAlign: "right" },
  listRating: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    alignItems: "center",
  },
});
