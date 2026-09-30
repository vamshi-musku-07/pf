import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/constants/typography";
import { sanitizeGameEvents } from "@/lib/gameModel";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

/** Small WebP thumbs for fast load on scoring buttons + event log. */
const BASKETBALL_SCORE_ICONS = {
  point_2: require("@/assets/images/basketball-scoring/thumbs/bb-score-2pt.webp"),
  point_3: require("@/assets/images/basketball-scoring/thumbs/bb-score-3pt.webp"),
  free_throw: require("@/assets/images/basketball-scoring/thumbs/bb-score-ft.webp"),
  rebound: require("@/assets/images/basketball-scoring/thumbs/bb-event-rebound.webp"),
  assist: require("@/assets/images/basketball-scoring/thumbs/bb-event-assist.webp"),
  turnover: require("@/assets/images/basketball-scoring/thumbs/bb-event-turnover.webp"),
  foul: require("@/assets/images/basketball-scoring/thumbs/bb-event-foul.webp"),
  steal: require("@/assets/images/basketball-scoring/thumbs/bb-event-steal.webp"),
  block: require("@/assets/images/basketball-scoring/thumbs/bb-event-block.webp"),
};

const EVENT_TYPE_TO_3D_ICON = {
  point_2: "point_2",
  point_3: "point_3",
  free_throw: "free_throw",
  and_one: "point_2",
  rebound: "rebound",
  offensive_rebound: "rebound",
  defensive_rebound: "rebound",
  assist: "assist",
  turnover: "turnover",
  foul: "foul",
  shooting_foul: "foul",
  technical_foul: "foul",
  flagrant_foul: "foul",
  steal: "steal",
  block: "block",
};

const PLAY_EVENT_BUTTONS = [
  { type: "rebound", label: "Rebound", icon: "rebound", bg: "#0891B2", border: "#0E7490", deep: "#155E75" },
  { type: "assist", label: "Assist", icon: "assist", bg: "#4F46E5", border: "#4338CA", deep: "#3730A3" },
  { type: "turnover", label: "Turnover", icon: "turnover", bg: "#DC2626", border: "#B91C1C", deep: "#991B1B" },
  { type: "foul", label: "Foul", icon: "foul", bg: "#BE123C", border: "#9F1239", deep: "#881337" },
  { type: "steal", label: "Steal", icon: "steal", bg: "#9333EA", border: "#7E22CE", deep: "#6B21A8" },
  { type: "block", label: "Block", icon: "block", bg: "#CA8A04", border: "#A16207", deep: "#854D0E" },
  { type: "offensive_rebound", label: "Off. Reb", icon: "rebound", bg: "#0E7490", border: "#155E75", deep: "#164E63" },
  { type: "defensive_rebound", label: "Def. Reb", icon: "rebound", bg: "#155E75", border: "#164E63", deep: "#083344" },
  { type: "and_one", label: "And-One", icon: "point_2", bg: "#16A34A", border: "#15803D", deep: "#166534" },
  { type: "shooting_foul", label: "Shoot Foul", icon: "foul", bg: "#E11D48", border: "#BE123C", deep: "#9F1239" },
  { type: "technical_foul", label: "Technical", icon: "foul", bg: "#991B1B", border: "#7F1D1D", deep: "#450A0A" },
  { type: "flagrant_foul", label: "Flagrant", icon: "foul", bg: "#7F1D1D", border: "#450A0A", deep: "#1C1917" },
];

const raisedScoreShadow = (isDark) => ({
  shadowColor: isDark ? "#000" : "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: isDark ? 0.35 : 0.22,
  shadowRadius: 4,
  elevation: 5,
});

function BasketballScoreIcon({ name, size = 36 }) {
  const source = BASKETBALL_SCORE_ICONS[name] || BASKETBALL_SCORE_ICONS[EVENT_TYPE_TO_3D_ICON[name]];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={String(name)}
    />
  );
}

/** Flip-card digits with yellow binder rings (manual tally board look). */
function BasketballFlipDigits({ value = 0, digitColor = "#111827", compact = false }) {
  const digits = String(Math.max(0, Math.min(99, Number(value) || 0))).padStart(2, "0").split("");
  const tileW = compact ? 34 : 40;
  const tileH = compact ? 48 : 58;
  const fontSize = compact ? 32 : 40;
  const ring = compact ? 8 : 10;

  return (
    <View style={{ flexDirection: "row", gap: compact ? 5 : 7 }}>
      {digits.map((d, i) => (
        <View key={`${i}-${d}`} style={{ alignItems: "center" }}>
          <View
            style={{
              flexDirection: "row",
              gap: tileW * 0.28,
              zIndex: 2,
              marginBottom: -ring * 0.55,
            }}
          >
            {[0, 1].map((r) => (
              <View
                key={r}
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: "#FACC15",
                  borderWidth: 2,
                  borderColor: "#CA8A04",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.25,
                  shadowRadius: 1,
                  elevation: 2,
                }}
              />
            ))}
          </View>
          <View
            style={{
              width: tileW,
              height: tileH,
              backgroundColor: "#FFFFFF",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.scoreDisplay,
                fontSize,
                lineHeight: fontSize + 2,
                color: digitColor,
                fontVariant: ["tabular-nums"],
                includeFontPadding: false,
                textAlign: "center",
              }}
            >
              {d}
            </Text>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 3,
                right: 3,
                top: "50%",
                height: 1,
                marginTop: -0.5,
                backgroundColor: "rgba(15,23,42,0.12)",
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Flip-tile scoreboard with red (left) / black (right) digits — no blue board. */
export function BasketballScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
  gameTime,
  isLive = false,
  isScheduled = false,
  gameOver = false,
  isOwner = false,
  isUpdating = false,
  onPauseResume,
  onStartGame,
  onEndGame,
  compact = false,
  periodLabel = "Q1",
}) {
  const UI = useGameScoringTheme();
  const userIsHome = userSide !== "away";
  const userScore = userIsHome ? (sport?.score?.home ?? 0) : (sport?.score?.away ?? 0);
  const oppScore = userIsHome ? (sport?.score?.away ?? 0) : (sport?.score?.home ?? 0);
  const userName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const oppName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");
  const nameStyle = {
    color: UI.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  };

  return (
    <View
      style={{
        backgroundColor: UI.card,
        borderRadius: 16,
        marginHorizontal: compact ? 0 : 8,
        marginVertical: compact ? 0 : 8,
        paddingVertical: compact ? 12 : 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: UI.isDark ? UI.border : "#CBD5E1",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: UI.isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{userName}</Text>
          <BasketballFlipDigits value={userScore} digitColor="#E11D48" compact={compact} />
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Text style={{ fontSize: compact ? 22 : 26, marginBottom: 2 }}>🏀</Text>
          <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "800", marginBottom: 8 }}>
            {periodLabel}
          </Text>
          {isScheduled && isOwner && onStartGame ? (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{
                backgroundColor: "#16A34A",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderBottomWidth: 3,
                borderBottomColor: "#166534",
                opacity: isUpdating ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>▶ Start</Text>
            </TouchableOpacity>
          ) : null}
          {isLive && isOwner && !gameOver ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {onPauseResume ? (
                <TouchableOpacity
                  onPress={onPauseResume}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.warningBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.warningBorder,
                  }}
                >
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={16} color={UI.warningStrong} />
                </TouchableOpacity>
              ) : null}
              {onEndGame ? (
                <TouchableOpacity
                  onPress={onEndGame}
                  style={{
                    paddingHorizontal: 10,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.isDark ? "rgba(239,68,68,0.28)" : UI.dangerBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.isDark ? "rgba(252,165,165,0.45)" : "#FECACA",
                  }}
                >
                  <Text style={{ color: UI.dangerText, fontWeight: "800", fontSize: 10 }}>END</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {!isOwner && isScheduled ? (
            <Text style={{ color: UI.muted, fontSize: 10 }}>Waiting</Text>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{oppName}</Text>
          <BasketballFlipDigits value={oppScore} digitColor="#111827" compact={compact} />
        </View>
      </View>
    </View>
  );
}

const formatClockValue = (minutes, seconds) => (
  `${String(minutes || 0).padStart(2, "0")}:${String(seconds || 0).padStart(2, "0")}`
);

function BasketballScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  isUpdating,
  onEvent,
  onUndo,
  onSubstitution,
  onSetupLineup,
  gameOver,
  displayOnly = false,
  userSide = "home",
  isOwner = false,
  isSelfOwnedOpponent = false,
  onPauseResume,
  onEndGame,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const quarterActive = UI.isDark ? "#facc15" : "#B45309";
  const [pendingEvent, setPendingEvent] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [possession, setPossession] = useState("home"); // "home" | "away"
  const [showSubModal, setShowSubModal] = useState(false);
  const [subSide, setSubSide] = useState(null); // which team is subbing
  const [showStartingFiveModal, setShowStartingFiveModal] = useState(false);
  const [startingFiveSide, setStartingFiveSide] = useState(null);
  const [startingFiveModalKey, setStartingFiveModalKey] = useState(0);

  const sportData = currentGame?.sport || {};
  const base = currentGame?.base || {};
  const homeId = String(base?.teamId || "");
  const userIsHome = userSide === "home";
  const opponentSide = userIsHome ? "away" : "home";

  // ── SANITIZE events array once at the top — removes nulls AND objects missing eventType ──
  const safeEvents = useMemo(() => {
    return sanitizeGameEvents(sportData?.events);
  }, [sportData?.events]);

  // Scores
  const homeScore = sportData?.score?.home || 0;
  const awayScore = sportData?.score?.away || 0;
  const userScore = userIsHome ? homeScore : awayScore;
  const opponentScore = userIsHome ? awayScore : homeScore;

  // Quarter scores
  const homeByQuarter = sportData?.quarterScores?.home || [];
  const awayByQuarter = sportData?.quarterScores?.away || [];
  const userByQuarter = userIsHome ? homeByQuarter : awayByQuarter;
  const opponentByQuarter = userIsHome ? awayByQuarter : homeByQuarter;

  const currentQuarter = sportData?.currentQuarter || 1;
  const totalQuarters = Math.max(4, currentQuarter);

  // Team names
  const userTeamName = userIsHome ? teamNames?.home : teamNames?.away;
  const opponentTeamName = userIsHome ? teamNames?.away : teamNames?.home;

  const disabled = isUpdating || gameOver;
  const gameStatus = base?.status;
  const isLive = gameStatus === "live";
  const canManageBothTeams = isSelfOwnedOpponent;
  const managedSides = canManageBothTeams ? ["home", "away"] : [userSide];
  const activePendingEvent =
    pendingEvent && typeof pendingEvent === "object" ? pendingEvent : null;
  const pendingEventType =
    typeof activePendingEvent?.eventType === "string" &&
    activePendingEvent.eventType.trim().length > 0
      ? activePendingEvent.eventType
      : null;
  const overlayVisible = Boolean(activePendingEvent && pendingEventType && !displayOnly);
  const currentGameClock = useMemo(
    () => formatClockValue(gameTime?.minutes || 0, gameTime?.seconds || 0),
    [gameTime?.minutes, gameTime?.seconds],
  );

  // Event badge helper
  const getEventBadge = (type) => {
    const icon3d = EVENT_TYPE_TO_3D_ICON[type] || null;
    switch (type) {
      case "point_2":
        return { label: "+2", bg: "#16a34a", text: "2 Points", icon3d };
      case "point_3":
        return { label: "+3", bg: "#3b82f6", text: "3 Points", icon3d };
      case "free_throw":
        return { label: "+1", bg: "#14b8a6", text: "Free Throw", icon3d };
      case "point_2_miss":
        return { label: "M2", bg: "#ea580c", text: "Missed 2PT", icon3d };
      case "point_3_miss":
        return { label: "M3", bg: "#f97316", text: "Missed 3PT", icon3d };
      case "free_throw_miss":
        return { label: "M1", bg: "#fb923c", text: "Missed FT", icon3d };
      case "rebound":
        return { label: "RB", bg: "#0891b2", text: "Rebound", icon3d };
      case "assist":
        return { label: "AS", bg: "#6366f1", text: "Assist", icon3d };
      case "steal":
        return { label: "ST", bg: "#9333ea", text: "Steal", icon3d };
      case "block":
        return { label: "BL", bg: "#ca8a04", text: "Block", icon3d };
      case "turnover":
        return { label: "TO", bg: "#dc2626", text: "Turnover", icon3d };
      case "foul":
        return { label: "PF", bg: "#b91c1c", text: "Foul", icon3d };
      case "shooting_foul":
        return { label: "SF", bg: "#be123c", text: "Shooting Foul", icon3d };
      case "technical_foul":
        return { label: "TF", bg: "#7f1d1d", text: "Technical Foul", icon3d };
      case "flagrant_foul":
        return { label: "FF", bg: "#450a0a", text: "Flagrant Foul", icon3d };
      case "offensive_rebound":
        return { label: "OR", bg: "#0e7490", text: "Off. Rebound", icon3d };
      case "defensive_rebound":
        return { label: "DR", bg: "#155e75", text: "Def. Rebound", icon3d };
      case "and_one":
        return { label: "&1", bg: "#15803d", text: "And-One (+2 & FT)", icon3d };
      default:
        return {
          label: "•",
          bg: "#4B5563",
          text: type?.replace(/_/g, " ") || "Event",
          icon3d,
        };
    }
  };

  // Game stats computed from events
  const gameStats = useMemo(() => {
    const stats = {
      rebounds: { home: 0, away: 0 },
      assists: { home: 0, away: 0 },
      steals: { home: 0, away: 0 },
      blocks: { home: 0, away: 0 },
      turnovers: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
    };
    safeEvents.forEach((e) => {
      const type = e?.eventType;
      if (!type) return;
      const side = String(e.teamId) === homeId ? "home" : "away";
      if (type === "rebound" || type === "offensive_rebound" || type === "defensive_rebound") stats.rebounds[side]++;
      if (type === "assist") stats.assists[side]++;
      if (type === "steal") stats.steals[side]++;
      if (type === "block") stats.blocks[side]++;
      if (type === "turnover") stats.turnovers[side]++;
      if (type === "foul" || type === "shooting_foul" || type === "technical_foul" || type === "flagrant_foul") stats.fouls[side]++;
    });
    return stats;
  }, [safeEvents, homeId]);

  // All events & quarter events — use safeEvents (already sanitized)
  const allEvents = safeEvents;
  const quarterEvents = useMemo(() => safeEvents.slice(-8).reverse(), [safeEvents]);
  const safeQuarterEvents = useMemo(
    () =>
      quarterEvents.filter(
        (event) =>
          event &&
          typeof event === "object" &&
          typeof event.eventType === "string" &&
          event.eventType.trim().length > 0,
      ),
    [quarterEvents],
  );

  // Bonus tracking (5 fouls per quarter)
  const foulTypes = ["foul", "shooting_foul", "technical_foul", "flagrant_foul"];
  const homeTeamFouls = allEvents.filter(
    (e) =>
      e.quarter === currentQuarter &&
      foulTypes.includes(e?.eventType) &&
      String(e.teamId) === homeId,
  ).length;
  const awayTeamFouls = allEvents.filter(
    (e) =>
      e.quarter === currentQuarter &&
      foulTypes.includes(e?.eventType) &&
      String(e.teamId) !== homeId,
  ).length;
  const userFouls = userIsHome ? homeTeamFouls : awayTeamFouls;
  const opponentFouls = userIsHome ? awayTeamFouls : homeTeamFouls;
  const userInBonus = opponentFouls >= 5;
  const opponentInBonus = userFouls >= 5;

  // Player helpers
  const getTeamPlayers = (side) =>
    (players?.[side] || []).filter((p) => p && p.role !== "manager");
  const getPlayerId = (player) => String(player?.playerId || player?._id || player?.id || "");
  const getPlayerName = (player, fallback = "Team") => {
    if (!player) return fallback;
    if (player.playerName) return player.playerName;
    const fullName = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
    return fullName || fallback;
  };
  const getPlayerShort = (playerId, fallback = "—") => {
    if (!playerId) return fallback;
    const pid = String(playerId);
    const all = [...(players?.home || []), ...(players?.away || [])];
    const p = all.find((pl) => String(pl._id || pl.id) === pid);
    if (!p) return fallback;
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || fallback;
  };

  const buildFallbackLineup = (side) => {
    const roster = getTeamPlayers(side);
    const starters = roster.filter(
      (player) => player?.isStarter || player?.isStarting || player?.isInStartingLineup,
    );
    const starterIds = new Set(starters.map((player) => getPlayerId(player)));
    return [...starters, ...roster.filter((player) => !starterIds.has(getPlayerId(player)))]
      .slice(0, 5)
      .map((player, index) => ({
        playerId: getPlayerId(player),
        playerName: getPlayerName(player, `Player ${index + 1}`),
        jerseyNumber: player?.jerseyNumber ?? player?.number ?? null,
        position: player?.position || null,
        isStarter: true,
      }));
  };

  const hasValidStartingFive = (side) => {
    const savedLineup = side === "home" ? sportData?.homeLineup : sportData?.awayLineup;
    return Array.isArray(savedLineup) && savedLineup.length === 5;
  };

  const needsLineupSetup = (side) => getTeamPlayers(side).length > 5 && !hasValidStartingFive(side);

  const mapLineupSlots = (side, lineup) => {
    const roster = getTeamPlayers(side);
    return lineup
      .map((slot) => {
        const playerId = getPlayerId(slot);
        const rosterPlayer = roster.find((player) => getPlayerId(player) === playerId);
        return {
          playerId,
          playerName: getPlayerName(rosterPlayer || slot, slot?.playerName || "Player"),
          jerseyNumber: slot?.jerseyNumber ?? rosterPlayer?.jerseyNumber ?? rosterPlayer?.number ?? null,
          position: slot?.position || rosterPlayer?.position || null,
          isStarter: slot?.isStarter !== false,
        };
      })
      .filter((player) => player.playerId);
  };

  const getOnCourtPlayers = (side) => {
    const roster = getTeamPlayers(side);
    const savedLineup = side === "home" ? sportData?.homeLineup : sportData?.awayLineup;

    if (hasValidStartingFive(side)) {
      return mapLineupSlots(side, savedLineup);
    }

    if (roster.length <= 5) {
      const fallback = roster.length > 0 ? roster : buildFallbackLineup(side);
      return mapLineupSlots(
        side,
        fallback.map((player, index) => ({
          playerId: player.playerId || getPlayerId(player),
          playerName: player.playerName,
          jerseyNumber: player.jerseyNumber,
          position: player.position,
          isStarter: true,
        })),
      );
    }

    return [];
  };

  const getBenchPlayers = (side) => {
    const onCourtIds = new Set(getOnCourtPlayers(side).map((player) => player.playerId));
    return getTeamPlayers(side)
      .filter((player) => !onCourtIds.has(getPlayerId(player)))
      .map((player) => ({
        playerId: getPlayerId(player),
        playerName: getPlayerName(player, "Player"),
        jerseyNumber: player?.jerseyNumber ?? player?.number ?? null,
        position: player?.position || null,
      }));
  };

  const lineupSetupBlocking = isLive && isOwner && managedSides.some((side) => needsLineupSetup(side));
  const scoringDisabled = disabled || !isLive || lineupSetupBlocking;

  const userOnCourt = getOnCourtPlayers(userSide);
  const opponentOnCourt = getOnCourtPlayers(opponentSide);
  const userBench = getBenchPlayers(userSide);
  const opponentBench = getBenchPlayers(opponentSide);
  const getDisplayTeamName = (side) => (side === userSide ? userTeamName : opponentTeamName);
  const timeoutButtonConfigs = managedSides.map((side) => ({ side, teamName: getDisplayTeamName(side) }));
  const substitutionButtonConfigs = managedSides.map((side) => ({ side, teamName: getDisplayTeamName(side) }));
  const startingFiveConfigs = managedSides.map((side) => ({
    side,
    teamName: getDisplayTeamName(side),
    squadSize: getTeamPlayers(side).length,
    hasSavedLineup: hasValidStartingFive(side),
    needsSetup: needsLineupSetup(side),
  }));
  useEffect(() => {
    if (sportData?.possession === "home" || sportData?.possession === "away") {
      setPossession(sportData.possession);
    }
  }, [sportData?.possession]);

  const autoStartingFiveShownRef = useRef(false);
  useEffect(() => {
    if (displayOnly || !isLive || !onSetupLineup || autoStartingFiveShownRef.current || showStartingFiveModal) return;

    const autoSides = managedSides.filter((side) => {
      const squad = getTeamPlayers(side);
      return squad.length === 5 && !hasValidStartingFive(side);
    });

    if (autoSides.length > 0) {
      autoStartingFiveShownRef.current = true;
      autoSides.forEach((side) => {
        onSetupLineup({ side, players: getTeamPlayers(side) });
      });
      return;
    }

    const firstUnset = managedSides.find((side) => needsLineupSetup(side));
    if (firstUnset) {
      autoStartingFiveShownRef.current = true;
      setStartingFiveSide(firstUnset);
      setShowStartingFiveModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, sportData?.homeLineup, sportData?.awayLineup, showStartingFiveModal]);

  const submitPossessionChange = useCallback((nextSide) => {
    setPossession(nextSide);
    onEvent("possession_change", nextSide, undefined, { possession: nextSide });
  }, [onEvent]);

  // Event submission
  const submitEvent = (eventType, teamSide, playerId) => {
    onEvent(eventType, teamSide, playerId, { possession });
    setPendingEvent(null);
    setSelectedTeam(null);
  };

  const PLAYER_EVENTS = [
    "point_2",
    "point_3",
    "free_throw",
    "point_2_miss",
    "point_3_miss",
    "free_throw_miss",
    "rebound",
    "offensive_rebound",
    "defensive_rebound",
    "assist",
    "steal",
    "block",
    "turnover",
    "foul",
    "shooting_foul",
    "technical_foul",
    "flagrant_foul",
    "and_one",
  ];

  const handleEventClick = (eventType) => {
    if (scoringDisabled || displayOnly) return;
    if (!canManageBothTeams) {
      const needsPlayer = PLAYER_EVENTS.includes(eventType);
      setSelectedTeam(userSide);
      setPendingEvent({
        eventType,
        step: needsPlayer ? "player" : null,
        needsPlayer,
      });
      if (!needsPlayer) {
        submitEvent(eventType, userSide, null);
      }
      return;
    }
    setPendingEvent({
      eventType,
      step: "team",
      needsPlayer: PLAYER_EVENTS.includes(eventType),
    });
  };

  const handleTeamSelect = (side) => {
    setSelectedTeam(side);
    if (!activePendingEvent || !pendingEventType) {
      cancelPending();
      return;
    }
    if (activePendingEvent.needsPlayer) {
      setPendingEvent({ ...activePendingEvent, step: "player" });
    } else {
      // No player needed (e.g. timeout) — pass null so backend uses team-level
      submitEvent(pendingEventType, side, null);
    }
  };

  const handlePlayerSelect = (player) => {
    if (!pendingEventType || !selectedTeam) {
      cancelPending();
      return;
    }
    // "TEAM" = skip player selection → pass null so hook uses team_${tId} placeholder
    const pid = player === "TEAM" ? null : (player.playerId || player._id || player.id);
    submitEvent(pendingEventType, selectedTeam, pid);
  };

  const cancelPending = () => {
    setPendingEvent(null);
    setSelectedTeam(null);
  };

  // Safety guard — if no game data yet, show nothing
  if (!currentGame) return null;

  // ── PENDING EVENT OVERLAY (Team → Player flow) ──
  if (overlayVisible) {
    const badge = getEventBadge(pendingEventType);
    return (
      <View style={{ gap: 12 }}>
        {/* Header with badge + cancel */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: badge.icon3d ? 36 : 28,
                height: badge.icon3d ? 36 : 22,
                borderRadius: badge.icon3d ? 10 : 4,
                backgroundColor: UI.isDark ? badge.bg : (badge.icon3d ? "#FFFFFF" : badge.bg),
                borderWidth: badge.icon3d && !UI.isDark ? 1 : 0,
                borderColor: UI.border,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {badge.icon3d ? (
                <BasketballScoreIcon name={badge.icon3d} size={28} />
              ) : (
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>
                  {badge.label}
                </Text>
              )}
            </View>
            <Text style={{ color: UI.text, fontSize: 14, fontWeight: "800" }}>
              {badge.text}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {canManageBothTeams ? (
                <>
                  <Text
                    style={{
                      color: activePendingEvent.step === "team" ? UI.text : UI.muted,
                      fontSize: 9,
                      fontWeight: activePendingEvent.step === "team" ? "700" : "400",
                    }}
                  >
                    Team
                  </Text>
                  {activePendingEvent.step === "player" && (
                    <>
                      <Text style={{ color: UI.muted, fontSize: 9 }}>›</Text>
                      <Text style={{ color: UI.text, fontSize: 9, fontWeight: "700" }}>Player</Text>
                    </>
                  )}
                </>
              ) : (
                <Text style={{ color: UI.text, fontSize: 9, fontWeight: "700" }}>Player</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={cancelPending}
            style={{
              backgroundColor: UI.cardElevated,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: UI.muted, fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Team select */}
        {canManageBothTeams && activePendingEvent.step === "team" && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleTeamSelect(userSide)}
              style={{
                flex: 1,
                backgroundColor: "rgba(34,197,94,0.15)",
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.3)",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: homeAccent, fontWeight: "700", fontSize: 14 }}
              >
                {userTeamName}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleTeamSelect(opponentSide)}
              style={{
                flex: 1,
                backgroundColor: "rgba(239,68,68,0.15)",
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.3)",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: awayAccent, fontWeight: "700", fontSize: 14 }}
              >
                {opponentTeamName}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Player select */}
        {activePendingEvent.step === "player" && selectedTeam && (
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: UI.muted,
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {selectedTeam === userSide ? userTeamName : opponentTeamName} —
                Select Player
              </Text>
              <TouchableOpacity
                onPress={() => handlePlayerSelect("TEAM")}
                style={{
                  backgroundColor: UI.cardElevated,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: UI.text, fontSize: 9, fontWeight: "600" }}>
                  Skip Player
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {getOnCourtPlayers(selectedTeam).map((p) => (
                  <TouchableOpacity
                    key={p.playerId}
                    onPress={() => handlePlayerSelect(p)}
                    style={{
                      backgroundColor: UI.cardElevated,
                      borderWidth: 1,
                      borderColor: UI.border,
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      width: "48%",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    {p.jerseyNumber ? (
                      <Text
                        style={{
                          color: UI.muted,
                          fontSize: 9,
                          marginRight: 6,
                          backgroundColor: UI.isDark ? "rgba(0,0,0,0.3)" : UI.cardElevated,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        #{p.jerseyNumber}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        color: UI.text,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {p.playerName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* ═══ QUARTER SCOREBOARD TABLE ═══ */}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: UI.border,
        }}
      >
        {/* Quarter + Clock */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              backgroundColor:
                currentGame?.base?.status === "live"
                  ? (UI.isDark ? "rgba(34,197,94,0.2)" : "#DCFCE7")
                  : UI.cardElevated,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color:
                  currentGame?.base?.status === "live"
                    ? (UI.isDark ? "#4ade80" : "#15803D")
                    : UI.muted,
              }}
            >
              {currentQuarter > 4 ? "OT" : `Q${currentQuarter}`}
            </Text>
          </View>
          {currentGame?.base?.status === "live" && gameTime && (
            <View
              style={{
                backgroundColor: UI.isDark ? "rgba(0,0,0,0.4)" : UI.cardElevated,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  color: UI.text,
                }}
              >
                {`${String(gameTime.minutes || 0).padStart(2, "0")}:${String(gameTime.seconds || 0).padStart(2, "0")}`}
              </Text>
            </View>
          )}
        </View>

        {/* Table header */}
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          <View style={{ width: 80 }} />
          {Array.from({ length: totalQuarters }, (_, i) => (
            <View key={i} style={{ width: 28, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: i + 1 === currentQuarter ? quarterActive : UI.muted,
                }}
              >
                {i >= 4 ? `OT${i - 3}` : `Q${i + 1}`}
              </Text>
            </View>
          ))}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              borderLeftWidth: 1,
              borderLeftColor: UI.border,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", color: UI.text }}>
              TOT
            </Text>
          </View>
        </View>

        {/* User row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              width: 80,
              fontSize: 10,
              fontWeight: "800",
              color: homeAccent,
              textTransform: "uppercase",
            }}
            numberOfLines={1}
          >
            {userTeamName}
          </Text>
          {Array.from({ length: totalQuarters }, (_, i) => (
            <View key={i} style={{ width: 28, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: i + 1 === currentQuarter ? "700" : "400",
                  color: i + 1 === currentQuarter ? quarterActive : UI.textMuted,
                }}
              >
                {userByQuarter[i]?.score !== undefined
                  ? userByQuarter[i].score
                  : i + 1 <= currentQuarter
                    ? "0"
                    : "–"}
              </Text>
            </View>
          ))}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              borderLeftWidth: 1,
              borderLeftColor: UI.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: homeAccent }}>
              {userScore}
            </Text>
          </View>
        </View>

        {/* Opponent row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 6,
            backgroundColor: UI.card,
          }}
        >
          <Text
            style={{
              width: 80,
              fontSize: 10,
              fontWeight: "800",
              color: awayAccent,
              textTransform: "uppercase",
            }}
            numberOfLines={1}
          >
            {opponentTeamName}
          </Text>
          {Array.from({ length: totalQuarters }, (_, i) => (
            <View key={i} style={{ width: 28, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: i + 1 === currentQuarter ? "700" : "400",
                  color: i + 1 === currentQuarter ? quarterActive : UI.textMuted,
                }}
              >
                {opponentByQuarter[i]?.score !== undefined
                  ? opponentByQuarter[i].score
                  : i + 1 <= currentQuarter
                    ? "0"
                    : "–"}
              </Text>
            </View>
          ))}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              borderLeftWidth: 1,
              borderLeftColor: UI.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: awayAccent }}>
              {opponentScore}
            </Text>
          </View>
        </View>
      </View>


      {/* ═══ SCORING BUTTONS ═══ */}
      {!displayOnly && !pendingEvent && (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          {/* Section label */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: "800",
              color: UI.isDark ? "rgba(74,222,128,0.8)" : "#15803D",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            Scoring
          </Text>

          {/* +2, +3, +1 buttons row */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {/* +2 Field Goal */}
            <View style={{ flex: 1, gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleEventClick("point_2")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#16A34A",
                  borderWidth: 1,
                  borderColor: "#15803D",
                  borderBottomWidth: 4,
                  borderBottomColor: "#166534",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                  shadowColor: UI.isDark ? "#000" : "#64748B",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: UI.isDark ? 0.35 : 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <BasketballScoreIcon name="point_2" size={40} />
                <Text
                  style={{ fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 4 }}
                >
                  +2
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Field Goal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleEventClick("point_2_miss")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#47feb7",
                  borderWidth: 1,
                  borderColor: "#05e29e",
                  borderRadius: 4,
                  paddingVertical: 6,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "#1f2937",
                    textTransform: "uppercase",
                  }}
                >
                  Miss 2PT
                </Text>
              </TouchableOpacity>
            </View>

            {/* +3 Three Pointer */}
            <View style={{ flex: 1, gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleEventClick("point_3")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#2563EB",
                  borderWidth: 1,
                  borderColor: "#1D4ED8",
                  borderBottomWidth: 4,
                  borderBottomColor: "#1E40AF",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                  shadowColor: UI.isDark ? "#000" : "#64748B",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: UI.isDark ? 0.35 : 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <BasketballScoreIcon name="point_3" size={40} />
                <Text
                  style={{ fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 4 }}
                >
                  +3
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  3 Pointer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleEventClick("point_3_miss")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#47feb7",
                  borderWidth: 1,
                  borderColor: "#05e29e",
                  borderRadius: 4,
                  paddingVertical: 6,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "#1f2937",
                    textTransform: "uppercase",
                  }}
                >
                  Miss 3PT
                </Text>
              </TouchableOpacity>
            </View>

            {/* +1 Free Throw */}
            <View style={{ flex: 1, gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleEventClick("free_throw")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#0D9488",
                  borderWidth: 1,
                  borderColor: "#0F766E",
                  borderBottomWidth: 4,
                  borderBottomColor: "#115E59",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                  shadowColor: UI.isDark ? "#000" : "#64748B",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: UI.isDark ? 0.35 : 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <BasketballScoreIcon name="free_throw" size={40} />
                <Text
                  style={{ fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 4 }}
                >
                  +1
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Free Throw
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleEventClick("free_throw_miss")}
                disabled={scoringDisabled}
                style={{
                  backgroundColor: "#47feb7",
                  borderWidth: 1,
                  borderColor: "#05e29e",
                  borderRadius: 4,
                  paddingVertical: 6,
                  alignItems: "center",
                  opacity: scoringDisabled ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "#1f2937",
                    textTransform: "uppercase",
                  }}
                >
                  Miss FT
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: UI.cardElevated,
              marginVertical: 12,
            }}
          />

          {/* Play Events label */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: "800",
              color: UI.isDark ? "rgba(168,85,247,0.8)" : "#7E22CE",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Play Events
          </Text>

          {/* Play event buttons — solid raised + 3D icons */}
          <View style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((row) => (
              <View key={`play-row-${row}`} style={{ flexDirection: "row", gap: 8 }}>
                {PLAY_EVENT_BUTTONS.slice(row * 3, row * 3 + 3).map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handleEventClick(btn.type)}
                    disabled={scoringDisabled}
                    style={{
                      flex: 1,
                      backgroundColor: btn.bg,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 6,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: scoringDisabled ? 0.4 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: "#FFFFFF",
                        textTransform: "uppercase",
                        textAlign: "center",
                      }}
                      numberOfLines={1}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}



         {/* ═══ GAME CONTROLS: Timeout + Substitution ═══ */}
      {!displayOnly && !pendingEvent && (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          {/* Timeout + Substitution buttons row */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {timeoutButtonConfigs.map(({ side, teamName }) => (
              <TouchableOpacity
                key={`timeout-${side}`}
                onPress={() => {
                  Alert.alert("Timeout", `${teamName} timeout?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: () => onEvent("timeout", side, null) },
                  ]);
                }}
                disabled={scoringDisabled}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  backgroundColor: "rgba(251,191,36,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(251,191,36,0.3)",
                  borderRadius: 8,
                  paddingVertical: 10,
                  opacity: scoringDisabled ? 0.4 : 1,
                }}
              >
                <Ionicons name="time-outline" size={14} color={UI.isDark ? "#fbbf24" : "#B45309"} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#fbbf24" : "#B45309" }}>TO {teamName}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Substitution buttons row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {substitutionButtonConfigs.map(({ side, teamName }) => (
              <TouchableOpacity
                key={`sub-${side}`}
                onPress={() => { setSubSide(side); setShowSubModal(true); }}
                disabled={scoringDisabled}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  backgroundColor: "rgba(99,102,241,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(99,102,241,0.3)",
                  borderRadius: 8,
                  paddingVertical: 10,
                  opacity: scoringDisabled ? 0.4 : 1,
                }}
              >
                <Ionicons name="swap-horizontal" size={14} color={UI.isDark ? "#818cf8" : "#4338CA"} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#818cf8" : "#4338CA" }}>SUB {teamName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!displayOnly && !pendingEvent && onSetupLineup && isOwner && isLive ? (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.border,
            gap: 8,
          }}
        >
          {lineupSetupBlocking ? (
            <View style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: "rgba(59,130,246,0.12)",
              borderWidth: 1,
              borderColor: "rgba(59,130,246,0.35)",
            }}>
              <Text style={{ color: UI.isDark ? "#93c5fd" : "#1D4ED8", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Set starting five before scoring
              </Text>
              <Text style={{ color: UI.muted, fontSize: 11, lineHeight: 16 }}>
                Your roster has more than 5 players. Choose who starts on the court and who stays on the bench.
              </Text>
            </View>
          ) : null}
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: UI.muted,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Starting Five
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {startingFiveConfigs.map(({ side, teamName, hasSavedLineup, needsSetup, squadSize }) => (
              <TouchableOpacity
                key={`starting-five-${side}`}
                onPress={() => {
                  if (squadSize <= 5) return;
                  setStartingFiveSide(side);
                  setShowStartingFiveModal(true);
                }}
                disabled={disabled || squadSize <= 5}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: hasSavedLineup ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
                  borderWidth: 1,
                  borderColor: hasSavedLineup ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)",
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  opacity: disabled || squadSize <= 5 ? 0.45 : 1,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                    {teamName}
                  </Text>
                  <Text style={{ color: UI.muted, fontSize: 10, marginTop: 2 }}>
                    {squadSize < 5
                      ? `${squadSize} on court`
                      : squadSize === 5
                        ? "5 players — all on court"
                        : needsSetup
                        ? "Tap to pick five + bench"
                        : "Starting five saved"}
                  </Text>
                </View>
                <Ionicons
                  name={hasSavedLineup ? "checkmark-circle" : "people-outline"}
                  size={18}
                  color={hasSavedLineup ? homeAccent : (UI.isDark ? "#60a5fa" : "#2563EB")}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

   

      {/* ═══ ON-COURT FIVE + BENCH ═══ */}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: UI.border,
          gap: 10,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: UI.muted,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          On-Court Five And Bench
        </Text>

        {[
          {
            teamName: userTeamName,
            accent: homeAccent,
            onCourt: userOnCourt,
            bench: userBench,
          },
          {
            teamName: opponentTeamName,
            accent: awayAccent,
            onCourt: opponentOnCourt,
            bench: opponentBench,
          },
        ].map(({ teamName, accent, onCourt, bench }) => (
          <View
            key={teamName}
            style={{
              backgroundColor: UI.card,
              borderRadius: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: UI.border,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: accent }}>{teamName}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: UI.muted }}>
                5 On Court / {bench.length} Bench
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: UI.text, marginBottom: 6 }}>On Court</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {onCourt.map((player) => (
                  <View
                    key={`court-${teamName}-${player.playerId}`}
                    style={{
                      minWidth: "31%",
                      backgroundColor: UI.cardElevated,
                      borderWidth: 1,
                      borderColor: UI.border,
                      borderRadius: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: UI.text }} numberOfLines={1}>
                      {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                      {player.playerName}
                    </Text>
                    <Text style={{ fontSize: 9, color: UI.muted, marginTop: 2 }} numberOfLines={1}>
                      {player.position || "On Court"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: UI.text, marginBottom: 6 }}>Bench</Text>
              {bench.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {bench.map((player) => (
                    <View
                      key={`bench-${teamName}-${player.playerId}`}
                      style={{
                        backgroundColor: UI.cardElevated,
                        borderWidth: 1,
                        borderColor: UI.border,
                        borderRadius: 999,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "600", color: UI.text }}>
                        {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                        {player.playerName}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 10, color: UI.muted }}>No bench players available.</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* ═══ QUARTER EVENT LOG ═══ */}
      {safeQuarterEvents.length > 0 && (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: UI.muted,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {currentQuarter > 4
              ? `OT${currentQuarter - 4}`
              : `Quarter ${currentQuarter}`}{" "}
            Events
          </Text>
          <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <View style={{ gap: 4 }}>
              {safeQuarterEvents.map((e, i) => {
                const type = e?.eventType;
                if (!type) return null;
                const badge = getEventBadge(type);
                const eIsHome = String(e.teamId) === homeId;
                const eIsUser = userIsHome ? eIsHome : !eIsHome;
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: eIsUser
                        ? "rgba(34,197,94,0.05)"
                        : "rgba(239,68,68,0.05)",
                    }}
                  >
                    <View
                      style={{
                        width: badge.icon3d ? 32 : 24,
                        height: badge.icon3d ? 32 : 20,
                        borderRadius: badge.icon3d ? 10 : 4,
                        backgroundColor: UI.isDark ? badge.bg : (badge.icon3d ? "#FFFFFF" : badge.bg),
                        borderWidth: badge.icon3d && !UI.isDark ? 1 : 0,
                        borderColor: UI.border,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {badge.icon3d ? (
                        <BasketballScoreIcon name={badge.icon3d} size={26} />
                      ) : (
                        <Text
                          style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}
                        >
                          {badge.label}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        color: UI.text,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {getPlayerShort(e?.playerId, eIsUser ? (userTeamName || "Team") : (opponentTeamName || "Team"))}
                    </Text>
                    <Text style={{ color: UI.textMuted, fontSize: 10 }}>
                      {badge.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ═══ TEAM STATS (comparison bars) ═══ */}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: UI.border,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: UI.muted,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          Team Stats
        </Text>
        {[
          { label: "Rebounds", key: "rebounds" },
          { label: "Assists", key: "assists" },
          { label: "Steals", key: "steals" },
          { label: "Blocks", key: "blocks" },
          { label: "Turnovers", key: "turnovers" },
          { label: "Fouls", key: "fouls" },
        ].map(({ label, key }) => {
          const uVal = gameStats[key]?.[userSide] || 0;
          const oVal = gameStats[key]?.[opponentSide] || 0;
          const total = uVal + oVal || 1;
          return (
            <View
              key={key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  width: 20,
                  textAlign: "right",
                  fontSize: 11,
                  fontWeight: "700",
                  color: homeAccent,
                }}
              >
                {uVal}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: UI.cardElevated,
                  borderRadius: 3,
                  flexDirection: "row",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${(uVal / total) * 100}%`,
                    backgroundColor: "rgba(34,197,94,0.6)",
                    borderTopLeftRadius: 3,
                    borderBottomLeftRadius: 3,
                  }}
                />
                <View
                  style={{
                    width: `${(oVal / total) * 100}%`,
                    backgroundColor: "rgba(239,68,68,0.6)",
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  }}
                />
              </View>
              <Text
                style={{
                  width: 20,
                  fontSize: 11,
                  fontWeight: "700",
                  color: awayAccent,
                }}
              >
                {oVal}
              </Text>
              <Text style={{ width: 70, fontSize: 10, color: UI.muted }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ═══ SUBSTITUTION MODAL ═══ */}
      <Modal visible={showSubModal} transparent animationType="slide" onRequestClose={() => setShowSubModal(false)}>
        <SubstitutionModal
          side={subSide}
          teamName={subSide === "home" ? teamNames?.home : teamNames?.away}
          onCourtPlayers={subSide ? getOnCourtPlayers(subSide) : []}
          benchPlayers={subSide ? getBenchPlayers(subSide) : []}
          onClose={() => setShowSubModal(false)}
          onSubmit={(playerOut, playerIn, currentLineup) => {
            onSubstitution?.(subSide, playerOut, playerIn, currentLineup);
            setShowSubModal(false);
          }}
        />
      </Modal>

      <Modal visible={showStartingFiveModal} transparent animationType="slide" onRequestClose={() => setShowStartingFiveModal(false)}>
        {showStartingFiveModal && startingFiveSide ? (
          <StartingFiveModal
            key={`${startingFiveSide}-${startingFiveModalKey}`}
            side={startingFiveSide}
            teamName={startingFiveSide === "home" ? teamNames?.home : teamNames?.away}
            rosterPlayers={getTeamPlayers(startingFiveSide)}
            initialSelection={hasValidStartingFive(startingFiveSide) ? getOnCourtPlayers(startingFiveSide) : []}
            onClose={() => setShowStartingFiveModal(false)}
            onSubmit={async (selectedPlayers) => {
              if (!onSetupLineup || !startingFiveSide) return;
              const savedSide = startingFiveSide;
              const result = await onSetupLineup({ side: savedSide, players: selectedPlayers });
              if (!result?.ok) return;
              if (result.nextSide) {
                setStartingFiveSide(result.nextSide);
                setStartingFiveModalKey((key) => key + 1);
                return;
              }
              setShowStartingFiveModal(false);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function StartingFiveModal({ side, teamName, rosterPlayers, initialSelection, onClose, onSubmit }) {
  const UI = useGameScoringTheme();
  const [selectedIds, setSelectedIds] = useState(() =>
    initialSelection.map((player) => String(player.playerId || player._id || player.id)),
  );
  const [saving, setSaving] = useState(false);

  const getPid = (player) => String(player._id || player.id || player.playerId);

  const togglePlayer = (player) => {
    const playerId = getPid(player);
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, playerId];
    });
  };

  const selectedSet = new Set(selectedIds);
  const selectedPlayers = rosterPlayers.filter((player) => selectedSet.has(getPid(player)));
  const benchCount = rosterPlayers.length - selectedPlayers.length;

  const formatName = (player) => {
    const jersey = player.jerseyNumber ? `#${player.jerseyNumber} ` : player.number ? `#${player.number} ` : "";
    const name = [player.firstName, player.lastName].filter(Boolean).join(" ");
    return `${jersey}${name || "Player"}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: UI.overlay, justifyContent: "flex-end" }}>
      <View style={{
        backgroundColor: UI.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "90%",
        borderWidth: 1,
        borderColor: UI.border,
      }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: UI.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Starting Five
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: UI.text, marginTop: 2 }}>{teamName}</Text>
            <Text style={{ fontSize: 11, color: UI.muted, marginTop: 4 }}>
              Pick 5 on court · {rosterPlayers.length} in roster
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.cardElevated, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color={UI.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: selectedIds.length === 5 ? (UI.isDark ? "#4ade80" : "#15803D") : (UI.isDark ? "#fbbf24" : "#B45309") }}>
            {selectedIds.length}/5 on court
          </Text>
          <TouchableOpacity onPress={() => setSelectedIds([])}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: UI.isDark ? "#60a5fa" : "#2563EB" }}>Clear</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#4ade80" : "#15803D", textTransform: "uppercase", marginBottom: 6 }}>
          On court ({selectedPlayers.length})
        </Text>
        <ScrollView style={{ maxHeight: 120, marginBottom: 12 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {rosterPlayers.map((player) => {
              const playerId = getPid(player);
              if (!selectedSet.has(playerId)) return null;
              return (
                <TouchableOpacity
                  key={`on-${playerId}`}
                  onPress={() => togglePlayer(player)}
                  style={{
                    backgroundColor: UI.isDark ? "rgba(34,197,94,0.22)" : "#DCFCE7",
                    borderWidth: 1,
                    borderColor: UI.isDark ? "#4ade80" : "#86EFAC",
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: UI.isDark ? "#4ade80" : "#15803D" }}>{formatName(player)}</Text>
                </TouchableOpacity>
              );
            })}
            {selectedPlayers.length === 0 ? (
              <Text style={{ color: UI.muted, fontSize: 11 }}>Tap players below to add them</Text>
            ) : null}
          </View>
        </ScrollView>

        <Text style={{ fontSize: 10, fontWeight: "700", color: UI.muted, textTransform: "uppercase", marginBottom: 6 }}>
          Roster — tap to add/remove ({benchCount} on bench)
        </Text>
        <ScrollView style={{ maxHeight: 220, marginBottom: 14 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {rosterPlayers.map((player) => {
              const playerId = getPid(player);
              const selected = selectedSet.has(playerId);
              return (
                <TouchableOpacity
                  key={playerId}
                  onPress={() => togglePlayer(player)}
                  style={{
                    width: "48%",
                    backgroundColor: selected
                      ? (UI.isDark ? "rgba(34,197,94,0.14)" : "#DCFCE7")
                      : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected
                      ? (UI.isDark ? "rgba(34,197,94,0.4)" : "#86EFAC")
                      : UI.border,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    opacity: !selected && selectedIds.length >= 5 ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: selected ? (UI.isDark ? "#4ade80" : "#15803D") : UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                    {formatName(player)}
                  </Text>
                  <Text style={{ color: UI.muted, fontSize: 10, marginTop: 3 }} numberOfLines={1}>
                    {player.position || (selected ? "On court" : "Tap to select")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={async () => {
            if (selectedIds.length !== 5 || saving) return;
            setSaving(true);
            try {
              await onSubmit(selectedPlayers);
            } finally {
              setSaving(false);
            }
          }}
          disabled={selectedIds.length !== 5 || saving}
          style={{
            backgroundColor: selectedIds.length === 5 && !saving ? "#2563eb" : "rgba(37,99,235,0.35)",
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
            {saving ? "Saving…" : "Save Starting Five"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Substitution Modal Component ──
function SubstitutionModal({ teamName, onCourtPlayers, benchPlayers, onClose, onSubmit }) {
  const UI = useGameScoringTheme();
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);

  const canSubmit = playerOut && playerIn && playerOut !== playerIn;

  return (
    <View style={{ flex: 1, backgroundColor: UI.overlay, justifyContent: "center", padding: 20 }}>
      <View style={{ backgroundColor: UI.card, borderRadius: 16, padding: 20, maxHeight: "80%", borderWidth: 1, borderColor: UI.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: UI.text }}>Substitution - {teamName}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={UI.muted} />
          </TouchableOpacity>
        </View>

        {/* Player Out */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#f87171", textTransform: "uppercase", marginBottom: 6 }}>Player Out</Text>
        <ScrollView style={{ maxHeight: 120, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {onCourtPlayers.map((player) => {
              const pid = player.playerId;
              const selected = playerOut === pid;
              return (
                <TouchableOpacity
                  key={pid}
                  onPress={() => setPlayerOut(pid)}
                  style={{
                    backgroundColor: selected
                      ? (UI.isDark ? "rgba(248,113,113,0.3)" : "#FEE2E2")
                      : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected ? "#f87171" : UI.border,
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? "#f87171" : UI.text }}>
                    {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}{player.playerName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Player In */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: UI.isDark ? "#4ade80" : "#15803D", textTransform: "uppercase", marginBottom: 6 }}>Player In</Text>
        <ScrollView style={{ maxHeight: 120, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {benchPlayers.map((player) => {
              const pid = player.playerId;
              const selected = playerIn === pid;
              return (
                <TouchableOpacity
                  key={pid}
                  onPress={() => setPlayerIn(pid)}
                  style={{
                    backgroundColor: selected
                      ? (UI.isDark ? "rgba(74,222,128,0.3)" : "#DCFCE7")
                      : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected ? (UI.isDark ? "#4ade80" : "#86EFAC") : UI.border,
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? (UI.isDark ? "#4ade80" : "#15803D") : UI.text }}>
                    {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}{player.playerName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Submit */}
        <TouchableOpacity
          onPress={() => canSubmit && onSubmit(playerOut, playerIn, onCourtPlayers)}
          disabled={!canSubmit}
          style={{
            backgroundColor: canSubmit ? "#6366f1" : "rgba(99,102,241,0.3)",
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
            Confirm Substitution
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


export default BasketballScoringPanelMobile;
