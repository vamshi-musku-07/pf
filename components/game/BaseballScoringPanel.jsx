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
import BaseballLineupSetup from "./BaseballLineupSetup";
import BaseballFieldMap from "./BaseballFieldMap";
import BaseballFieldingSetup from "./BaseballFieldingSetup";
import BaseballRunnerModal from "./BaseballRunnerModal";
import BaseballSubstitutionModal from "./BaseballSubstitutionModal";
import { BaseballTopPerformers } from "./BaseballScorecard";
import { fonts } from "@/constants/typography";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import {
  resolveScheduledInnings,
  resolveInningColumns,
  formatInningStatus,
} from "@/lib/baseballLineScore";

const FIELDING_POSITION_KEYS = new Set(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const MIN_LINEUP_PLAYERS = 9;

/** 3D pitch icons — ball / strike / foul only (transparent PNG). */
const BASEBALL_SCORE_ICONS = {
  ball: require("@/assets/images/baseball-scoring/thumbs/baseball-score-ball-v2.png"),
  strike: require("@/assets/images/baseball-scoring/thumbs/baseball-score-strike-v3.png"),
  foul: require("@/assets/images/baseball-scoring/thumbs/baseball-score-foul-v3.png"),
};

const EVENT_TYPE_TO_3D_ICON = {
  ball: "ball",
  strike: "strike",
  foul: "foul",
};

const raisedScoreShadow = (isDark) => ({
  shadowColor: isDark ? "#000" : "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: isDark ? 0.35 : 0.22,
  shadowRadius: 4,
  elevation: 5,
});

function BaseballScoreIcon({ name, size = 34 }) {
  const source = BASEBALL_SCORE_ICONS[name] || BASEBALL_SCORE_ICONS[EVENT_TYPE_TO_3D_ICON[name]];
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

function SetupCompleteTick({ size = 24 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="checkmark" size={size * 0.58} color="#fff" />
    </View>
  );
}

function isLineupBattingReady(lineup) {
  return Array.isArray(lineup) && lineup.length >= MIN_LINEUP_PLAYERS;
}

function isLineupFieldingReady(lineup) {
  if (!Array.isArray(lineup) || lineup.length === 0) return false;
  const positions = new Set(
    lineup.map((entry) => entry?.position).filter((pos) => FIELDING_POSITION_KEYS.has(pos)),
  );
  return positions.size >= MIN_LINEUP_PLAYERS;
}

function mergeFieldingIntoLineup(existingLineup, fieldPlayers) {
  const existing = Array.isArray(existingLineup) ? existingLineup : [];
  const field = Array.isArray(fieldPlayers) ? fieldPlayers : [];
  if (existing.length === 0) {
    return field.slice(0, MIN_LINEUP_PLAYERS);
  }
  const fieldByPlayerId = new Map(
    field.map((player) => [String(player.playerId), player]),
  );
  return existing.map((entry, index) => {
    const playerId = String(entry.playerId);
    const fieldPlayer = fieldByPlayerId.get(playerId);
    if (fieldPlayer) {
      return {
        ...entry,
        position: fieldPlayer.position,
        firstName: entry.firstName || fieldPlayer.firstName,
        lastName: entry.lastName ?? fieldPlayer.lastName,
        jerseyNumber: entry.jerseyNumber ?? fieldPlayer.jerseyNumber,
        battingOrder: entry.battingOrder || index + 1,
      };
    }
    return { ...entry, battingOrder: entry.battingOrder || index + 1 };
  });
}

const AT_BAT_ENDING_EVENTS = [
  "single", "double", "triple", "home_run",
  "walk", "intentional_walk", "hit_by_pitch",
  "strikeout", "strikeout_looking", "strikeout_swinging",
  "fly_out", "ground_out", "line_out", "pop_out",
  "double_play", "sacrifice_bunt", "sacrifice_fly",
];

const PITCH_TYPES = [
  { key: "fastball", label: "FB", color: "#ef4444" },
  { key: "curveball", label: "CB", color: "#a78bfa" },
  { key: "slider", label: "SL", color: "#60a5fa" },
  { key: "changeup", label: "CH", color: "#4ade80" },
  { key: "cutter", label: "CT", color: "#f97316" },
];

function BaseballScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onEvent,
  onSetupLineup,
  onSubstitution,
  onStartGame,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onEndGame,
  isSelfOwnedOpponent = false,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const [pendingEvent, setPendingEvent] = useState(null);
  const [setupOverlayMessage, setSetupOverlayMessage] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [currentBatter, setCurrentBatter] = useState(null);
  const [showLineupSetup, setShowLineupSetup] = useState(null);
  const [showFieldingSetup, setShowFieldingSetup] = useState(null);
  const [showFieldMap, setShowFieldMap] = useState(true);
  const [selectedPitchType, setSelectedPitchType] = useState(null);
  const [runnerModalData, setRunnerModalData] = useState(null);
  const [showSubstitution, setShowSubstitution] = useState(false);

  const sport = currentGame?.sport;
  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";

  const homeScore = sport?.score?.home || 0;
  const awayScore = sport?.score?.away || 0;
  const userScore = userIsHome ? homeScore : awayScore;
  const opponentScore = userIsHome ? awayScore : homeScore;
  const homeByInning = sport?.score?.byInning?.home || [];
  const awayByInning = sport?.score?.byInning?.away || [];
  const userByInning = userIsHome ? homeByInning : awayByInning;
  const opponentByInning = userIsHome ? awayByInning : homeByInning;

  const currentInning = sport?.currentInning || 1;
  const inningHalf = sport?.inningHalf || "top";
  const outs = sport?.outs || 0;
  const bases = sport?.bases || { first: false, second: false, third: false };
  const count = sport?.currentCount || { balls: 0, strikes: 0 };
  const matchStatus = sport?.matchStatus || "scheduled";
  const gStats = sport?.gameStats || {};
  const getStat = (key, side) => gStats?.[key]?.[side] || 0;

  const battingTeamSide = inningHalf === "top" ? "away" : "home";
  const userTeamName = userIsHome ? teamNames.home : teamNames.away;
  const opponentTeamName = userIsHome ? teamNames.away : teamNames.home;
  const battingTeamName =
    battingTeamSide === userSide ? userTeamName : opponentTeamName;

  const disabled = isUpdating || gameOver || matchStatus === "final";
  // Organizer-configured length (tournament rules copied onto the game); 9 for standalone games.
  const scheduledInnings = resolveScheduledInnings(sport?.rules?.scheduledInnings);
  // Extra innings push past the scheduled count, so the line score has to grow.
  const totalInnings = resolveInningColumns({
    homeByInning,
    awayByInning,
    currentInning,
    scheduledInnings,
  });
  const [showAdvanced, setShowAdvanced] = useState(true);
  const userIsBatting = battingTeamSide === userSide;
  const homeId = String(currentGame?.base?.teamId || "");
  const runnersOn =
    (bases?.first ? 1 : 0) + (bases?.second ? 1 : 0) + (bases?.third ? 1 : 0);

  // ── Lineup & batting order ──
  const homeLineup = sport?.homeLineup || [];
  const awayLineup = sport?.awayLineup || [];
  const battingLineup = battingTeamSide === "home" ? homeLineup : awayLineup;
  const fieldingTeamSide = battingTeamSide === "home" ? "away" : "home";
  const fieldingLineup = fieldingTeamSide === "home" ? homeLineup : awayLineup;
  const fieldingTeamName = fieldingTeamSide === userSide ? userTeamName : opponentTeamName;
  const canManageSide = (s) => (s === userSide && !displayOnly) || isSelfOwnedOpponent;
  const managedSides = isSelfOwnedOpponent ? ["home", "away"] : [userSide];
  const sideLineup = (side) => (side === "home" ? homeLineup : awayLineup);
  const batterIndex = sport?.currentBatterIndex?.[battingTeamSide] || 0;
  const hasLineup = battingLineup.length > 0;
  const allPlayersList = useMemo(
    () => [...(players?.home || []), ...(players?.away || [])],
    [players],
  );

  const getBaseRunner = (baseValue) => {
    if (!baseValue || baseValue === true) return null;
    return allPlayersList.find((p) => String(p._id || p.id) === String(baseValue));
  };

  const playerFullName = (p) => {
    if (!p) return "?";
    const name = `${p.firstName || ""}${p.lastName ? ` ${p.lastName}` : ""}`.trim();
    return name || `#${p.jerseyNumber || "?"}`;
  };

  const fieldingPositions = useMemo(() => {
    return fieldingLineup.map((entry) => {
      const pid = String(entry.playerId);
      const found = allPlayersList.find((p) => String(p._id || p.id) === pid);
      return {
        position: entry.position || "DH",
        playerId: pid,
        firstName: found?.firstName || "",
        lastName: found?.lastName || "",
        jerseyNumber: found?.jerseyNumber ?? entry.jerseyNumber,
      };
    });
  }, [fieldingLineup, allPlayersList]);

  const getLineupPlayer = (lineup, index) => {
    if (!lineup || lineup.length === 0 || index >= lineup.length) return null;
    const entry = lineup[index % lineup.length];
    const pid = String(entry.playerId);
    const found = allPlayersList.find((p) => String(p._id || p.id) === pid);
    return found ? {
      id: pid,
      name: `${found.firstName || ""}${found.lastName ? ` ${found.lastName}` : ""}`.trim(),
      jerseyNumber: found.jerseyNumber ?? entry.jerseyNumber,
      position: entry.position,
      battingOrder: entry.battingOrder || (index + 1),
    } : {
      id: pid,
      name: `Player #${index + 1}`,
      jerseyNumber: entry.jerseyNumber,
      position: entry.position,
      battingOrder: entry.battingOrder || (index + 1),
    };
  };

  const lineupBatter = hasLineup ? getLineupPlayer(battingLineup, batterIndex) : null;
  const lineupOnDeck = hasLineup ? getLineupPlayer(battingLineup, (batterIndex + 1) % battingLineup.length) : null;
  const lineupInHole = hasLineup && battingLineup.length > 2 ? getLineupPlayer(battingLineup, (batterIndex + 2) % battingLineup.length) : null;

  const activeBatter = hasLineup ? lineupBatter : currentBatter;

  const prevInningRef = useRef({ inning: currentInning, half: inningHalf });
  useEffect(() => {
    const prev = prevInningRef.current;
    if (prev.inning !== currentInning || prev.half !== inningHalf) {
      setCurrentBatter(null);
      prevInningRef.current = { inning: currentInning, half: inningHalf };
    }
  }, [currentInning, inningHalf]);

  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    const countReset = (prev.balls > 0 || prev.strikes > 0) &&
      count.balls === 0 && count.strikes === 0;
    if (countReset && currentBatter) {
      setCurrentBatter(null);
    }
    prevCountRef.current = count;
  }, [count, currentBatter]);

  // ── Events ──
  const allEvents = useMemo(
    () =>
      (sport?.events || []).filter(
        (e) => e != null && typeof e === "object" && e.eventType,
      ),
    [sport?.events],
  );
  const inningEvents = useMemo(() => {
    return allEvents
      .filter((e) => e.inning === currentInning && e.inningHalf === inningHalf)
      .slice(-8)
      .reverse();
  }, [allEvents, currentInning, inningHalf]);

  const gameHasStarted = allEvents.length > 0;
  const isSideSetupComplete = (side) =>
    isLineupBattingReady(sideLineup(side)) && isLineupFieldingReady(sideLineup(side));
  const preGameSetupComplete = managedSides.every(
    (side) => !canManageSide(side) || isSideSetupComplete(side),
  );
  const showMatchSetupScreen =
    !displayOnly &&
    matchStatus !== "final" &&
    !gameHasStarted &&
    managedSides.some((side) => canManageSide(side)) &&
    (!preGameSetupComplete || matchStatus === "scheduled");

  const handleConfirmAndStart = async () => {
    if (!onStartGame || !preGameSetupComplete || isUpdating) return;
    setSetupOverlayMessage("Starting game…");
    try {
      await onStartGame();
    } finally {
      setSetupOverlayMessage(null);
    }
  };

  const rosterForSide = (side) =>
    side === "home" ? players?.home || [] : players?.away || [];

  const lineupRosterForSide = (side) => {
    const lineup = sideLineup(side);
    const roster = rosterForSide(side);
    if (lineup.length < MIN_LINEUP_PLAYERS) return roster;
    return lineup.map((entry) => {
      const pid = String(entry.playerId);
      const found = roster.find((p) => String(p._id || p.id) === pid);
      if (found) return found;
      return {
        _id: pid,
        id: pid,
        firstName: entry.firstName || "",
        lastName: entry.lastName || "",
        jerseyNumber: entry.jerseyNumber,
      };
    });
  };

  const handleFieldingSetupConfirm = (data) => {
    if (!onSetupLineup || !data?.side) return;
    const existing = data.side === "home" ? homeLineup : awayLineup;
    const merged = mergeFieldingIntoLineup(existing, data.players);
    if (merged.length < 1 || merged.length > MIN_LINEUP_PLAYERS) {
      Alert.alert(
        "Invalid lineup",
        existing.length >= MIN_LINEUP_PLAYERS
          ? "Assign all 9 fielding positions using players from your batting order."
          : "Set your batting order first, then assign fielding positions.",
      );
      return;
    }
    onSetupLineup({ side: data.side, players: merged });
    setShowFieldingSetup(null);
  };

  if (showMatchSetupScreen) {
    const setupBusy = isUpdating || !!setupOverlayMessage;
    return (
      <View style={{ width: "100%", padding: 16, alignItems: "center" }}>
        {setupBusy && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.55)",
              zIndex: 20,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
            }}
          >
            <ActivityIndicator size="large" color="#47feb7" />
            <Text style={{ color: UI.text, fontWeight: "700", marginTop: 12, textAlign: "center", paddingHorizontal: 24 }}>
              {setupOverlayMessage || "Saving lineup…"}
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 18, fontWeight: "bold", color: UI.text, marginBottom: 8, marginTop: 8 }}>
          Complete Match Setup
        </Text>
        <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", marginBottom: 20, maxWidth: 320 }}>
          Set batting order and fielding positions before the first pitch. Fielding positions can be updated during the game.
        </Text>
        <View style={{ width: "100%", maxWidth: 320, gap: 16 }}>
          {managedSides.filter((side) => canManageSide(side)).map((side) => {
            const lineup = sideLineup(side);
            const teamLabel = side === userSide ? userTeamName : opponentTeamName;
            const battingReady = isLineupBattingReady(lineup);
            const fieldingReady = isLineupFieldingReady(lineup);
            return (
              <View key={side} style={{ gap: 10 }}>
                <Text
                  style={{
                    color: UI.text,
                    fontSize: 11,
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                  }}
                >
                  {teamLabel}
                </Text>
                <TouchableOpacity
                  disabled={isUpdating}
                  onPress={() => setShowLineupSetup(side)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: battingReady
                      ? (UI.isDark ? "rgba(34,197,94,0.14)" : "#DCFCE7")
                      : "#16a34a",
                    borderWidth: 1,
                    borderColor: battingReady
                      ? (UI.isDark ? "rgba(34,197,94,0.35)" : "#86EFAC")
                      : "transparent",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    opacity: isUpdating ? 0.5 : 1,
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: battingReady ? homeAccent : "#fff", fontWeight: "700", fontSize: 14 }}>
                      {battingReady ? "Batting Order Set" : "Set Batting Order"}
                    </Text>
                    <Text
                      style={{
                        color: battingReady
                          ? (UI.isDark ? "#86efac" : "#166534")
                          : "rgba(255,255,255,0.85)",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {battingReady ? "9 batters in order" : `Assign ${MIN_LINEUP_PLAYERS} batters`}
                    </Text>
                  </View>
                  {battingReady ? <SetupCompleteTick /> : null}
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={isUpdating || !battingReady}
                  onPress={() => {
                    if (!battingReady) {
                      Alert.alert("Batting order required", "Set the batting order before fielding positions.");
                      return;
                    }
                    setShowFieldingSetup(side);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: fieldingReady
                      ? (UI.isDark ? "rgba(34,197,94,0.14)" : "#DCFCE7")
                      : "#2563eb",
                    opacity: isUpdating || !battingReady ? 0.45 : 1,
                    borderWidth: 1,
                    borderColor: fieldingReady
                      ? (UI.isDark ? "rgba(34,197,94,0.35)" : "#86EFAC")
                      : "transparent",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: fieldingReady ? homeAccent : "#fff", fontWeight: "700", fontSize: 14 }}>
                      {fieldingReady ? "Fielding Positions Set" : "Set Fielding Positions"}
                    </Text>
                    <Text
                      style={{
                        color: fieldingReady
                          ? (UI.isDark ? "#86efac" : "#166534")
                          : "rgba(255,255,255,0.85)",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {fieldingReady ? "All 9 positions assigned" : "Assign P, C, IF, and OF"}
                    </Text>
                  </View>
                  {fieldingReady ? <SetupCompleteTick /> : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        {preGameSetupComplete && onStartGame ? (
          <TouchableOpacity
            onPress={handleConfirmAndStart}
            disabled={setupBusy}
            style={{
              width: "100%",
              maxWidth: 320,
              marginTop: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "#16a34a",
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderRadius: 12,
              opacity: setupBusy ? 0.55 : 1,
            }}
          >
            {setupOverlayMessage === "Starting game…" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="play" size={18} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              {setupOverlayMessage === "Starting game…" ? "Starting game…" : "Confirm & Start"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: UI.muted, fontSize: 13, textAlign: "center", marginTop: 20, maxWidth: 320 }}>
            Complete every step above before you can start the game.
          </Text>
        )}
        {showLineupSetup && onSetupLineup && (
          <BaseballLineupSetup
            visible={!!showLineupSetup}
            players={showLineupSetup === "home" ? (players?.home || []) : (players?.away || [])}
            existingLineup={showLineupSetup === "home" ? homeLineup : awayLineup}
            teamName={showLineupSetup === userSide ? userTeamName : opponentTeamName}
            side={showLineupSetup}
            onConfirm={(data) => {
              onSetupLineup(data);
              setShowLineupSetup(null);
            }}
            onCancel={() => setShowLineupSetup(null)}
          />
        )}
        {showFieldingSetup && onSetupLineup && (
          <BaseballFieldingSetup
            visible={!!showFieldingSetup}
            players={lineupRosterForSide(showFieldingSetup)}
            existingLineup={showFieldingSetup === "home" ? homeLineup : awayLineup}
            teamName={showFieldingSetup === userSide ? userTeamName : opponentTeamName}
            side={showFieldingSetup}
            requireFullFielding={isLineupBattingReady(showFieldingSetup === "home" ? homeLineup : awayLineup)}
            onConfirm={handleFieldingSetupConfirm}
            onCancel={() => setShowFieldingSetup(null)}
          />
        )}
      </View>
    );
  }

  // ── Event badge helper ──
  const getEventBadge = (type) => {
    switch (type) {
      case "ball":
        return { label: "B", bg: "#16a34a", text: "Ball" };
      case "strike":
        return { label: "S", bg: "#dc2626", text: "Strike" };
      case "foul":
        return { label: "F", bg: "#d97706", text: "Foul" };
      case "single":
        return { label: "1B", bg: "#47feb7", text: "Single" };
      case "double":
        return { label: "2B", bg: "#3b82f6", text: "Double" };
      case "triple":
        return { label: "3B", bg: "#60a5fa", text: "Triple" };
      case "home_run":
        return { label: "HR", bg: "#eab308", text: "Home Run" };
      case "walk":
        return { label: "BB", bg: "#0d9488", text: "Walk" };
      case "hit_by_pitch":
        return { label: "HBP", bg: "#c2410c", text: "Hit by Pitch" };
      case "strikeout":
      case "strikeout_looking":
      case "strikeout_swinging":
        return { label: "K", bg: "#dc2626", text: "Strikeout" };
      case "fly_out":
        return { label: "FO", bg: "#4b5563", text: "Fly Out" };
      case "ground_out":
        return { label: "GO", bg: "#6b7280", text: "Ground Out" };
      case "line_out":
        return { label: "LO", bg: "#6b7280", text: "Line Out" };
      case "pop_out":
        return { label: "PO", bg: "#6b7280", text: "Pop Out" };
      case "double_play":
        return { label: "DP", bg: "#b91c1c", text: "Double Play" };
      case "sacrifice_bunt":
        return { label: "SB", bg: "#4f46e5", text: "Sac Bunt" };
      case "sacrifice_fly":
        return { label: "SF", bg: "#6366f1", text: "Sac Fly" };
      case "stolen_base":
      case "stolen_base_2nd":
      case "stolen_base_3rd":
      case "stolen_base_home":
        return { label: "SB", bg: "#0891b2", text: "Stolen Base" };
      case "caught_stealing":
        return { label: "CS", bg: "#ef4444", text: "Caught Stealing" };
      case "error":
        return { label: "E", bg: "#c2410c", text: "Error" };
      case "wild_pitch":
        return { label: "WP", bg: "#f97316", text: "Wild Pitch" };
      case "passed_ball":
        return { label: "PB", bg: "#f97316", text: "Passed Ball" };
      case "balk":
        return { label: "BK", bg: "#c2410c", text: "Balk" };
      default:
        return {
          label: "•",
          bg: "#4b5563",
          text: type?.replace(/_/g, " ") || "Event",
        };
    }
  };

  // ── Player short name helper ──
  const getPlayerShort = (playerId) => {
    if (!playerId) return "—";
    const pid = String(playerId);
    const all = [...(players?.home || []), ...(players?.away || [])];
    const p = all.find((pl) => String(pl._id || pl.id) === pid);
    return p ? `${p.firstName || ""}${p.lastName ? ` ${p.lastName}` : ""}`.trim() : "—";
  };

  const getTeamPlayers = (side) =>
    (players?.[side] || []).filter((p) => p.role !== "manager");

  const PLAYER_EVENTS = [
    "single", "double", "triple", "home_run",
    "walk", "hit_by_pitch",
    "strikeout", "fly_out", "ground_out", "line_out", "pop_out",
    "double_play", "sacrifice_bunt", "sacrifice_fly",
    "stolen_base", "caught_stealing", "error",
    "ball", "strike", "foul",
  ];

  const PITCH_EVENTS = ["ball", "strike", "foul"];

  const submitEvent = (eventType, teamSide, playerId, extraData = {}) => {
    if (selectedPitchType) {
      extraData.pitchType = selectedPitchType;
    }
    const hasRunners = bases.first || bases.second || bases.third;
    const isHit = ["single", "double", "triple"].includes(eventType);
    if (isHit && hasRunners && !extraData.runnerAdvancement) {
      setRunnerModalData({ eventType, teamSide, playerId, extraData });
      return;
    }
    onEvent(eventType, teamSide, playerId, extraData);
    setPendingEvent(null);
    setSelectedTeam(null);
    setSelectedPitchType(null);
    if (!hasLineup && AT_BAT_ENDING_EVENTS.includes(eventType)) {
      setCurrentBatter(null);
    }
  };

  const handlePitchEvent = (pitchType) => {
    if (activeBatter) {
      submitEvent(pitchType, battingTeamSide, activeBatter.id);
    } else {
      setPendingEvent({ eventType: pitchType, step: "player", needsPlayer: true, isPitch: true });
      setSelectedTeam(battingTeamSide);
    }
  };

  const handleEventClick = (eventType, forcedTeam) => {
    if (forcedTeam) {
      setSelectedTeam(forcedTeam);
      if (PLAYER_EVENTS.includes(eventType)) {
        if (activeBatter && !PITCH_EVENTS.includes(eventType)) {
          submitEvent(eventType, forcedTeam, activeBatter.id);
        } else if (activeBatter && PITCH_EVENTS.includes(eventType)) {
          submitEvent(eventType, forcedTeam, activeBatter.id);
        } else {
          setPendingEvent({ eventType, step: "player", needsPlayer: true });
        }
      } else {
        const tp = getTeamPlayers(forcedTeam);
        submitEvent(eventType, forcedTeam, tp[0]?._id || tp[0]?.id);
      }
    } else {
      setPendingEvent({
        eventType,
        step: "team",
        needsPlayer: PLAYER_EVENTS.includes(eventType),
      });
    }
  };

  const handleTeamSelect = (side) => {
    setSelectedTeam(side);
    if (pendingEvent?.needsPlayer) {
      setPendingEvent({ ...pendingEvent, step: "player" });
    } else {
      const tp = getTeamPlayers(side);
      submitEvent(pendingEvent.eventType, side, tp[0]?._id || tp[0]?.id);
    }
  };

  const handlePlayerSelect = (player) => {
    const playerId = player._id || player.id;
    if (pendingEvent?.isPitch || PITCH_EVENTS.includes(pendingEvent?.eventType)) {
      setCurrentBatter({ id: playerId, name: `${player.firstName || ""}${player.lastName ? ` ${player.lastName}` : ""}`.trim(), jerseyNumber: player.jerseyNumber });
    }
    submitEvent(pendingEvent.eventType, selectedTeam, playerId);
  };

  const handleRunnerModalConfirm = (advancement) => {
    if (runnerModalData) {
      const { eventType, teamSide, playerId, extraData } = runnerModalData;
      onEvent(eventType, teamSide, playerId, { ...extraData, runnerAdvancement: advancement, pitchType: selectedPitchType || undefined });
      setPendingEvent(null);
      setSelectedTeam(null);
      setSelectedPitchType(null);
      if (!hasLineup && AT_BAT_ENDING_EVENTS.includes(eventType)) {
        setCurrentBatter(null);
      }
    }
    setRunnerModalData(null);
  };

  const getSubstitutionData = () => {
    const side = battingTeamSide;
    const lineup = (side === "home" ? homeLineup : awayLineup).map((entry) => {
      const pid = String(entry.playerId);
      const found = allPlayersList.find((p) => String(p._id || p.id) === pid);
      return {
        id: pid,
        name: found ? `${found.firstName || ""}${found.lastName ? ` ${found.lastName}` : ""}`.trim() : `Player`,
        jerseyNumber: found?.jerseyNumber ?? entry.jerseyNumber,
        position: entry.position || "—",
      };
    });
    const lineupIds = new Set(lineup.map((l) => l.id));
    const teamPlayers = players[side] || [];
    const bench = teamPlayers
      .filter((p) => !lineupIds.has(String(p._id || p.id)) && p.role !== "manager")
      .map((p) => ({
        id: String(p._id || p.id),
        name: `${p.firstName || ""}${p.lastName ? ` ${p.lastName}` : ""}`.trim(),
        jerseyNumber: p.jerseyNumber,
      }));
    return { lineup, bench, teamName: side === userSide ? userTeamName : opponentTeamName, side };
  };

  return (
    <View style={{ width: "100%" }}>
      {/* Game Over Banner */}
      {matchStatus === "final" && (
        <View style={{
          backgroundColor: "rgba(250,204,21,0.1)",
          borderWidth: 2,
          borderColor: "rgba(250,204,21,0.4)",
          borderRadius: 14,
          padding: 20,
          marginBottom: 16,
          alignItems: "center",
        }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#facc15" : "#B45309", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8 }}>
            Game Over
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: UI.muted, marginBottom: 2 }}>{userTeamName}</Text>
              <Text style={{ fontSize: 32, fontWeight: "900", color: userScore > opponentScore ? homeAccent : UI.muted }}>
                {userScore}
              </Text>
            </View>
            <Text style={{ fontSize: 18, color: UI.textMuted, fontWeight: "700" }}>—</Text>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: UI.muted, marginBottom: 2 }}>{opponentTeamName}</Text>
              <Text style={{ fontSize: 32, fontWeight: "900", color: opponentScore > userScore ? awayAccent : UI.muted }}>
                {opponentScore}
              </Text>
            </View>
          </View>
          {userScore !== opponentScore && (
            <Text style={{ fontSize: 12, fontWeight: "700", color: userScore > opponentScore ? homeAccent : awayAccent, marginTop: 8 }}>
              {userScore > opponentScore ? `${userTeamName} Win!` : `${opponentTeamName} Win!`}
            </Text>
          )}
          {sport?.result?.resultType && (
            <Text style={{ fontSize: 9, color: UI.muted, marginTop: 4 }}>
              {sport.result.resultType === "walk_off" ? "Walk-Off" : sport.result.resultType === "mercy" ? "Mercy Rule" : "Final"}
            </Text>
          )}
        </View>
      )}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: UI.border,
          marginBottom: 12,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor:
                matchStatus === "in_progress"
                  ? "rgba(34,197,94,0.2)"
                  : (UI.isDark ? "rgba(255,255,255,0.1)" : UI.border),
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: matchStatus === "in_progress" ? homeAccent : UI.muted,
              }}
            >
              {matchStatus === "in_progress"
                ? formatInningStatus({ currentInning, scheduledInnings, inningHalf })
                : matchStatus?.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              <View style={{ width: 72 }} />
              {Array.from({ length: totalInnings }, (_, i) => (
                <Text
                  key={i}
                  style={{
                    width: 24,
                    textAlign: "center",
                    fontSize: 9,
                    fontWeight: "700",
                    color: i + 1 === currentInning ? "#facc15" : "#4B5563",
                  }}
                >
                  {i + 1}
                </Text>
              ))}
              <Text
                style={{
                  width: 24,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: "700",
                  color: UI.muted,
                  marginLeft: 8,
                }}
              >
                R
              </Text>
              <Text
                style={{
                  width: 20,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: "700",
                  color: UI.muted,
                }}
              >
                H
              </Text>
              <Text
                style={{
                  width: 20,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: "700",
                  color: UI.muted,
                }}
              >
                E
              </Text>
            </View>
            {[
              {
                label: userTeamName,
                color: homeAccent,
                byInning: userByInning,
                score: userScore,
                side: userSide,
              },
              {
                label: opponentTeamName,
                color: awayAccent,
                byInning: opponentByInning,
                score: opponentScore,
                side: opponentSide,
              },
            ].map((row) => (
              <View
                key={row.side}
                style={{ flexDirection: "row", marginBottom: 3 }}
              >
                <Text
                  style={{
                    width: 72,
                    fontSize: 9,
                    fontWeight: "700",
                    color: row.color,
                    textTransform: "uppercase",
                  }}
                  numberOfLines={1}
                >
                  {row.label}
                </Text>
                {Array.from({ length: totalInnings }, (_, i) => (
                  <Text
                    key={i}
                    style={{
                      width: 24,
                      textAlign: "center",
                      fontSize: 11,
                      color:
                        i + 1 === currentInning
                          ? (UI.isDark ? "#facc15" : "#B45309")
                          : i + 1 > currentInning
                            ? UI.textMuted
                            : UI.muted,
                    }}
                  >
                    {row.byInning[i] !== undefined
                      ? row.byInning[i]
                      : i + 1 <= currentInning
                        ? "0"
                        : "–"}
                  </Text>
                ))}
                <Text
                  style={{
                    width: 24,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "700",
                    color: row.color,
                    marginLeft: 8,
                  }}
                >
                  {row.score}
                </Text>
                <Text
                  style={{
                    width: 20,
                    textAlign: "center",
                    fontSize: 11,
                    color: UI.muted,
                  }}
                >
                  {getStat("hits", row.side)}
                </Text>
                <Text
                  style={{
                    width: 20,
                    textAlign: "center",
                    fontSize: 11,
                    color: UI.muted,
                  }}
                >
                  {getStat("errors", row.side)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Diamond + Outs + Count */}
      {matchStatus === "in_progress" && (() => {
        // Light theme: elevated card ≈ empty chrome — use thicker slate borders + white fill.
        const emptyBorder = UI.isDark ? "rgba(255,255,255,0.4)" : "#64748B";
        const emptyFill = UI.isDark ? "rgba(255,255,255,0.06)" : "#FFFFFF";
        const occupiedJersey = "#0F172A";
        return (
        <View
          style={{
            backgroundColor: UI.cardElevated,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: UI.border,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 9,
                  color: UI.muted,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Bases
              </Text>
              <View style={{ width: 72, height: 72, position: "relative" }}>
                {/* 2nd base */}
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 26,
                    width: 20,
                    height: 20,
                    transform: [{ rotate: "45deg" }],
                    borderWidth: 2.5,
                    borderRadius: 2,
                    borderColor: bases.second ? "#facc15" : emptyBorder,
                    backgroundColor: bases.second ? "#eab308" : emptyFill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {bases.second && (
                    <Text style={{ fontSize: 7, color: occupiedJersey, fontWeight: "900", transform: [{ rotate: "-45deg" }] }}>
                      {getBaseRunner(bases.second)?.jerseyNumber ?? ""}
                    </Text>
                  )}
                </View>
                {/* 3rd base */}
                <View
                  style={{
                    position: "absolute",
                    top: 26,
                    left: 0,
                    width: 20,
                    height: 20,
                    transform: [{ rotate: "45deg" }],
                    borderWidth: 2.5,
                    borderRadius: 2,
                    borderColor: bases.third ? "#facc15" : emptyBorder,
                    backgroundColor: bases.third ? "#eab308" : emptyFill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {bases.third && (
                    <Text style={{ fontSize: 7, color: occupiedJersey, fontWeight: "900", transform: [{ rotate: "-45deg" }] }}>
                      {getBaseRunner(bases.third)?.jerseyNumber ?? ""}
                    </Text>
                  )}
                </View>
                {/* 1st base */}
                <View
                  style={{
                    position: "absolute",
                    top: 26,
                    right: 0,
                    width: 20,
                    height: 20,
                    transform: [{ rotate: "45deg" }],
                    borderWidth: 2.5,
                    borderRadius: 2,
                    borderColor: bases.first ? "#facc15" : emptyBorder,
                    backgroundColor: bases.first ? "#eab308" : emptyFill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {bases.first && (
                    <Text style={{ fontSize: 7, color: occupiedJersey, fontWeight: "900", transform: [{ rotate: "-45deg" }] }}>
                      {getBaseRunner(bases.first)?.jerseyNumber ?? ""}
                    </Text>
                  )}
                </View>
                {/* Home plate */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 26,
                    width: 16,
                    height: 16,
                    transform: [{ rotate: "45deg" }],
                    borderWidth: 2.5,
                    borderRadius: 2,
                    borderColor: emptyBorder,
                    backgroundColor: emptyFill,
                  }}
                />
              </View>
              {runnersOn > 0 && (
                <View style={{ marginTop: 4, alignItems: "center" }}>
                  {bases.first && (
                    <Text style={{ fontSize: 8, color: UI.isDark ? "#facc15" : "#B45309", fontWeight: "600" }}>
                      1B: {playerFullName(getBaseRunner(bases.first))}
                    </Text>
                  )}
                  {bases.second && (
                    <Text style={{ fontSize: 8, color: UI.isDark ? "#facc15" : "#B45309", fontWeight: "600" }}>
                      2B: {playerFullName(getBaseRunner(bases.second))}
                    </Text>
                  )}
                  {bases.third && (
                    <Text style={{ fontSize: 8, color: UI.isDark ? "#facc15" : "#B45309", fontWeight: "600" }}>
                      3B: {playerFullName(getBaseRunner(bases.third))}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 9,
                  color: UI.muted,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Outs
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 2.5,
                      borderColor: i < outs ? "#f87171" : emptyBorder,
                      backgroundColor: i < outs ? "#ef4444" : emptyFill,
                    }}
                  />
                ))}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: UI.text,
                  marginTop: 4,
                }}
              >
                {outs} / 3
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 9,
                  color: UI.muted,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Count
              </Text>
              <View style={{ gap: 4 }}>
                {/* Balls row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: homeAccent, width: 10 }}>B</Text>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={`b${i}`}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        borderWidth: 2.5,
                        borderColor: i < count.balls ? "#4ade80" : emptyBorder,
                        backgroundColor: i < count.balls ? "#22c55e" : emptyFill,
                      }}
                    />
                  ))}
                </View>
                {/* Strikes row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: awayAccent, width: 10 }}>S</Text>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={`s${i}`}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        borderWidth: 2.5,
                        borderColor: i < count.strikes ? "#f87171" : emptyBorder,
                        backgroundColor: i < count.strikes ? "#ef4444" : emptyFill,
                      }}
                    />
                  ))}
                </View>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: UI.text,
                  marginTop: 4,
                }}
              >
                <Text style={{ color: homeAccent }}>{count.balls}</Text>
                <Text style={{ color: UI.textMuted }}> - </Text>
                <Text style={{ color: awayAccent }}>{count.strikes}</Text>
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 9,
                  color: UI.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                {inningHalf === "top" ? "▲" : "▼"} At Bat
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: UI.text,
                  maxWidth: 64,
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {battingTeamName}
              </Text>
            </View>
          </View>
        </View>
        );
      })()}

  

      {/* ── GAME STATS ── */}
      {/* <View
        style={{
          backgroundColor: UI.cardElevated,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: UI.border,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: UI.muted,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontWeight: "600",
            marginBottom: 12,
          }}
        >
          Game Stats
        </Text>
        {[
          { label: "Hits", key: "hits" },
          { label: "Home Runs", key: "homeRuns" },
          { label: "Strikeouts", key: "strikeouts" },
          { label: "Walks", key: "walks" },
          { label: "Errors", key: "errors" },
        ].map(({ label, key }) => {
          const uVal = getStat(key, userSide);
          const oVal = getStat(key, opponentSide);
          const total = uVal + oVal || 1;
          return (
            <View
              key={key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  width: 20,
                  textAlign: "right",
                  fontWeight: "700",
                  color: homeAccent,
                  fontSize: 12,
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
                  textAlign: "left",
                  fontWeight: "700",
                  color: awayAccent,
                  fontSize: 12,
                }}
              >
                {oVal}
              </Text>
              <Text
                style={{ width: 80, fontSize: 10, color: UI.muted }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View> */}

      {/* ── Field Map: Current Defense ── */}
      {matchStatus === "in_progress" && fieldingLineup.length > 0 && (
        <View style={{ backgroundColor: UI.card, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: UI.border }}>
          <TouchableOpacity
            onPress={() => setShowFieldMap(!showFieldMap)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: showFieldMap ? 8 : 0 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="baseball-outline" size={14} color="#6B7280" />
              <Text style={{ fontSize: 10, color: UI.muted, textTransform: "uppercase", letterSpacing: 2, fontWeight: "700" }}>
                Fielding — {fieldingTeamName}
              </Text>
            </View>
            <Ionicons name={showFieldMap ? "chevron-up" : "chevron-down"} size={14} color="#6B7280" />
          </TouchableOpacity>
          {showFieldMap && (
            <>
              <BaseballFieldMap positions={fieldingPositions} compact />
              {canManageSide(fieldingTeamSide) && onSetupLineup && (
                <TouchableOpacity
                  onPress={() => setShowFieldingSetup(fieldingTeamSide)}
                  disabled={isUpdating}
                  style={{
                    backgroundColor: "rgba(59,130,246,0.1)",
                    borderWidth: 1,
                    borderColor: "rgba(59,130,246,0.2)",
                    borderRadius: 8,
                    paddingVertical: 8,
                    marginTop: 8,
                    alignItems: "center",
                    opacity: isUpdating ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: UI.isDark ? "#60a5fa" : "#2563EB", fontSize: 11, fontWeight: "700" }}>
                    Change Fielding Positions
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {!showFieldMap && canManageSide(fieldingTeamSide) && onSetupLineup && (
            <TouchableOpacity
              onPress={() => setShowFieldingSetup(fieldingTeamSide)}
              disabled={isUpdating}
              style={{ marginTop: 4, alignSelf: "flex-end", opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: UI.isDark ? "#60a5fa" : "#2563EB", fontSize: 10, fontWeight: "700" }}>Edit positions</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Scoring controls */}
      {!displayOnly && matchStatus !== "final" && (
        <View style={{ borderRadius: 12, padding: 12 }}>
          {/* ── Mini game situation ── */}

             {/* Mini Diamond */}
          {/* {!pendingEvent && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                backgroundColor: UI.cardElevated,
                borderRadius: 10,
                padding: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
             
                <View style={{ width: 48, height: 48, position: "relative" }}>
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 14,
                      width: 14,
                      height: 14,
                      transform: [{ rotate: "45deg" }],
                      borderWidth: 1.5,
                      borderRadius: 2,
                      borderColor: bases?.second
                        ? "#facc15"
                        : (UI.isDark ? "rgba(255,255,255,0.15)" : UI.border),
                      backgroundColor: bases?.second
                        ? "#eab308"
                        : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.cardElevated),
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 0,
                      width: 14,
                      height: 14,
                      transform: [{ rotate: "45deg" }],
                      borderWidth: 1.5,
                      borderRadius: 2,
                      borderColor: bases?.third
                        ? "#facc15"
                        : (UI.isDark ? "rgba(255,255,255,0.15)" : UI.border),
                      backgroundColor: bases?.third
                        ? "#eab308"
                        : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.cardElevated),
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 0,
                      width: 14,
                      height: 14,
                      transform: [{ rotate: "45deg" }],
                      borderWidth: 1.5,
                      borderRadius: 2,
                      borderColor: bases?.first
                        ? "#facc15"
                        : (UI.isDark ? "rgba(255,255,255,0.15)" : UI.border),
                      backgroundColor: bases?.first
                        ? "#eab308"
                        : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.cardElevated),
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 14,
                      width: 10,
                      height: 10,
                      transform: [{ rotate: "45deg" }],
                      borderWidth: 1.5,
                      borderRadius: 1,
                      borderColor: UI.border,
                      backgroundColor: UI.cardElevated,
                    }}
                  />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 9,
                      color: UI.muted,
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      fontWeight: "700",
                    }}
                  >
                    {inningHalf === "top" ? "▲" : "▼"} Inning {currentInning} ·{" "}
                    {battingTeamName} batting
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            borderWidth: 1.5,
                            borderColor:
                              i < outs ? "#f87171" : (UI.isDark ? "rgba(255,255,255,0.15)" : UI.border),
                            backgroundColor:
                              i < outs ? "#ef4444" : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.cardElevated),
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 10, color: UI.muted }}>
                      {outs} out{outs !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 18, fontWeight: "900" }}>
                  <Text style={{ color: homeAccent }}>{userScore}</Text>
                  <Text style={{ color: UI.textMuted }}> - </Text>
                  <Text style={{ color: awayAccent }}>{opponentScore}</Text>
                </Text>
              </View>
            </View>
          )} */}

          {/* ── SELECTION FLOW (inline) ── */}
          {pendingEvent && (
            <View style={{ marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: getEventBadge(pendingEvent.eventType).bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 9, fontWeight: "900", color: "#fff" }}
                    >
                      {getEventBadge(pendingEvent.eventType).label}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: UI.text }}
                  >
                    {getEventBadge(pendingEvent.eventType).text}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {pendingEvent.step === "team" && (
                      <Text style={{ fontSize: 9, color: UI.text }}>Team</Text>
                    )}
                    {pendingEvent.step === "player" && (
                      <>
                        <Text style={{ fontSize: 9, color: UI.muted }}>
                          Team
                        </Text>
                        <Text style={{ fontSize: 9, color: UI.muted }}>›</Text>
                        <Text style={{ fontSize: 9, color: UI.text, fontWeight: "700" }}>
                          Player
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setPendingEvent(null);
                    setSelectedTeam(null);
                  }}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: UI.cardElevated,
                  }}
                >
                  <Text style={{ fontSize: 12, color: UI.muted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {pendingEvent.step === "team" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleTeamSelect(userSide)}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(34,197,94,0.15)",
                      borderWidth: 1,
                      borderColor: "rgba(34,197,94,0.3)",
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: homeAccent,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
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
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: awayAccent,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {opponentTeamName}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {pendingEvent.step === "player" && selectedTeam && (
                <View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: UI.muted,
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      fontWeight: "700",
                      marginBottom: 8,
                    }}
                  >
                    {selectedTeam === userSide
                      ? userTeamName
                      : opponentTeamName}{" "}
                    — Select Batter
                  </Text>
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                    >
                      {getTeamPlayers(selectedTeam).map((p) => (
                        <TouchableOpacity
                          key={p._id || p.id}
                          onPress={() => handlePlayerSelect(p)}
                          style={{
                            backgroundColor: UI.cardElevated,
                            borderWidth: 1,
                            borderColor: UI.border,
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 8,
                            minWidth: "30%",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: UI.text,
                            }}
                            numberOfLines={1}
                          >
                            {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                            {p.firstName || ""}{p.lastName ? ` ${p.lastName}` : ""}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ── MAIN BUTTONS ── */}
          {!pendingEvent && (
            <>
              {/* ── PITCH COUNT (Ball / Strike / Foul) ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: "#4b5563" }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: "rgba(250,204,21,0.9)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  At Bat
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: "#4b5563" }}
                />
              </View>

              {/* Current batter indicator */}
              {hasLineup && lineupBatter ? (
                <View style={{ marginBottom: 10 }}>
                  {/* Current batter from lineup */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "rgba(250,204,21,0.1)",
                      borderWidth: 1,
                      borderColor: "rgba(250,204,21,0.3)",
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "rgba(250,204,21,0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: UI.isDark ? "#facc15" : "#B45309" }}>
                          {lineupBatter.battingOrder}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: UI.isDark ? "#facc15" : "#B45309" }}>
                          {lineupBatter.jerseyNumber ? `#${lineupBatter.jerseyNumber} ` : ""}
                          {lineupBatter.name}
                        </Text>
                        <Text style={{ fontSize: 9, color: UI.muted }}>
                          {lineupBatter.position} — {count.balls}-{count.strikes}
                        </Text>
                      </View>
                    </View>
                    {!gameHasStarted && onSetupLineup ? (
                      <TouchableOpacity
                        onPress={() => setShowLineupSetup(battingTeamSide)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="create-outline" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {/* On deck + In hole */}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {lineupOnDeck && (
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: UI.card,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ fontSize: 8, color: UI.muted, fontWeight: "700", textTransform: "uppercase" }}>On Deck</Text>
                        <Text style={{ fontSize: 10, color: UI.muted, fontWeight: "600" }} numberOfLines={1}>
                          {lineupOnDeck.jerseyNumber ? `#${lineupOnDeck.jerseyNumber} ` : ""}{lineupOnDeck.name}
                        </Text>
                      </View>
                    )}
                    {lineupInHole && (
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: UI.card,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ fontSize: 8, color: UI.textMuted, fontWeight: "700", textTransform: "uppercase" }}>In Hole</Text>
                        <Text style={{ fontSize: 10, color: UI.muted, fontWeight: "600" }} numberOfLines={1}>
                          {lineupInHole.jerseyNumber ? `#${lineupInHole.jerseyNumber} ` : ""}{lineupInHole.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : currentBatter ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(250,204,21,0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(250,204,21,0.25)",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="person" size={14} color="#facc15" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: UI.isDark ? "#facc15" : "#B45309" }}>
                      {currentBatter.jerseyNumber ? `#${currentBatter.jerseyNumber} ` : ""}
                      {currentBatter.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: UI.muted }}>
                      {count.balls}-{count.strikes}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCurrentBatter(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 11, color: UI.muted }}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginBottom: 10 }}>
                  {!gameHasStarted && onSetupLineup ? (
                    <TouchableOpacity
                      onPress={() => setShowLineupSetup(battingTeamSide)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        backgroundColor: "rgba(99,102,241,0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(99,102,241,0.3)",
                        borderRadius: 10,
                        paddingVertical: 10,
                      }}
                    >
                      <Ionicons name="list-outline" size={16} color="#818cf8" />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#818cf8" }}>
                        Set Batting Order
                      </Text>
                      <Text style={{ fontSize: 10, color: UI.muted }}>
                        (auto-advance batters)
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: UI.card,
                        borderWidth: 1,
                        borderColor: UI.border,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Ionicons name="person-outline" size={14} color={UI.muted} />
                      <Text style={{ fontSize: 11, color: UI.muted, marginLeft: 6 }}>
                        Tap Ball/Strike/Foul to select batter
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Pitch Type Selector */}
              <View style={{ flexDirection: "row", gap: 5, marginBottom: 10, justifyContent: "center" }}>
                {PITCH_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt.key}
                    onPress={() => setSelectedPitchType(selectedPitchType === pt.key ? null : pt.key)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: selectedPitchType === pt.key ? pt.color : (UI.isDark ? "rgba(255,255,255,0.1)" : UI.border),
                      backgroundColor: selectedPitchType === pt.key ? `${pt.color}22` : UI.cardElevated,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "800", color: selectedPitchType === pt.key ? pt.color : UI.muted }}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {selectedPitchType && (
                  <TouchableOpacity
                    onPress={() => setSelectedPitchType(null)}
                    style={{ paddingHorizontal: 6, justifyContent: "center" }}
                  >
                    <Ionicons name="close-circle" size={16} color={UI.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Ball / Strike / Foul — raised 3D */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {[
                  { type: "ball", label: "BALL", sub: `${count.balls} / 4`, icon: "ball", bg: "#16A34A", border: "#15803D", deep: "#166534", flex: 1 },
                  { type: "strike", label: "STRIKE", sub: `${count.strikes} / 3`, icon: "strike", bg: "#DC2626", border: "#B91C1C", deep: "#991B1B", flex: 1 },
                  { type: "foul", label: "FOUL", sub: count.strikes < 2 ? "+1 S" : "No S", icon: "foul", bg: "#D97706", border: "#B45309", deep: "#92400E", flex: 0.75 },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handlePitchEvent(btn.type)}
                    disabled={disabled}
                    style={{
                      flex: btn.flex,
                      backgroundColor: btn.bg,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: disabled ? 0.4 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <View style={{ height: 40, width: "100%", alignItems: "center", justifyContent: "center" }}>
                      <BaseballScoreIcon name={btn.icon} size={36} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff", marginTop: 4, textAlign: "center" }}>
                      {btn.label}
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginTop: 2, textAlign: "center" }}>
                      {btn.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── HITS ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: UI.border }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: UI.isDark ? "rgba(96,165,250,0.9)" : "#1D4ED8",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Hits
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: UI.border }}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { type: "single", label: "1B", sub: "Single", icon: "hit", bg: "#16A34A", border: "#15803D", deep: "#166534" },
                  { type: "double", label: "2B", sub: "Double", icon: "hit", bg: "#059669", border: "#047857", deep: "#065F46" },
                  { type: "triple", label: "3B", sub: "Triple", icon: "hit", bg: "#0D9488", border: "#0F766E", deep: "#115E59" },
                  { type: "home_run", label: "HR", sub: "Homer", icon: "home_run", bg: "#7C3AED", border: "#6D28D9", deep: "#5B21B6" },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handleEventClick(btn.type, battingTeamSide)}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      backgroundColor: btn.bg,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      borderRadius: 14,
                      paddingVertical: 10,
                      alignItems: "center",
                      opacity: disabled ? 0.4 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: "#fff",
                      }}
                    >
                      {btn.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: "700",
                        color: "rgba(255,255,255,0.85)",
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {btn.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Plate Discipline ── */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { type: "walk", label: "BB Walk", bg: "#0D9488", border: "#0F766E", deep: "#115E59" },
                  { type: "hit_by_pitch", label: "HBP", bg: "#EA580C", border: "#C2410C", deep: "#9A3412" },
                  { type: "sacrifice_fly", label: "SAC Fly", bg: "#4F46E5", border: "#4338CA", deep: "#3730A3" },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handleEventClick(btn.type, battingTeamSide)}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      backgroundColor: btn.bg,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: disabled ? 0.4 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: UI.border,
                  marginBottom: 12,
                }}
              />

              {/* ── OUTS ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: UI.border }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: UI.isDark ? "rgba(248,113,113,0.9)" : "#B91C1C",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Outs
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: UI.border }}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                {[
                  { type: "strikeout", label: "K", sub: "Strike", icon: "strike", bg: "#DC2626", border: "#B91C1C", deep: "#991B1B" },
                  { type: "fly_out", label: "Fly", sub: "Out", icon: "out", bg: "#EF4444", border: "#DC2626", deep: "#B91C1C" },
                  { type: "ground_out", label: "Grd", sub: "Out", icon: "out", bg: "#F04343", border: "#DC2626", deep: "#B91C1C" },
                  { type: "double_play", label: "DP", sub: "2 Out", icon: "out", bg: "#B91C1C", border: "#991B1B", deep: "#7F1D1D" },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handleEventClick(btn.type, battingTeamSide)}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      backgroundColor: btn.bg,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      borderRadius: 14,
                      paddingVertical: 10,
                      alignItems: "center",
                      opacity: disabled ? 0.4 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "900",
                        color: "#fff",
                      }}
                    >
                      {btn.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: "700",
                        color: "rgba(255,255,255,0.85)",
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {btn.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── ADVANCED: Base Running & Other ── */}
              <TouchableOpacity
                onPress={() => setShowAdvanced(!showAdvanced)}
                style={{
                  paddingVertical: 6,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 18, color: UI.muted }}>
                  {showAdvanced ? "▾" : "▸"}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: UI.muted,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Base Running & Other
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    paddingTop: 8,
                  }}
                >
                  {[
                    {
                      type: "stolen_base",
                      label: "SB Stolen Base",
                      color: "#22d3ee",
                    },
                    {
                      type: "caught_stealing",
                      label: "CS Caught",
                      color: awayAccent,
                    },
                    { type: "error", label: "E Error", color: "#fb923c" },
                    {
                      type: "wild_pitch",
                      label: "WP Wild Pitch",
                      color: "#fb923c",
                    },
                    {
                      type: "passed_ball",
                      label: "PB Passed Ball",
                      color: "#fb923c",
                    },
                    { type: "balk", label: "BK Balk", color: "#fb923c" },
                  ].map((btn) => (
                    <TouchableOpacity
                      key={btn.type}
                      onPress={() => handleEventClick(btn.type)}
                      disabled={disabled}
                      style={{
                        width: "31%",
                        backgroundColor: "#26293B",
                        borderWidth: 1,
                        borderColor: "#4b5563",
                        borderRadius: 4,
                        paddingVertical: 8,
                        alignItems: "center",
                        opacity: disabled ? 0.4 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: btn.color,
                        }}
                      >
                        {btn.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {/* Substitution button */}
                  {onSubstitution && hasLineup && (
                    <TouchableOpacity
                      onPress={() => setShowSubstitution(true)}
                      disabled={disabled}
                      style={{
                        width: "31%",
                        backgroundColor: "#1e3a5f",
                        borderWidth: 1,
                        borderColor: "#3b82f6",
                        borderRadius: 4,
                        paddingVertical: 8,
                        alignItems: "center",
                        opacity: disabled ? 0.4 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#93c5fd" }}>
                        SUB
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}


   <View className="mt-7">
        {/* ── INNING EVENT LOG ── */}
      {inningEvents.length > 0 && (
        <View
          style={{
            backgroundColor: UI.cardElevated,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.border,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: UI.muted,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            {inningHalf === "top" ? "▲" : "▼"} Inning {currentInning}
          </Text>
          <View style={{ maxHeight: 140 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {inningEvents.map((e, i) => {
                const badge = getEventBadge(e?.eventType);
                const eIsHome = String(e?.teamId) === homeId;
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
                      marginBottom: 2,
                      backgroundColor: eIsUser
                        ? "rgba(34,197,94,0.05)"
                        : "rgba(239,68,68,0.05)",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        backgroundColor: badge.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 7,
                          fontWeight: "900",
                          color: "#fff",
                        }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: UI.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {getPlayerShort(e?.playerId)}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: UI.textMuted }}
                      numberOfLines={1}
                    >
                      {badge.text}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
   </View>

          
        </View>
      )}

      <BaseballTopPerformers
        currentGame={currentGame}
        players={players}
        teamNames={{ home: teamNames?.home || "Home", away: teamNames?.away || "Away" }}
      />

      {showLineupSetup && onSetupLineup && (
        <BaseballLineupSetup
          visible={!!showLineupSetup}
          players={showLineupSetup === "home" ? (players?.home || []) : (players?.away || [])}
          existingLineup={showLineupSetup === "home" ? homeLineup : awayLineup}
          teamName={showLineupSetup === userSide ? userTeamName : opponentTeamName}
          side={showLineupSetup}
          onConfirm={(data) => { onSetupLineup(data); setShowLineupSetup(null); }}
          onCancel={() => setShowLineupSetup(null)}
        />
      )}

      {showFieldingSetup && onSetupLineup && (
        <BaseballFieldingSetup
          visible={!!showFieldingSetup}
          players={lineupRosterForSide(showFieldingSetup)}
          existingLineup={showFieldingSetup === "home" ? homeLineup : awayLineup}
          teamName={showFieldingSetup === userSide ? userTeamName : opponentTeamName}
          side={showFieldingSetup}
          requireFullFielding={isLineupBattingReady(showFieldingSetup === "home" ? homeLineup : awayLineup)}
          onConfirm={handleFieldingSetupConfirm}
          onCancel={() => setShowFieldingSetup(null)}
        />
      )}

      {/* Runner Advancement Modal */}
      {runnerModalData && (
        <BaseballRunnerModal
          visible={!!runnerModalData}
          hitType={runnerModalData.eventType}
          bases={bases}
          getRunnerName={(pid) => playerFullName(getBaseRunner(pid))}
          onConfirm={handleRunnerModalConfirm}
          onCancel={() => setRunnerModalData(null)}
        />
      )}

      {/* Substitution Modal */}
      {showSubstitution && onSubstitution && (() => {
        const subData = getSubstitutionData();
        return (
          <BaseballSubstitutionModal
            visible
            lineup={subData.lineup}
            benchPlayers={subData.bench}
            teamName={subData.teamName}
            onConfirm={({ playerOutId, playerInId, position }) => {
              onSubstitution(subData.side, playerOutId, playerInId, { position });
              setShowSubstitution(false);
            }}
            onCancel={() => setShowSubstitution(false)}
          />
        );
      })()}
    </View>
  );
}

/** Black flip-card digits with silver binder rings (manual tally board). */
function BaseballFlipDigits({ value = 0, digitColor = "#FFFFFF", compact = false }) {
  const digits = String(Math.max(0, Math.min(99, Number(value) || 0))).padStart(2, "0").split("");
  const tileW = compact ? 34 : 42;
  const tileH = compact ? 48 : 60;
  const fontSize = compact ? 32 : 42;
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
                  backgroundColor: "#E5E7EB",
                  borderWidth: 1.5,
                  borderColor: "#9CA3AF",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
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
              backgroundColor: "#111827",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#1F2937",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 3,
              elevation: 4,
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
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Flip-tile scoreboard — lime left / white right on black cards. */
export function BaseballScoreboardCard({
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
  periodLabel = "Inning 1",
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
          <BaseballFlipDigits value={userScore} digitColor="#D4FF00" compact={compact} />
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Text style={{ fontSize: compact ? 22 : 26, marginBottom: 2 }}>⚾</Text>
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
          <BaseballFlipDigits value={oppScore} digitColor="#FFFFFF" compact={compact} />
        </View>
      </View>
    </View>
  );
}

export default BaseballScoringPanelMobile;
