import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

/** 3D raised look — keeps face colors; only adds depth rim + shadow. */
function raised3d(deep, extra = {}) {
  return {
    borderBottomWidth: 4,
    borderBottomColor: deep,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    ...extra,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (m, s) =>
  `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

const ORDINAL_LABEL = { 1: "1ST", 2: "2ND", 3: "3RD", 4: "4TH", 5: "5TH", 6: "6TH" };
const DEFAULT_HOCKEY_MATCH_FORMAT = { structureType: "quarters", periodCount: 4, periodDurationMinutes: 15, label: null };

const normalizeHockeyMatchFormat = (matchFormat) => {
  if (!matchFormat) return DEFAULT_HOCKEY_MATCH_FORMAT;
  if (typeof matchFormat === "string") {
    if (matchFormat === "halves_35" || matchFormat === "2_halves") {
      return { structureType: "halves", periodCount: 2, periodDurationMinutes: 35, label: "2 halves" };
    }
    return DEFAULT_HOCKEY_MATCH_FORMAT;
  }
  return {
    structureType: matchFormat.structureType === "halves" ? "halves" : "quarters",
    periodCount: Number(matchFormat.periodCount) || (matchFormat.structureType === "halves" ? 2 : 4),
    periodDurationMinutes: Number(matchFormat.periodDurationMinutes) || 15,
    label: matchFormat.label || null,
  };
};

const getHockeyPeriodTypeLabel = (matchFormat) => (matchFormat?.structureType === "halves" ? "Half" : "Quarter");
const getHockeyShortPeriodLabel = (period, matchFormat) => `${matchFormat?.structureType === "halves" ? "H" : "Q"}${period}`;
const getHockeyPeriodLabel = (period, matchFormat, isOT) => {
  if (isOT) return "OT";
  const suffix = getHockeyPeriodTypeLabel(matchFormat).toUpperCase();
  return `${ORDINAL_LABEL[period] || `${period}TH`} ${suffix}`;
};

const CARD_OPTIONS = [
  { type: "green_card",  label: "Green",  color: "#4CAF50", suspension: "2 min" },
  { type: "yellow_card", label: "Yellow", color: "#FFEB3B", suspension: "5 min" },
  { type: "red_card",    label: "Red",    color: "#F44336", suspension: "Perm" },
];

const EXTRA_EVENT_OPTIONS = [
  { type: "foul", label: "Foul", caption: "Core Event", icon: "warning-outline", color: "#f97316" },
  { type: "free_hit", label: "Free Hit", caption: "Restart", icon: "flash-outline", color: "#38bdf8" },
  { type: "save", label: "Save", caption: "Defence", icon: "hand-left-outline", color: "#22c55e" },
  { type: "shot_missed", label: "Shot Missed", caption: "Attempt", icon: "close-circle-outline", color: "#f87171" },
  { type: "long_corner", label: "Long Corner", caption: "Restart", icon: "return-up-forward-outline", color: "#fbbf24" },
  { type: "sixteen_yard_hit", label: "16-Yard Hit", caption: "Restart", icon: "map-outline", color: "#a78bfa" },
];

const HOCKEY_EVENT_LABELS = {
  goal: "Goal",
  penalty_corner: "Penalty Corner",
  penalty_stroke: "Penalty Stroke",
  green_card: "Green Card",
  yellow_card: "Yellow Card",
  red_card: "Red Card",
  substitution: "Substitution",
  possession_change: "Possession",
  period_end: "End Period",
  quarter_break: "End Period",
  foul: "Foul",
  free_hit: "Free Hit",
  save: "Save",
  shot_missed: "Shot Missed",
  long_corner: "Long Corner",
  sixteen_yard_hit: "16-Yard Hit",
};

const TEAM_FIRST_EVENT_TYPES = new Set(["foul", "free_hit", "shot_missed", "long_corner", "sixteen_yard_hit"]);

const HOCKEY_EVENT_VISUALS = {
  goal: {
    icon: "trophy-outline",
    dark: { color: "#47feb7", background: "rgba(71,254,183,0.08)", border: "rgba(71,254,183,0.24)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  penalty_corner: {
    icon: "football-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
  penalty_stroke: {
    icon: "disc-outline",
    dark: { color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.22)" },
    light: { color: "#4338CA", background: "#E0E7FF", border: "#A5B4FC" },
  },
  green_card: {
    icon: "card-outline",
    dark: { color: "#4CAF50", background: "rgba(76,175,80,0.09)", border: "rgba(76,175,80,0.25)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  yellow_card: {
    icon: "card-outline",
    dark: { color: "#facc15", background: "rgba(250,204,21,0.09)", border: "rgba(250,204,21,0.25)" },
    light: { color: "#A16207", background: "#FEF9C3", border: "#FDE047" },
  },
  red_card: {
    icon: "card-outline",
    dark: { color: "#f87171", background: "rgba(248,113,113,0.09)", border: "rgba(248,113,113,0.24)" },
    light: { color: "#B91C1C", background: "#FEE2E2", border: "#FCA5A5" },
  },
  substitution: {
    icon: "swap-horizontal-outline",
    dark: { color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.22)" },
    light: { color: "#1D4ED8", background: "#DBEAFE", border: "#93C5FD" },
  },
  foul: {
    icon: "warning-outline",
    dark: { color: "#f97316", background: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)" },
    light: { color: "#C2410C", background: "#FFEDD5", border: "#FDBA74" },
  },
  free_hit: {
    icon: "flash-outline",
    dark: { color: "#38bdf8", background: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.22)" },
    light: { color: "#0369A1", background: "#E0F2FE", border: "#7DD3FC" },
  },
  save: {
    icon: "hand-left-outline",
    dark: { color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  shot_missed: {
    icon: "close-circle-outline",
    dark: { color: "#f87171", background: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.22)" },
    light: { color: "#B91C1C", background: "#FEE2E2", border: "#FCA5A5" },
  },
  long_corner: {
    icon: "return-up-forward-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
  sixteen_yard_hit: {
    icon: "map-outline",
    dark: { color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.22)" },
    light: { color: "#4338CA", background: "#E0E7FF", border: "#A5B4FC" },
  },
  period_end: {
    icon: "pause-circle-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
  quarter_break: {
    icon: "pause-circle-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
};

const getHockeyEventLabel = (eventType) => HOCKEY_EVENT_LABELS[eventType] || String(eventType || "Event").replace(/_/g, " ");
const getHockeyEventVisual = (eventType, isDark = true) => {
  const preset = HOCKEY_EVENT_VISUALS[eventType];
  if (preset) {
    return { icon: preset.icon, ...(isDark ? preset.dark : preset.light) };
  }
  return isDark
    ? { icon: "ellipse-outline", color: "#dfe1f9", background: "#171a2c", border: "rgba(255,255,255,0.05)" }
    : { icon: "ellipse-outline", color: "#111827", background: "#F3F4F6", border: "#E5E7EB" };
};

const MAX_ON_FIELD_PLAYERS = 11;

const getPlayerId = (player) => player?._id || player?.id || null;

const getPlayerName = (player) => {
  if (!player) return "Unknown Player";
  if (player._id === "__no_out__") return "Add player without subbing out";
  const fullName = `${player.firstName || ""} ${player.lastName || ""}`.trim();
  return fullName || player.name || "Unknown Player";
};

const getClockSeconds = (gameTime, periodDurationMinutes = 15) => {
  const minutes = Number(gameTime?.minutes ?? periodDurationMinutes);
  const seconds = Number(gameTime?.seconds ?? 0);
  return Math.max(0, (Number.isFinite(minutes) ? minutes : periodDurationMinutes) * 60 + (Number.isFinite(seconds) ? seconds : 0));
};

const getElapsedSeconds = (period, gameTime, periodDurationMinutes = 15) => {
  const durationSeconds = periodDurationMinutes * 60;
  return ((Math.max(1, Number(period) || 1) - 1) * durationSeconds) + (durationSeconds - getClockSeconds(gameTime, periodDurationMinutes));
};

const buildFallbackLineupSide = (teamPlayers) => {
  const ids = (teamPlayers || []).map(getPlayerId).filter(Boolean);
  return {
    onFieldPlayerIds: ids.slice(0, MAX_ON_FIELD_PLAYERS),
    benchPlayerIds: ids.slice(MAX_ON_FIELD_PLAYERS),
  };
};

const formatRemainingTime = (remainingSeconds) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getHockeySuspensionStartedAt = (suspension) => {
  if (suspension?.startedElapsedSeconds != null && Number.isFinite(Number(suspension.startedElapsedSeconds))) {
    return Number(suspension.startedElapsedSeconds);
  }

  if (suspension?.expiresAtElapsedSeconds != null && suspension?.durationSeconds != null) {
    return Number(suspension.expiresAtElapsedSeconds) - Number(suspension.durationSeconds);
  }

  return -1;
};

const getExpectedHockeySuspensionDuration = (suspension) => {
  if (suspension?.durationSeconds != null && Number.isFinite(Number(suspension.durationSeconds))) {
    return Number(suspension.durationSeconds);
  }

  if (suspension?.cardType === "green_card") return 2 * 60;
  if (suspension?.cardType === "yellow_card") return 5 * 60;
  return null;
};

const getHockeySuspensionRemainingSeconds = (suspension, currentElapsedSeconds, currentQuarter, currentClockSeconds, nowMs = Date.now()) => {
  if (suspension?.isPermanent) return null;

  const durationSeconds = getExpectedHockeySuspensionDuration(suspension);

  // Prefer wall-clock when suspensionStartedAt is available — survives reloads and paused clocks
  if (durationSeconds != null && suspension?.suspensionStartedAt) {
    const startMs = typeof suspension.suspensionStartedAt === 'number'
      ? suspension.suspensionStartedAt
      : new Date(suspension.suspensionStartedAt).getTime();
    if (Number.isFinite(startMs)) {
      return Math.max(0, durationSeconds - Math.floor((nowMs - startMs) / 1000));
    }
  }

  const startedAt = getHockeySuspensionStartedAt(suspension);

  if (
    durationSeconds != null
    && Number.isFinite(Number(currentClockSeconds))
    && Number.isFinite(Number(suspension?.startedClockSeconds))
    && Number(suspension?.startedQuarter) === Number(currentQuarter)
  ) {
    return Math.max(0, durationSeconds - Math.max(0, Number(suspension.startedClockSeconds) - Number(currentClockSeconds)));
  }

  if (durationSeconds != null && startedAt >= 0) {
    return Math.max(0, durationSeconds - Math.max(0, currentElapsedSeconds - startedAt));
  }

  if (suspension?.expiresAtElapsedSeconds != null) {
    return Math.max(0, Number(suspension.expiresAtElapsedSeconds) - currentElapsedSeconds);
  }

  return 0;
};

const getHockeySuspensionTimerColor = (cardType) => {
  if (cardType === "green_card") return "#4ade80";
  if (cardType === "yellow_card") return "#facc15";
  if (cardType === "red_card") return "#f87171";
  return "#dfe1f9";
};

const getHockeyReleasedSuspensionKey = (suspension) => [
  String(suspension?.suspensionKey || [
    String(suspension?.teamSide || "home"),
    String(suspension?.playerId || ""),
    String(suspension?.cardType || ""),
    String(suspension?.startedQuarter ?? "na"),
    String(suspension?.startedClockSeconds ?? "na"),
    String(suspension?.expiresAtElapsedSeconds ?? "na"),
  ].join(":")),
  String(suspension?.releasedElapsedSeconds ?? "na"),
].join(":");

const getHockeyReturnPlayerKey = (suspensionOrTeamSide, playerId) => {
  if (suspensionOrTeamSide && typeof suspensionOrTeamSide === "object") {
    const suspension = suspensionOrTeamSide;
    return String(suspension?.suspensionKey || [
      String(suspension?.teamSide || "home"),
      String(suspension?.playerId || ""),
      String(suspension?.cardType || ""),
      String(suspension?.startedElapsedSeconds ?? "na"),
      String(suspension?.startedQuarter ?? "na"),
      String(suspension?.startedClockSeconds ?? "na"),
      String(suspension?.expiresAtElapsedSeconds ?? "na"),
    ].join(":"));
  }

  return `${String(suspensionOrTeamSide || "home")}:${String(playerId || "")}`;
};

// ─── Scoreboard Card (can be used standalone as sticky header) ────────────────
export function HockeyScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
  players = { home: [], away: [] },
  gameTime,
  displayOnly = false,
  isUpdating,
  gameOver,
  isScheduled = false,
  isOwner = false,
  userSide = "home",
  isSelfOwnedOpponent = false,
  onPauseResume,
  onEndGame,
  onStartGame,
  onSaveLineup,
}) {
  const homeScore = sport?.score?.home ?? 0;
  const awayScore = sport?.score?.away ?? 0;
  const matchFormat = useMemo(() => normalizeHockeyMatchFormat(sport?.matchFormat), [sport?.matchFormat]);
  const currentQuarter = sport?.currentQuarter ?? sport?.currentPeriod ?? 1;
  const isOvertime = sport?.isOvertime ?? false;
  const homePC = sport?.penaltyCorners?.home ?? 0;
  const awayPC = sport?.penaltyCorners?.away ?? 0;
  const homePS = sport?.penaltyStrokes?.home ?? 0;
  const awayPS = sport?.penaltyStrokes?.away ?? 0;
  const homeCards = sport?.cards?.home ?? { green: 0, yellow: 0, red: 0 };
  const awayCards = sport?.cards?.away ?? { green: 0, yellow: 0, red: 0 };
  const quarterLabel = getHockeyPeriodLabel(currentQuarter, matchFormat, isOvertime);
  const [showLineupSetup, setShowLineupSetup] = useState(false);
  const [setupSide, setSetupSide] = useState("home");
  const [matchFormatDraft, setMatchFormatDraft] = useState(matchFormat);
  const [lineupSetupView, setLineupSetupView] = useState("field");
  const [showFormatSetup, setShowFormatSetup] = useState(false);
  // Pre-arm the lineup-prompt guard if the game already has a saved lineup when
  // the panel mounts. Without this, an undo operation that removes the only event
  // temporarily leaves the optimistic sport state with empty lineups (replayHockeySport
  // starts from a clean slate). That makes `needsManagedLineupSetup` flip to true and
  // the setup modal opens unexpectedly. If the game already had a valid lineup we should
  // never auto-open the modal again for this session.
  const lineupPromptedRef = useRef(
    !!((sport?.lineups?.home?.onFieldPlayerIds?.length ?? 0)
      + (sport?.lineups?.home?.benchPlayerIds?.length ?? 0)
      + (sport?.lineups?.away?.onFieldPlayerIds?.length ?? 0)
      + (sport?.lineups?.away?.benchPlayerIds?.length ?? 0)),
  );
  const manageableSides = useMemo(() => (isSelfOwnedOpponent ? ["home", "away"] : [userSide]), [isSelfOwnedOpponent, userSide]);
  const missingManagedSides = useMemo(() => manageableSides.filter((side) => {
    const rosterSize = (players?.[side] || []).map(getPlayerId).filter(Boolean).length;
    if (rosterSize === 0) return false;
    const storedSide = sport?.lineups?.[side];
    const storedCount = (storedSide?.onFieldPlayerIds?.length || 0) + (storedSide?.benchPlayerIds?.length || 0);
    return storedCount === 0;
  }), [manageableSides, players, sport?.lineups]);
  const needsManagedLineupSetup = isOwner && missingManagedSides.length > 0;

  const initialLineupDraft = useMemo(() => {
    const fallback = {
      home: buildFallbackLineupSide(players?.home || []),
      away: buildFallbackLineupSide(players?.away || []),
    };

    return ["home", "away"].reduce((accumulator, side) => {
      const storedSide = sport?.lineups?.[side];
      const fallbackSide = fallback[side];
      const onFieldPlayerIds = (storedSide?.onFieldPlayerIds?.length ? storedSide.onFieldPlayerIds : fallbackSide.onFieldPlayerIds)
        .map(String)
        .filter(Boolean);
      const benchPlayerIds = (storedSide?.benchPlayerIds?.length ? storedSide.benchPlayerIds : fallbackSide.benchPlayerIds)
        .map(String)
        .filter((playerId) => playerId && !onFieldPlayerIds.includes(playerId));
      accumulator[side] = { onFieldPlayerIds, benchPlayerIds };
      return accumulator;
    }, {});
  }, [players, sport?.lineups]);

  const [lineupDraft, setLineupDraft] = useState(initialLineupDraft);

  useEffect(() => {
    if (!showLineupSetup) {
      setLineupDraft(initialLineupDraft);
      setMatchFormatDraft(matchFormat);
      setLineupSetupView("field");
      setShowFormatSetup(false);
    }
  }, [initialLineupDraft, matchFormat, showLineupSetup]);

  useEffect(() => {
    if (!manageableSides.includes(setupSide)) {
      setSetupSide(manageableSides[0] || "home");
    }
  }, [manageableSides, setupSide]);

  useEffect(() => {
    if (isScheduled || displayOnly || !needsManagedLineupSetup || showLineupSetup || lineupPromptedRef.current) {
      return;
    }

    lineupPromptedRef.current = true;
    setLineupDraft(initialLineupDraft);
    setSetupSide(missingManagedSides[0] || manageableSides[0] || "home");
    setLineupSetupView("field");
    setShowFormatSetup(false);
    setShowLineupSetup(true);
  }, [displayOnly, initialLineupDraft, isScheduled, manageableSides, missingManagedSides, needsManagedLineupSetup, showLineupSetup]);

  const movePlayerBetweenGroups = (side, playerId, targetGroup) => {
    setLineupDraft((current) => {
      const sideDraft = current?.[side] || { onFieldPlayerIds: [], benchPlayerIds: [] };
      const onFieldPlayerIds = sideDraft.onFieldPlayerIds.filter((id) => String(id) !== String(playerId));
      const benchPlayerIds = sideDraft.benchPlayerIds.filter((id) => String(id) !== String(playerId));

      if (targetGroup === "field") {
        const rosterSize = onFieldPlayerIds.length + benchPlayerIds.length + 1;
        const allowedOnField = Math.min(MAX_ON_FIELD_PLAYERS, rosterSize);
        if (onFieldPlayerIds.length >= allowedOnField) {
          return current;
        }
        onFieldPlayerIds.push(String(playerId));
      } else {
        benchPlayerIds.push(String(playerId));
      }

      return {
        ...current,
        [side]: {
          onFieldPlayerIds,
          benchPlayerIds,
        },
      };
    });
  };

  const resetSideLineup = (side) => {
    const fallbackSide = buildFallbackLineupSide(players?.[side] || []);
    setLineupDraft((current) => ({
      ...current,
      [side]: {
        onFieldPlayerIds: fallbackSide.onFieldPlayerIds.map(String),
        benchPlayerIds: fallbackSide.benchPlayerIds.map(String),
      },
    }));
  };

  const autofillSideLineup = (side) => {
    const sidePlayers = (players?.[side] || []).map(getPlayerId).filter(Boolean).map(String);
    setLineupDraft((current) => ({
      ...current,
      [side]: {
        onFieldPlayerIds: sidePlayers.slice(0, MAX_ON_FIELD_PLAYERS),
        benchPlayerIds: sidePlayers.slice(MAX_ON_FIELD_PLAYERS),
      },
    }));
  };

  const getDraftPlayersForGroup = (side, group) => {
    const sidePlayers = players?.[side] || [];
    const groupIds = lineupDraft?.[side]?.[group === "field" ? "onFieldPlayerIds" : "benchPlayerIds"] || [];
    return groupIds
      .map((playerId) => sidePlayers.find((player) => String(getPlayerId(player)) === String(playerId)) || { _id: playerId, firstName: "Player", lastName: String(playerId).slice(-4) })
      .filter(Boolean);
  };

  const renderDraftPlayerCard = (player, side, isField) => {
    const playerId = getPlayerId(player);
    return (
      <TouchableOpacity
        key={`${side}-${isField ? "field" : "bench"}-${playerId}`}
        onPress={() => movePlayerBetweenGroups(side, playerId, isField ? "bench" : "field")}
        style={{
          width: "31.5%",
          backgroundColor: "#171a2c",
          borderWidth: 1,
          borderColor: isField ? "rgba(71,254,183,0.16)" : "rgba(96,165,250,0.16)",
          borderRadius: 14,
          paddingHorizontal: 8,
          paddingVertical: 10,
          marginBottom: 8,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            marginBottom: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isField ? "rgba(71,254,183,0.15)" : "rgba(96,165,250,0.15)",
          }}>
            <Text style={{ color: isField ? "#47feb7" : "#93c5fd", fontWeight: "900", fontSize: 10 }}>
              {player?.jerseyNumber || "#"}
            </Text>
          </View>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11, textAlign: "center", minHeight: 28 }} numberOfLines={2}>
            {getPlayerName(player)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, backgroundColor: isField ? "rgba(96,165,250,0.12)" : "rgba(71,254,183,0.12)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 }}>
            <Ionicons name={isField ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} size={12} color={isField ? "#60a5fa" : "#47feb7"} />
            <Text style={{ color: isField ? "#93c5fd" : "#6ee7b7", fontSize: 9, fontWeight: "800", marginLeft: 3 }}>
              {isField ? "Bench" : "Start"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLineupSetupSection = (side, group) => {
    const playersList = getDraftPlayersForGroup(side, group);
    const isField = group === "field";

    return (
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View>
            <Text style={{ color: isField ? "#47feb7" : "#60a5fa", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
              {isField ? `Players ON FIELD (${playersList.length})` : `Bench Players (${playersList.length})`}
            </Text>
            <Text style={{ color: "#8d96b2", fontSize: 10, marginTop: 2 }}>
              {isField ? "Currently playing players" : "Players sitting outside"}
            </Text>
          </View>
        </View>

        {playersList.length === 0 ? (
          <View style={{ backgroundColor: "#111423", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#6B7280", fontSize: 11 }}>
              {isField ? "No players placed on field yet." : "No bench players yet."}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {playersList.map((player) => renderDraftPlayerCard(player, side, isField))}
          </View>
        )}
      </View>
    );
  };

  const sidePlayerTotals = useMemo(() => ["home", "away"].reduce((accumulator, side) => {
    const draft = lineupDraft?.[side] || { onFieldPlayerIds: [], benchPlayerIds: [] };
    accumulator[side] = draft.onFieldPlayerIds.length + draft.benchPlayerIds.length;
    return accumulator;
  }, {}), [lineupDraft]);

  const canStartWithDraft = manageableSides.every((side) => {
    const totalPlayers = sidePlayerTotals[side] || 0;
    if (totalPlayers === 0) return false;
    return (lineupDraft?.[side]?.onFieldPlayerIds?.length || 0) === Math.min(MAX_ON_FIELD_PLAYERS, totalPlayers);
  });

  const openLineupSetup = () => {
    setLineupDraft(initialLineupDraft);
    setSetupSide(missingManagedSides[0] || manageableSides[0] || "home");
    setLineupSetupView("field");
    setShowFormatSetup(false);
    setShowLineupSetup(true);
  };

  const confirmStartGame = () => {
    const managedLineups = manageableSides.reduce((accumulator, side) => {
      const sideDraft = lineupDraft?.[side] || { onFieldPlayerIds: [], benchPlayerIds: [] };
      const onFieldPlayerIds = (sideDraft.onFieldPlayerIds || []).map(String).filter(Boolean);
      const benchPlayerIds = (sideDraft.benchPlayerIds || []).map(String).filter((playerId) => playerId && !onFieldPlayerIds.includes(playerId));
      accumulator[side] = { onFieldPlayerIds, benchPlayerIds };
      return accumulator;
    }, {});

    if (isScheduled) {
      onStartGame?.({ hockeyLineups: managedLineups, hockeyMatchFormat: matchFormatDraft });
    } else {
      onSaveLineup?.({ hockeyLineups: managedLineups });
    }
    setShowLineupSetup(false);
  };

  const startersTarget = Math.min(MAX_ON_FIELD_PLAYERS, sidePlayerTotals[setupSide] || 0);
  const startersSelected = lineupDraft?.[setupSide]?.onFieldPlayerIds?.length || 0;
  const benchSelected = lineupDraft?.[setupSide]?.benchPlayerIds?.length || 0;
  const startersRemaining = Math.max(0, startersTarget - startersSelected);

  return (
    <View style={{ backgroundColor: "#1a1d2e", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(71,254,183,0.15)", overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", backgroundColor: "#47feb7" }} />
      <View style={{ position: "absolute", top: 0, right: 0, width: 3, height: "100%", backgroundColor: "#b8c3ff" }} />

      {/* Team names + quarter */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#47feb7", maxWidth: "30%" }} numberOfLines={1}>
          {teamNames.home}
        </Text>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 4, color: "#9CA3AF", textTransform: "uppercase" }}>
            {quarterLabel}
          </Text>
          <Text style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
            {matchFormat.periodCount} {matchFormat.structureType} x {matchFormat.periodDurationMinutes} min
          </Text>
        </View>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#b8c3ff", maxWidth: "30%", textAlign: "right" }} numberOfLines={1}>
          {teamNames.away}
        </Text>
      </View>

      {/* Scores + clock */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 56, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 64, minWidth: 70, textAlign: "center" }}>
          {String(homeScore).padStart(2, "0")}
        </Text>

        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#0d101f", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
            <Text style={{ fontSize: 28, fontWeight: "900", fontFamily: "monospace", letterSpacing: 4, color: "#47feb7" }}>
              {fmtTime(gameTime?.minutes ?? matchFormat.periodDurationMinutes, gameTime?.seconds ?? 0)}
            </Text>
          </View>
          {/* Start button for scheduled games */}
          {isScheduled && isOwner && (
            <TouchableOpacity
              onPress={openLineupSetup}
              disabled={isUpdating}
              style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>▶ Start Game</Text>
            </TouchableOpacity>
          )}
          {!isScheduled && !displayOnly && needsManagedLineupSetup && (
            <TouchableOpacity
              onPress={openLineupSetup}
              disabled={isUpdating}
              style={{ backgroundColor: "rgba(250,204,21,0.12)", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: "rgba(250,204,21,0.24)", opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: "#facc15", fontWeight: "900", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                {isSelfOwnedOpponent ? "Set Lineups" : "Set My Lineup"}
              </Text>
            </TouchableOpacity>
          )}
          {/* Pause/End for live games */}
          {!isScheduled && !displayOnly && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={onPauseResume}
                disabled={gameOver || isUpdating}
                style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, backgroundColor: "rgba(71,254,183,0.1)", borderWidth: 1, borderColor: "rgba(71,254,183,0.3)" }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: "#47feb7", letterSpacing: 1, textTransform: "uppercase" }}>
                  {gameTime?.isRunning ? "Pause" : "Resume"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onEndGame}
                disabled={gameOver || gameTime?.isRunning}
                style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, backgroundColor: gameTime?.isRunning ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: gameTime?.isRunning ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.3)" }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: gameTime?.isRunning ? "rgba(239,68,68,0.3)" : "#f87171", letterSpacing: 1, textTransform: "uppercase" }}>End</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Waiting badge for non-owner scheduled */}
          {isScheduled && !isOwner && (
            <Text style={{ color: "#6B7280", fontSize: 10 }}>⏳ Waiting for coach</Text>
          )}
        </View>

        <Text style={{ fontSize: 56, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 64, minWidth: 70, textAlign: "center" }}>
          {String(awayScore).padStart(2, "0")}
        </Text>
      </View>

      {/* Stat bar: PC · PS · Cards */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
        {[
          { label: "PC", home: homePC, away: awayPC },
          { label: "PS", home: homePS, away: awayPS },
          {
            label: "CARDS",
            home: `${homeCards.green}/${homeCards.yellow}/${homeCards.red}`,
            away: `${awayCards.green}/${awayCards.yellow}/${awayCards.red}`,
          },
        ].map((stat) => (
          <View key={stat.label} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
              {stat.label}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#dfe1f9" }}>
              <Text style={{ color: "#47feb7" }}>{stat.home}</Text>
              <Text style={{ color: "#6B7280" }}> – </Text>
              <Text style={{ color: "#b8c3ff" }}>{stat.away}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Modal visible={showLineupSetup} transparent animationType="slide" onRequestClose={() => setShowLineupSetup(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#1a1d2e", borderRadius: 16, padding: 16, maxHeight: "92%", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>Arrange Hockey Lineup</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                  {isScheduled
                    ? "Choose who starts on the field and who begins on the bench before the game goes live."
                    : "Choose who is currently on the field and who begins on the bench for the side you manage."}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowLineupSetup(false)}>
                <Ionicons name="close-circle" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {manageableSides.length > 1 && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {manageableSides.map((side) => (
                  <TouchableOpacity
                    key={side}
                    onPress={() => setSetupSide(side)}
                    style={{
                      flex: 1,
                      backgroundColor: setupSide === side ? (side === "home" ? "rgba(71,254,183,0.16)" : "rgba(184,195,255,0.16)") : "#111423",
                      borderWidth: 1,
                      borderColor: setupSide === side ? (side === "home" ? "rgba(71,254,183,0.35)" : "rgba(184,195,255,0.35)") : "rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: setupSide === side ? (side === "home" ? "#47feb7" : "#b8c3ff") : "#dfe1f9", fontWeight: "900", fontSize: 12 }}>
                      {side === "home" ? teamNames.home : teamNames.away}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ backgroundColor: "#111423", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: setupSide === "home" ? "#47feb7" : "#b8c3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
                {setupSide === "home" ? teamNames.home : teamNames.away}
              </Text>
              <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 4 }}>
                Start with your on-field players first. Use the tabs below to switch between starters and bench.
              </Text>
            </View>

            {isScheduled && (
              <>
                <TouchableOpacity
                  onPress={() => setShowFormatSetup((current) => !current)}
                  style={{ backgroundColor: "#111423", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: "#dfe1f9", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
                      Match Format
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 4 }}>
                      {matchFormatDraft.periodCount} {matchFormatDraft.structureType} x {matchFormatDraft.periodDurationMinutes} min
                    </Text>
                  </View>
                  <Ionicons name={showFormatSetup ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {showFormatSetup && (
                  <View style={{ backgroundColor: "#111423", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                      {[
                        { key: "quarters", label: "4 Quarters", periodCount: 4 },
                        { key: "halves", label: "2 Halves", periodCount: 2 },
                      ].map((option) => {
                        const selected = matchFormatDraft.structureType === option.key;
                        return (
                          <TouchableOpacity
                            key={option.key}
                            onPress={() => setMatchFormatDraft((current) => ({
                              ...current,
                              structureType: option.key,
                              periodCount: option.periodCount,
                            }))}
                            style={{
                              flex: 1,
                              backgroundColor: selected ? "rgba(71,254,183,0.14)" : "#171a2c",
                              borderWidth: 1,
                              borderColor: selected ? "rgba(71,254,183,0.35)" : "rgba(255,255,255,0.08)",
                              borderRadius: 12,
                              paddingVertical: 12,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: selected ? "#47feb7" : "#dfe1f9", fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: "#171a2c", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                      <View>
                        <Text style={{ color: "#9CA3AF", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 }}>
                          Time Per {getHockeyPeriodTypeLabel(matchFormatDraft)}
                        </Text>
                        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 3 }}>
                          {matchFormatDraft.periodDurationMinutes} min
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setMatchFormatDraft((current) => ({ ...current, periodDurationMinutes: Math.max(5, current.periodDurationMinutes - 5) }))}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}
                        >
                          <Ionicons name="remove" size={18} color="#dfe1f9" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setMatchFormatDraft((current) => ({ ...current, periodDurationMinutes: Math.min(60, current.periodDurationMinutes + 5) }))}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(71,254,183,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(71,254,183,0.18)" }}
                        >
                          <Ionicons name="add" size={18} color="#47feb7" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: "rgba(71,254,183,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(71,254,183,0.16)" }}>
                <Text style={{ color: "#47feb7", fontSize: 9, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>
                  Starters
                </Text>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 }}>
                  {startersSelected}/{startersTarget}
                </Text>
                <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 2 }}>
                  {startersRemaining === 0 ? "Ready to start" : `${startersRemaining} more needed`}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(96,165,250,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(96,165,250,0.16)" }}>
                <Text style={{ color: "#93c5fd", fontSize: 9, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>
                  Bench
                </Text>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 }}>
                  {benchSelected}
                </Text>
                <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 2 }}>
                  Available substitutes
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[
                { key: "field", label: `On Field (${startersSelected})`, color: "#47feb7" },
                { key: "bench", label: `Bench (${benchSelected})`, color: "#93c5fd" },
              ].map((option) => {
                const selected = lineupSetupView === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setLineupSetupView(option.key)}
                    style={{
                      flex: 1,
                      backgroundColor: selected ? "rgba(255,255,255,0.08)" : "#111423",
                      borderRadius: 999,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: selected ? option.color : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Text style={{ color: selected ? option.color : "#dfe1f9", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

      

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              {renderLineupSetupSection(setupSide, lineupSetupView)}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowLineupSetup(false)}
                style={{ flex: 1, backgroundColor: "#111423", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "800" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmStartGame}
                disabled={!canStartWithDraft || isUpdating}
                style={{ flex: 2, backgroundColor: !canStartWithDraft || isUpdating ? "#374151" : "#16a34a", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: !canStartWithDraft || isUpdating ? "#9CA3AF" : "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1.3, textTransform: "uppercase" }}>
                  {isScheduled ? "Confirm & Start" : "Save Lineup"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Main Scoring Panel ──────────────────────────────────────────────────────
export default function HockeyScoringPanel({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  isUpdating,
  onEvent,
  gameOver,
  displayOnly = false,
  liveEvents = [],
  onPauseResume,
  onEndGame,
  onStartGame,
  onSaveLineup,
  isScheduled = false,
  isOwner = false,
  userSide = "home",
  isSelfOwnedOpponent = false,
  hideScoreboard = false,
}) {
  const UI = useGameScoringTheme();
  const sport = currentGame?.sport || {};
  const homeScore = sport?.score?.home ?? 0;
  const awayScore = sport?.score?.away ?? 0;
  const matchFormat = useMemo(() => normalizeHockeyMatchFormat(sport?.matchFormat), [sport?.matchFormat]);
  const currentQuarter = sport?.currentQuarter ?? sport?.currentPeriod ?? 1;
  const isOvertime = sport?.isOvertime ?? false;

  // ── Overlay state machine ──
  const [pendingEvent, setPendingEvent] = useState(null);
  const [step, setStep] = useState("team");
  const [selTeam, setSelTeam] = useState(null);
  const [selPlayer, setSelPlayer] = useState(null);
  const [selOutPlayer, setSelOutPlayer] = useState(null);
  const [selInPlayer, setSelInPlayer] = useState(null);
  const [eventQueue, setEventQueue] = useState([]);
  const [dismissedReleasedSuspensionKeys, setDismissedReleasedSuspensionKeys] = useState(() => new Set());
  const [pendingReturnPlayerKeys, setPendingReturnPlayerKeys] = useState(() => new Set());

  const disabled = gameOver;
  // Suspension display ticks independently of game clock.
  // Syncs from server when remaining value changes; counts locally when frozen (paused).
  const suspensionDisplayRef = useRef({});
  const [suspensionTick, setSuspensionTick] = useState(0);
  const manageableSides = useMemo(() => (isSelfOwnedOpponent ? ["home", "away"] : [userSide]), [isSelfOwnedOpponent, userSide]);
  const controlledTeamName = userSide === "home" ? teamNames.home : teamNames.away;

  const playersBySide = useMemo(() => ({
    home: players?.home || [],
    away: players?.away || [],
  }), [players]);

  const playersById = useMemo(() => {
    const map = new Map();
    [...playersBySide.home, ...playersBySide.away].forEach((player) => {
      const playerId = getPlayerId(player);
      if (playerId) map.set(String(playerId), player);
    });
    return map;
  }, [playersBySide]);

  const currentElapsedSeconds = useMemo(
    () => getElapsedSeconds(currentQuarter, gameTime, matchFormat.periodDurationMinutes),
    [currentQuarter, gameTime, matchFormat.periodDurationMinutes],
  );

  const currentClockSeconds = useMemo(
    () => getClockSeconds(gameTime, matchFormat.periodDurationMinutes),
    [gameTime, matchFormat.periodDurationMinutes],
  );

  const activeSuspensions = useMemo(() => {
    const nowMs = suspensionTick >= 0 ? Date.now() : Date.now();
    const result = (sport?.activeSuspensions || [])
      .map((suspension) => {
        const remainingSeconds = getHockeySuspensionRemainingSeconds(suspension, currentElapsedSeconds, currentQuarter, currentClockSeconds, nowMs);
        // For timed cards: trust the wall-clock remaining time as the source of truth
        // regardless of isActive from the server (server may expire by elapsed time
        // before the wall-clock reaches 0, causing premature "Eligible to return").
        // Permanent (red) cards still rely on isActive since they have no timer.
        const isLocallyActive = suspension?.isPermanent
          ? !!suspension?.isActive
          : (remainingSeconds != null && remainingSeconds > 0);

        return {
          ...suspension,
          remainingSeconds,
          isLocallyActive,
        };
      })
      .filter((suspension) => suspension.isLocallyActive)
      .sort((left, right) => getHockeySuspensionStartedAt(right) - getHockeySuspensionStartedAt(left));

    if (typeof __DEV__ !== "undefined" && __DEV__ && (sport?.activeSuspensions?.length ?? 0) > 0) {
      const raw = sport.activeSuspensions;
      const expired = raw.filter(s => !result.some(r => r.suspensionKey === s.suspensionKey));
      console.log(
        `[HockeyCard][activeSuspensions memo] raw=${raw.length} active=${result.length} droppedExpired=${expired.length}`,
        expired.map(s => `${s.cardType}:${s.playerId}:startedAt=${s.suspensionStartedAt}`),
      );
    }

    return result;
  }, [currentClockSeconds, currentElapsedSeconds, currentQuarter, sport?.activeSuspensions, suspensionTick]);

  const releasedSuspensions = useMemo(() => {
    const nowMs = suspensionTick >= 0 ? Date.now() : Date.now();
    return (sport?.activeSuspensions || [])
      .map((suspension) => {
        const remainingSeconds = getHockeySuspensionRemainingSeconds(suspension, currentElapsedSeconds, currentQuarter, currentClockSeconds, nowMs);
        // Same wall-clock-first logic as activeSuspensions.
        const isLocallyActive = suspension?.isPermanent
          ? !!suspension?.isActive
          : (remainingSeconds != null && remainingSeconds > 0);
        return {
          ...suspension,
          remainingSeconds,
          isLocallyActive,
        };
      })
      .filter((suspension) => {
        if (suspension.isLocallyActive || suspension.isPermanent) return false;
        // Show as eligible if server confirmed expiry OR wall-clock confirms expiry
        // (suspensionStartedAt present means wall-clock already returned remaining=0 above).
        return suspension.releasedElapsedSeconds != null || suspension.suspensionStartedAt != null;
      })
      .sort((left, right) => Number(right.releasedElapsedSeconds || 0) - Number(left.releasedElapsedSeconds || 0))
      .slice(0, 3);
  }, [currentClockSeconds, currentElapsedSeconds, currentQuarter, sport?.activeSuspensions, suspensionTick]);

  const suspendedPlayerIds = useMemo(
    () => new Set(activeSuspensions.map((suspension) => String(suspension.playerId))),
    [activeSuspensions],
  );

  const lineups = useMemo(() => {
    const fallback = {
      home: buildFallbackLineupSide(playersBySide.home),
      away: buildFallbackLineupSide(playersBySide.away),
    };

    return ["home", "away"].reduce((accumulator, side) => {
      const fallbackSide = fallback[side];
      const storedSide = sport?.lineups?.[side];
      const onFieldPlayerIds = (storedSide?.onFieldPlayerIds?.length ? storedSide.onFieldPlayerIds : fallbackSide.onFieldPlayerIds)
        .map(String)
        .filter(Boolean);
      const benchPlayerIds = [
        ...(storedSide?.benchPlayerIds || []),
        ...fallbackSide.benchPlayerIds,
        ...(sport?.activeSuspensions || [])
          .filter((suspension) => String(suspension?.teamSide || "") === side && !suspension?.isPermanent && !activeSuspensions.some((active) => String(active.playerId) === String(suspension.playerId)))
          .map((suspension) => String(suspension.playerId)),
      ].filter((playerId, index, values) => playerId && !onFieldPlayerIds.includes(playerId) && values.indexOf(playerId) === index && !suspendedPlayerIds.has(playerId));

      // Recover roster players missing from both lists (legacy card state).
      (playersBySide[side] || []).forEach((player) => {
        const playerId = String(getPlayerId(player));
        if (!playerId) return;
        if (onFieldPlayerIds.includes(playerId) || benchPlayerIds.includes(playerId)) return;
        if (suspendedPlayerIds.has(playerId)) return;
        benchPlayerIds.push(playerId);
      });

      accumulator[side] = { onFieldPlayerIds, benchPlayerIds };
      return accumulator;
    }, {});
  }, [activeSuspensions, playersBySide, sport?.activeSuspensions, sport?.lineups, suspendedPlayerIds]);

  const allowedOnFieldCounts = useMemo(() => ({
    home: Math.max(0, MAX_ON_FIELD_PLAYERS - activeSuspensions.filter((suspension) => suspension.teamSide === "home").length),
    away: Math.max(0, MAX_ON_FIELD_PLAYERS - activeSuspensions.filter((suspension) => suspension.teamSide === "away").length),
  }), [activeSuspensions]);

  const periodColumns = useMemo(() => {
    const columnSet = new Set();
    (sport?.quarterScores?.home || []).forEach((entry) => columnSet.add(Number(entry?.quarter) || 0));
    (sport?.quarterScores?.away || []).forEach((entry) => columnSet.add(Number(entry?.quarter) || 0));
    if (currentQuarter) columnSet.add(Number(currentQuarter) || 1);
    return Array.from(columnSet).filter((value) => value > 0).sort((left, right) => left - right);
  }, [currentQuarter, sport?.quarterScores?.away, sport?.quarterScores?.home]);

  const quarterScoreMap = useMemo(() => {
    return ["home", "away"].reduce((accumulator, side) => {
      accumulator[side] = new Map((sport?.quarterScores?.[side] || []).map((entry) => [Number(entry?.quarter) || 0, entry?.goals ?? 0]));
      return accumulator;
    }, {});
  }, [sport?.quarterScores]);

  useEffect(() => {
    const currentReleasedKeys = new Set(releasedSuspensions.map(getHockeyReleasedSuspensionKey));
    setDismissedReleasedSuspensionKeys((prev) => {
      const nextKeys = [...prev].filter((key) => currentReleasedKeys.has(key));
      if (nextKeys.length === prev.size) return prev;
      return new Set(nextKeys);
    });
  }, [releasedSuspensions]);

  useEffect(() => {
    if (isUpdating || pendingReturnPlayerKeys.size === 0) return;
    setPendingReturnPlayerKeys(new Set());
  }, [isUpdating, pendingReturnPlayerKeys]);

  const visibleReleasedSuspensions = useMemo(() => {
    return releasedSuspensions.filter((suspension) => {
      const releasedKey = getHockeyReleasedSuspensionKey(suspension);
      if (dismissedReleasedSuspensionKeys.has(releasedKey)) return false;

      const returnPlayerKey = getHockeyReturnPlayerKey(suspension);
      const legacyReturnPlayerKey = getHockeyReturnPlayerKey(suspension?.teamSide, suspension?.playerId);
      if (pendingReturnPlayerKeys.has(returnPlayerKey) || pendingReturnPlayerKeys.has(legacyReturnPlayerKey)) return false;

      const onFieldPlayerIds = lineups?.[suspension?.teamSide || "home"]?.onFieldPlayerIds || [];
      return !onFieldPlayerIds.includes(String(suspension?.playerId || ""));
    });
  }, [dismissedReleasedSuspensionKeys, lineups, pendingReturnPlayerKeys, releasedSuspensions]);

  // ── Sequential queue ──
  useEffect(() => {
    if (eventQueue.length > 0 && !isUpdating && !displayOnly && !gameOver) {
      const { type, team, player, extraData } = eventQueue[0];
      onEvent(type, team, player, extraData);
      setEventQueue((prev) => prev.slice(1));
    }
  }, [eventQueue, isUpdating, displayOnly, gameOver, onEvent]);

  // Always-on 1-second tick so suspension timers keep counting when game clock is paused
  useEffect(() => {
    const id = setInterval(() => setSuspensionTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // suspensionTick >= 0 is always true — references it so React re-evaluates every second
  const suspNow = suspensionTick >= 0 ? Date.now() : Date.now();
  const activeSuspensionsDisplay = activeSuspensions.map(s => {
    if (s.isPermanent) return s;
    if (s.suspensionStartedAt && s.durationSeconds != null) {
      const startMs = typeof s.suspensionStartedAt === 'number' ? s.suspensionStartedAt : new Date(s.suspensionStartedAt).getTime();
      if (Number.isFinite(startMs)) {
        return { ...s, remainingSeconds: Math.max(0, s.durationSeconds - Math.floor((suspNow - startMs) / 1000)) };
      }
    }
    const key = String(s.suspensionKey || s.playerId || '');
    const stored = suspensionDisplayRef.current[key];
    if (!stored || stored.syncedRemaining !== s.remainingSeconds) {
      suspensionDisplayRef.current[key] = { syncedAt: suspNow, syncedRemaining: s.remainingSeconds };
      return s;
    }
    const localElapsed = Math.floor((suspNow - stored.syncedAt) / 1000);
    return { ...s, remainingSeconds: Math.max(0, stored.syncedRemaining - localElapsed) };
  }).filter(s => s.isPermanent || s.remainingSeconds > 0);

  const enqueue = (type, team, player = null, extraData = {}) =>
    setEventQueue((prev) => [...prev, { type, team, player, extraData }]);

  const markPendingReturnPlayer = (suspensionOrTeamSide, playerId) => {
    const normalizedPlayerId = typeof suspensionOrTeamSide === "object"
      ? suspensionOrTeamSide?.playerId
      : playerId;
    if (!normalizedPlayerId) return;
    const playerKey = getHockeyReturnPlayerKey(suspensionOrTeamSide, normalizedPlayerId);
    setPendingReturnPlayerKeys((prev) => {
      if (prev.has(playerKey)) return prev;
      const next = new Set(prev);
      next.add(playerKey);
      return next;
    });
  };

  const dismissReleasedSuspension = (suspension) => {
    const releasedKey = getHockeyReleasedSuspensionKey(suspension);
    setDismissedReleasedSuspensionKeys((prev) => {
      if (prev.has(releasedKey)) return prev;
      const next = new Set(prev);
      next.add(releasedKey);
      return next;
    });
  };

  // ── Reset overlay ──
  const closeOverlay = () => {
    setPendingEvent(null);
    setStep("team");
    setSelTeam(null);
    setSelPlayer(null);
    setSelOutPlayer(null);
    setSelInPlayer(null);
  };

  // ── Start an event ──
  const startEvent = (type) => {
    if (disabled || displayOnly) return;
    if (type === "undo") {
      enqueue("undo", manageableSides.length === 1 ? manageableSides[0] : null);
      return;
    }
    if (type === "period_end") { enqueue("period_end", "home"); return; }
    const lockedTeam = manageableSides.length === 1 ? manageableSides[0] : null;
    setPendingEvent(type);
    setSelTeam(lockedTeam);
    if (!lockedTeam) {
      setStep("team");
      return;
    }
    if (type === "save") {
      setStep("save_mode");
      return;
    }
    if (TEAM_FIRST_EVENT_TYPES.has(type)) {
      enqueue(type, lockedTeam, null);
      closeOverlay();
      return;
    }
    setStep(type === "substitution" ? "player_out" : "player");
  };

  const handleResumeEligiblePlayer = (suspension) => {
    if (disabled || displayOnly || !suspension?.playerId) return;

    const suspensionTeamSide = suspension?.teamSide || "home";
    if (!manageableSides.includes(suspensionTeamSide)) return;

    const currentOnFieldCount = lineups?.[suspensionTeamSide]?.onFieldPlayerIds?.length || 0;
    const allowedOnFieldCount = allowedOnFieldCounts?.[suspensionTeamSide] || 0;
    const canReturnDirectly = currentOnFieldCount < allowedOnFieldCount;

    if (canReturnDirectly) {
      markPendingReturnPlayer(suspension);
      enqueue("substitution", suspensionTeamSide, suspension.playerId, {
        outPlayerId: null,
        inPlayerId: suspension.playerId,
      });
      return;
    }

    setPendingEvent("substitution");
    setStep("player_out");
    setSelTeam(suspensionTeamSide);
    setSelPlayer(null);
    setSelOutPlayer(null);
    setSelInPlayer(String(suspension.playerId));
  };

  // ── Team selected ──
  const onTeamSelect = (team) => {
    setSelTeam(team);
    if (pendingEvent === "save") {
      setStep("save_mode");
      return;
    }
    if (TEAM_FIRST_EVENT_TYPES.has(pendingEvent)) {
      enqueue(pendingEvent, team, null);
      closeOverlay();
      return;
    }
    setStep(pendingEvent === "substitution" ? "player_out" : "player");
  };

  const submitSimplePlayerEvent = (team, playerId) => {
    const isCardEvent = ["green_card", "yellow_card", "red_card"].includes(pendingEvent);
    enqueue(pendingEvent, team, playerId, isCardEvent ? { suspensionStartedAt: new Date().toISOString() } : {});
    closeOverlay();
  };

  // ── Confirm event ──
  const onConfirm = (isGoal = false) => {
    if (pendingEvent === "substitution") {
      markPendingReturnPlayer(selTeam, selInPlayer);
      enqueue("substitution", selTeam, selOutPlayer || selInPlayer, {
        outPlayerId: selOutPlayer || null,
        inPlayerId: selInPlayer || null,
      });
      closeOverlay();
      return;
    }

    const isChance = pendingEvent === "penalty_corner" || pendingEvent === "penalty_stroke";
    if (isChance) {
      enqueue(pendingEvent, selTeam, selPlayer);
      if (isGoal) {
        enqueue("goal", selTeam, selPlayer);
      }
    } else {
      enqueue(pendingEvent, selTeam, selPlayer);
    }

    closeOverlay();
  };

  const requiresPlayer = ["green_card", "yellow_card", "red_card", "substitution"].includes(pendingEvent);
  const isConfirmDisabled = pendingEvent === "substitution"
    ? !selInPlayer
    : requiresPlayer && !selPlayer;
  const isChanceEvent = pendingEvent === "penalty_corner" || pendingEvent === "penalty_stroke";
  const selectedLineup = selTeam ? lineups[selTeam] : null;
  const canAddWithoutOut = !!(selTeam && pendingEvent === "substitution" && selectedLineup && selectedLineup.onFieldPlayerIds.length < allowedOnFieldCounts[selTeam]);
  const mapPlayerIdToCard = (playerId) => playersById.get(String(playerId)) || { _id: playerId, firstName: "Player", lastName: String(playerId).slice(-4) };
  const onFieldPlayers = !selTeam
    ? []
    : (selectedLineup?.onFieldPlayerIds || []).map(mapPlayerIdToCard).filter(Boolean);
  const benchPlayers = !selTeam
    ? []
    : (selectedLineup?.benchPlayerIds || []).map(mapPlayerIdToCard).filter(Boolean);
  const isCardPendingEvent = ["green_card", "yellow_card", "red_card"].includes(pendingEvent);
  const statSelectionPlayers = selTeam
    ? (() => {
        const roster = (playersBySide[selTeam] || []).filter(Boolean);
        const onFieldIds = new Set((selectedLineup?.onFieldPlayerIds || []).map(String));
        const permanentRedIds = new Set(
          (sport?.activeSuspensions || [])
            .filter((s) => s.isPermanent && s.isActive && String(s.teamSide) === String(selTeam))
            .map((s) => String(s.playerId)),
        );
        if (isCardPendingEvent) {
          const eligible = roster.filter((player) => {
            const id = String(getPlayerId(player));
            return onFieldIds.has(id) && !permanentRedIds.has(id);
          });
          return eligible.length > 0 ? eligible : onFieldPlayers;
        }
        return onFieldPlayers.length > 0 ? onFieldPlayers : roster;
      })()
    : [];
  const substitutionOutPlayers = canAddWithoutOut
    ? [{ _id: "__no_out__", firstName: "Add player", lastName: "only", jerseyNumber: null }, ...onFieldPlayers]
    : onFieldPlayers;
  const suspensionBadges = activeSuspensionsDisplay.slice(0, 3);
  const blockedBenchSuspensions = (selTeam ? activeSuspensionsDisplay.filter((suspension) => suspension.teamSide === selTeam) : []).slice(0, 3);
  const eventOwnershipLabel = pendingEvent === "save"
    ? "Team or Player"
    : TEAM_FIRST_EVENT_TYPES.has(pendingEvent)
      ? "Team"
      : "Player";

  const teamColor = (side) => (side === "home"
    ? (UI.isDark ? "#47feb7" : "#FFFFFF")
    : (UI.isDark ? "#b8c3ff" : "#FFFFFF"));
  const teamBg = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.12)" : "#22C55E")
    : (UI.isDark ? "rgba(184,195,255,0.12)" : "#6366F1"));
  const teamBorder = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.5)" : "#16A34A")
    : (UI.isDark ? "rgba(184,195,255,0.5)" : "#4F46E5"));
  const teamDeep = (side) => (side === "home"
    ? (UI.isDark ? "#0d5c45" : "#15803D")
    : (UI.isDark ? "#3b3f6b" : "#4338CA"));
  const teamLabelColor = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.7)" : "rgba(255,255,255,0.9)")
    : (UI.isDark ? "rgba(184,195,255,0.7)" : "rgba(255,255,255,0.9)"));
  const goalBadgeBg = UI.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.18)";
  const goalBadgeText = UI.isDark ? "#dfe1f9" : "#FFFFFF";
  const darkChipDeep = UI.isDark ? "#0b0d18" : "#0f111c";
  const subBg = UI.isDark ? "rgba(96,165,250,0.1)" : "#3B82F6";
  const subBorder = UI.isDark ? "rgba(96,165,250,0.3)" : "#2563EB";
  const subDeep = UI.isDark ? "#1e3a5f" : "#1D4ED8";
  const subText = UI.isDark ? "#60a5fa" : "#FFFFFF";
  const subBadgeBg = UI.isDark ? "rgba(96,165,250,0.14)" : "rgba(255,255,255,0.22)";
  const subBadgeText = UI.isDark ? "#bfdbfe" : "#FFFFFF";
  const periodBg = UI.isDark ? "rgba(251,191,36,0.15)" : "#F59E0B";
  const periodBorder = UI.isDark ? "rgba(251,191,36,0.4)" : "#D97706";
  const periodDeep = UI.isDark ? "#7a5a10" : "#B45309";
  const periodText = UI.isDark ? "#fbbf24" : "#FFFFFF";
  const periodDisabledBg = UI.isDark ? "#171a2c" : "#E5E7EB";
  const periodDisabledBorder = UI.isDark ? "rgba(255,255,255,0.06)" : "#D1D5DB";
  const periodDisabledText = UI.isDark ? "#6B7280" : "#9CA3AF";

  const periodTypeLabel = getHockeyPeriodTypeLabel(matchFormat);
  const quarterLabel = getHockeyPeriodLabel(currentQuarter, matchFormat, isOvertime);

  // ═══════════════════════════════════════════════════════════════
  // OVERLAY
  // ═══════════════════════════════════════════════════════════════
  if (pendingEvent && !displayOnly) {
    const eventLabel = getHockeyEventLabel(pendingEvent).toUpperCase();
    const selectedOutPlayerCard = substitutionOutPlayers.find((player) => getPlayerId(player) === selOutPlayer) || null;
    const selectedInPlayerCard = benchPlayers.find((player) => getPlayerId(player) === selInPlayer) || null;
    const renderRosterCard = (player, options = {}) => {
      const playerId = getPlayerId(player);
      const isSpecialAddOnly = playerId === "__no_out__";
      const isSelected = options.selectedId === playerId;
      const isDisabled = !!options.disabled;
      const accentColor = options.accentColor || "#47feb7";
      const cardDots = options.playerCardStats?.get(String(playerId)) || [];

      return (
        <TouchableOpacity
          key={playerId}
          onPress={() => !isDisabled && options.onPress?.(playerId)}
          disabled={isDisabled}
          style={{
            width: "48.5%",
            backgroundColor: isSelected ? `${accentColor}20` : "#111423",
            borderWidth: 1,
            borderColor: isSelected ? accentColor : "rgba(255,255,255,0.07)",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 8,
            marginBottom: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            opacity: isDisabled ? 0.35 : 1,
          }}
        >
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: isSelected ? accentColor : (options.badgeBg || "rgba(255,255,255,0.08)"),
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Text style={{ color: isSelected ? "#001f14" : (options.badgeColor || "#dfe1f9"), fontWeight: "900", fontSize: 9 }}>
              {isSpecialAddOnly ? "+" : player?.jerseyNumber || "#"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: isSelected ? accentColor : "#dfe1f9", fontWeight: isSelected ? "800" : "600", fontSize: 11 }} numberOfLines={1}>
              {isSpecialAddOnly ? "Add only" : getPlayerName(player)}
            </Text>
            {cardDots.length > 0 && (
              <View style={{ flexDirection: "row", gap: 3, marginTop: 2 }}>
                {cardDots.map((c, i) => (
                  <View key={i} style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.color }} />
                ))}
              </View>
            )}
          </View>
          {isSelected && <Ionicons name="checkmark-circle" size={14} color={accentColor} />}
        </TouchableOpacity>
      );
    };

    const playerCardStats = (() => {
      // Build from activeSuspensions (already filtered to locally-active only) so
      // expired card badges disappear from the player list as soon as the timer runs out.
      const map = new Map();
      (activeSuspensions || []).forEach((suspension) => {
        const pid = String(suspension.playerId);
        if (!pid) return;
        const color = suspension.cardType === "green_card"
          ? "#4ade80"
          : suspension.cardType === "yellow_card"
            ? "#facc15"
            : "#f87171";
        if (!map.has(pid)) map.set(pid, []);
        const dots = map.get(pid);
        if (dots.length < 4) dots.push({ color });
      });
      return map;
    })();

    const renderSection = ({ title, playersList, emptyLabel, accentColor, badgeBg, badgeColor, selectedId, onPress, disabledIds = new Set(), roleLabel, icon, iconColor }) => (
      <View style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
          <Text style={{ color: accentColor, fontSize: 9, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", flex: 1 }}>
            {title}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 9, fontWeight: "700" }}>{playersList.length}</Text>
        </View>
        {playersList.length === 0 ? (
          <Text style={{ color: "#6B7280", fontSize: 10, paddingVertical: 5 }}>{emptyLabel}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {playersList.map((player) => renderRosterCard(player, {
              selectedId, onPress,
              disabled: disabledIds.has(getPlayerId(player)),
              accentColor, badgeBg, badgeColor, roleLabel, icon, iconColor,
              playerCardStats,
            }))}
          </View>
        )}
      </View>
    );

    return (
      <Modal visible transparent animationType="fade" onRequestClose={closeOverlay}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", padding: 12 }}>
      <View style={{ backgroundColor: "#1a1d2e", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", maxHeight: "90%" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 2, color: "#47feb7", textTransform: "uppercase" }}>
              {eventLabel}
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ color: "#dfe1f9", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 }}>{eventOwnershipLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={closeOverlay}>
            <Ionicons name="close-circle" size={26} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* ── STEP: team ── */}
        {step === "team" && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Which Team?
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {manageableSides.map((side) => (
                <TouchableOpacity
                  key={side}
                  onPress={() => onTeamSelect(side)}
                  style={{ flex: 1, backgroundColor: teamBg(side), borderWidth: 1, borderColor: teamBorder(side), borderRadius: 12, paddingVertical: 20, alignItems: "center", gap: 4 }}
                >
                  <Text style={{ color: teamColor(side), fontWeight: "900", fontSize: 16 }}>
                    {side === "home" ? teamNames.home : teamNames.away}
                  </Text>
                  <Text style={{ color: teamLabelColor(side), fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 }}>
                    {side}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === "save_mode" && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Record save as team action or attribute it
            </Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  enqueue("save", selTeam, null);
                  closeOverlay();
                }}
                style={{ backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", borderRadius: 14, padding: 16 }}
                testID="hockey-save-team-option"
              >
                <Text style={{ color: "#4ade80", fontWeight: "900", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.6 }}>Team Save</Text>
                <Text style={{ color: "#c7d2fe", fontSize: 11, marginTop: 6 }}>
                  Fastest option. Records the save for the defending team without forcing a player.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep("player")}
                style={{ backgroundColor: "#111423", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}
                testID="hockey-save-player-option"
              >
                <Text style={{ color: "#dfe1f9", fontWeight: "900", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.6 }}>Attribute to Player</Text>
                <Text style={{ color: "#8d96b2", fontSize: 11, marginTop: 6 }}>
                  Use this when you want goalkeeper or defender credit in the stat log.
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setStep("team")}
              style={{ marginTop: 14, backgroundColor: "#171a2c", paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
            >
              <Text style={{ color: "#9CA3AF", fontWeight: "700" }}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: player / substitution flow ── */}
        {["player", "player_out", "player_in"].includes(step) && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
              {pendingEvent === "substitution"
                ? selOutPlayer
                  ? "Step 2 of 2 — tap the player coming ON from the bench"
                  : canAddWithoutOut
                    ? "Tap a bench player to add them directly, or first tap an outgoing player"
                    : "Step 1 of 2 — tap a player on the field to bring them OFF"
                : TEAM_FIRST_EVENT_TYPES.has(pendingEvent)
                  ? "Pick the team only. No player will be forced into the stat log."
                : requiresPlayer
                  ? "Select player from the current 11 on field"
                  : "Select player for this event"}
            </Text>

            {pendingEvent === "substitution" && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1, backgroundColor: selOutPlayer ? "rgba(248,113,113,0.15)" : "#111423", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: selOutPlayer ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.06)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: selOutPlayer ? "#f87171" : "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: selOutPlayer ? "#fff" : "#6B7280", fontSize: 8, fontWeight: "900" }}>1</Text>
                    </View>
                    <Text style={{ color: "#f87171", fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>
                      {selOutPlayer ? "Going OFF ✓" : "Going OFF"}
                    </Text>
                  </View>
                  <Text style={{ color: "#dfe1f9", fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
                    {selectedOutPlayerCard ? getPlayerName(selectedOutPlayerCard) : canAddWithoutOut ? "Optional (short-handed)" : "Tap a field player below"}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: selInPlayer ? "rgba(74,222,128,0.15)" : "#111423", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: selInPlayer ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.06)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: selInPlayer ? "#4ade80" : "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: selInPlayer ? "#fff" : "#6B7280", fontSize: 8, fontWeight: "900" }}>2</Text>
                    </View>
                    <Text style={{ color: "#4ade80", fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>
                      {selInPlayer ? "Coming ON ✓" : "Coming ON"}
                    </Text>
                  </View>
                  <Text style={{ color: "#dfe1f9", fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
                    {selectedInPlayerCard ? getPlayerName(selectedInPlayerCard) : (!selOutPlayer && !canAddWithoutOut) ? "Select step 1 first" : "Tap a bench player below"}
                  </Text>
                </View>
              </View>
            )}

            <ScrollView style={{ maxHeight: pendingEvent === "substitution" ? 280 : 310 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {pendingEvent === "substitution" ? (
                <>
                  {blockedBenchSuspensions.length > 0 && (
                    <View style={{ backgroundColor: "rgba(250,204,21,0.12)", borderWidth: 1, borderColor: "rgba(250,204,21,0.3)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: "#facc15", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 4 }}>
                        Bench players still serving cards
                      </Text>
                      <Text style={{ color: "#dfe1f9", fontSize: 11, lineHeight: 16 }}>
                        {blockedBenchSuspensions.map((suspension) => {
                          const player = playersById.get(String(suspension.playerId));
                          const playerName = player ? getPlayerName(player) : "Player";
                          return `${playerName} (${formatRemainingTime(suspension.remainingSeconds || 0)})`;
                        }).join(" • ")}
                      </Text>
                    </View>
                  )}

                  {renderSection({
                    title: `On Field — Going OFF (${onFieldPlayers.length})`,
                    subtitle: "Tap a player to sub them OUT. Bench unlocks next.",
                    playersList: substitutionOutPlayers,
                    emptyLabel: "No on-field players available for this team.",
                    accentColor: "#f87171",
                    badgeBg: "rgba(248,113,113,0.15)",
                    badgeColor: "#fca5a5",
                    selectedId: selOutPlayer,
                    onPress: (playerId) => {
                      const nextOutPlayerId = playerId === "__no_out__" ? null : playerId;
                      if (selInPlayer && (nextOutPlayerId || canAddWithoutOut)) {
                        markPendingReturnPlayer(selTeam, selInPlayer);
                        enqueue("substitution", selTeam, nextOutPlayerId || selInPlayer, {
                          outPlayerId: nextOutPlayerId,
                          inPlayerId: selInPlayer,
                        });
                        closeOverlay();
                        return;
                      }
                      setSelOutPlayer(nextOutPlayerId);
                      setSelInPlayer(null);
                      setStep("player_in");
                    },
                    roleLabel: "Tap to sub out",
                    icon: "remove-circle-outline",
                    iconColor: "#f87171",
                  })}

                  {!selOutPlayer && !canAddWithoutOut ? (
                    <View style={{ backgroundColor: "rgba(74,222,128,0.06)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(74,222,128,0.15)", marginBottom: 14, alignItems: "center" }}>
                      <Ionicons name="lock-closed-outline" size={22} color="#4ade80" style={{ marginBottom: 6, opacity: 0.5 }} />
                      <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "700", opacity: 0.7, textAlign: "center" }}>
                        Bench players available after selecting step 1
                      </Text>
                      <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 4, textAlign: "center" }}>
                        Tap a player from the ON FIELD section above first
                      </Text>
                    </View>
                  ) : (
                  <View>
                  {renderSection({
                    title: "Bench Players — Coming ON",
                    subtitle: "Tap a player to sub them IN immediately.",
                    playersList: benchPlayers,
                    emptyLabel: "No bench players available for this team.",
                    accentColor: "#4ade80",
                    badgeBg: "rgba(74,222,128,0.15)",
                    badgeColor: "#86efac",
                    selectedId: selInPlayer,
                    disabledIds: new Set(),
                    onPress: (playerId) => {
                      const nextPlayerId = selInPlayer === playerId ? null : playerId;
                      setSelInPlayer(nextPlayerId);
                      if (nextPlayerId) {
                        markPendingReturnPlayer(selTeam, nextPlayerId);
                        enqueue("substitution", selTeam, selOutPlayer || nextPlayerId, {
                          outPlayerId: selOutPlayer || null,
                          inPlayerId: nextPlayerId,
                        });
                        closeOverlay();
                      }
                    },
                    roleLabel: "Tap to sub in",
                    icon: "add-circle-outline",
                    iconColor: "#4ade80",
                  })}
                  </View>
                  )}
                </>
              ) : TEAM_FIRST_EVENT_TYPES.has(pendingEvent) ? (
                <View style={{ backgroundColor: "#111423", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                  <Text style={{ color: "#dfe1f9", fontWeight: "800", fontSize: 13, textAlign: "center" }}>
                    This is recorded as a team action for speed and clean stats.
                  </Text>
                  <Text style={{ color: "#8d96b2", fontSize: 11, textAlign: "center", marginTop: 6 }}>
                    {manageableSides.length === 1 ? `This records for ${controlledTeamName} instantly.` : "Choose home or away above to record it instantly."}
                  </Text>
                </View>
              ) : (
                renderSection({
                  title: `Players ON FIELD (${statSelectionPlayers.length})`,
                  subtitle: "Only players currently in the game are shown here.",
                  playersList: statSelectionPlayers,
                  emptyLabel: "No players available to select.",
                  accentColor: teamColor(selTeam),
                  badgeBg: teamBg(selTeam),
                  badgeColor: teamColor(selTeam),
                  selectedId: selPlayer,
                  onPress: (playerId) => {
                    setSelPlayer(playerId);
                    if (!isChanceEvent) {
                      submitSimplePlayerEvent(selTeam, playerId);
                    }
                  },
                  roleLabel: "Eligible for this event",
                  icon: "checkmark-circle-outline",
                  iconColor: teamColor(selTeam),
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  if (step === "player_in" && pendingEvent === "substitution") {
                    setStep("player_out");
                    return;
                  }
                  setStep("team");
                }}
                style={{ flex: 1, backgroundColor: "#171a2c", paddingVertical: 11, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 12 }}>Back</Text>
              </TouchableOpacity>

              {isChanceEvent && (
                <>
                  <TouchableOpacity
                    onPress={() => onConfirm(false)}
                    disabled={isConfirmDisabled}
                    style={{ flex: 1.5, backgroundColor: isConfirmDisabled ? "#374151" : "#171a2c", paddingVertical: 11, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: isConfirmDisabled ? "#374151" : "rgba(255,255,255,0.18)" }}
                  >
                    <Text style={{ color: isConfirmDisabled ? "#6B7280" : "#dfe1f9", fontWeight: "900", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>Missed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onConfirm(true)}
                    disabled={isConfirmDisabled}
                    style={{ flex: 1.5, backgroundColor: isConfirmDisabled ? "#374151" : "#47feb7", paddingVertical: 11, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: isConfirmDisabled ? "#6B7280" : "#003824", fontWeight: "900", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>Goal!</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </View>
      </View>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PANEL
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={{ width: "100%" }}>
      {/* Queue badge */}
      {eventQueue.length > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", top: 10, right: 10, zIndex: 20, backgroundColor: "rgba(9,12,24,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
          <Text style={{ color: "#47feb7", fontWeight: "900", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
            Queued {eventQueue.length}
          </Text>
        </View>
      )}

      {/* ══ SCOREBOARD ══ */}
      <View style={{ display: hideScoreboard ? "none" : "flex", marginBottom: 16 }}>
        <HockeyScoreboardCard
          sport={sport}
          teamNames={teamNames}
          players={players}
          gameTime={gameTime}
          displayOnly={displayOnly}
          isUpdating={isUpdating}
          gameOver={gameOver}
          isScheduled={isScheduled}
          isOwner={isOwner}
          userSide={userSide}
          isSelfOwnedOpponent={isSelfOwnedOpponent}
          onPauseResume={onPauseResume}
          onEndGame={onEndGame}
          onStartGame={onStartGame}
          onSaveLineup={onSaveLineup}
        />
      </View>

      <View >
  

        {/* <View style={{ flexDirection: "row", gap: 10 }}>
          {["home", "away"].map((side) => (
            <View key={side} style={{ flex: 1, backgroundColor: teamBg(side), borderWidth: 1, borderColor: teamBorder(side), borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", color: teamColor(side), marginBottom: 4 }}>
                {side === "home" ? teamNames.home : teamNames.away}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#dfe1f9" }}>
                {lineups[side].onFieldPlayerIds.length}/{allowedOnFieldCounts[side]}
              </Text>
              <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
                On field{allowedOnFieldCounts[side] < MAX_ON_FIELD_PLAYERS ? " • short-handed" : ""}
              </Text>
            </View>
          ))}
        </View> */}

        {activeSuspensionsDisplay.length > 0 && (
          <View style={{ gap: 6, marginBottom: 16 }}>
            <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", color: "#9CA3AF" }}>
              Active Suspensions
            </Text>
            {activeSuspensionsDisplay.map((suspension) => {
              const player = playersById.get(String(suspension.playerId));
              const playerName = player ? `${player.firstName || ""} ${player.lastName || ""}`.trim() : "Player";
              return (
                <View key={String(suspension.suspensionKey || `${suspension.teamId}-${suspension.playerId}-${suspension.cardType}-${suspension.startedElapsedSeconds ?? "na"}-${suspension.startedClockSeconds ?? "na"}-${suspension.expiresAtElapsedSeconds ?? "na"}`)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#111423", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <View>
                    <Text style={{ color: "#dfe1f9", fontWeight: "700", fontSize: 12 }}>
                      {playerName}
                    </Text>
                    <Text style={{ color: "#6B7280", fontSize: 10, textTransform: "capitalize" }}>
                      {getHockeyEventLabel(suspension.cardType)}
                    </Text>
                  </View>
                    <Text style={{ color: suspension.isPermanent ? "#f87171" : getHockeySuspensionTimerColor(suspension.cardType), fontWeight: "900", fontSize: 12 }}>
                    {suspension.isPermanent ? "Sent off" : formatRemainingTime(suspension.remainingSeconds || 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {visibleReleasedSuspensions.length > 0 && (
          <View style={{ gap: 6, marginTop: activeSuspensions.length > 0 ? 12 : 0 }}>
            <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", color: "#9CA3AF" }}>
              Eligible To Return
            </Text>
            {visibleReleasedSuspensions.map((suspension) => {
              const player = playersById.get(String(suspension.playerId));
              const playerName = player ? getPlayerName(player) : "Player";
              const canResumeThisPlayer = manageableSides.includes(suspension?.teamSide || "home");
              return (
                <View key={`released-${String(suspension.suspensionKey || `${suspension.teamId}-${suspension.playerId}-${suspension.cardType}-${suspension.startedElapsedSeconds ?? "na"}-${suspension.startedClockSeconds ?? "na"}-${suspension.expiresAtElapsedSeconds ?? "na"}`)}`} style={{ backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.18)" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: "#dfe1f9", fontWeight: "700", fontSize: 12 }}>{playerName}</Text>
                      <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                        {canResumeThisPlayer
                          ? "Eligible to return. Tap below to bring this player back on."
                          : "Eligible to return for the other team."}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => dismissReleasedSuspension(suspension)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      style={{ marginTop: -2, marginRight: -2, padding: 2 }}
                    >
                      <Ionicons name="close" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  {canResumeThisPlayer ? (
                    <TouchableOpacity
                      onPress={() => handleResumeEligiblePlayer(suspension)}
                      style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(74,222,128,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(74,222,128,0.28)" }}
                    >
                      <Text style={{ color: "#4ade80", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Return Player
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(74,222,128,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(74,222,128,0.24)" }}>
                      <Text style={{ color: "#4ade80", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Bench Ready
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {!displayOnly && !gameOver && (
        <>
          {/* ══ GOAL BUTTONS (2 columns, one per team) ══ */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 12 }}>
            {manageableSides.map((side) => (
              <TouchableOpacity
                key={side}
                onPress={() => {
                  setPendingEvent("goal");
                  setSelTeam(side);
                  setStep("player");
                }}
                disabled={disabled}
                style={{
                  flex: 1,
                  backgroundColor: teamBg(side),
                  borderRadius: 14,
                  paddingVertical: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: teamBorder(side),
                  opacity: disabled ? 0.4 : 1,
                  ...raised3d(teamDeep(side)),
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: teamLabelColor(side), marginBottom: 2 }}>
                  {side === "home" ? teamNames.home : teamNames.away}
                </Text>
                <View style={{ backgroundColor: goalBadgeBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 }}>
                  <Text style={{ color: goalBadgeText, fontSize: 8, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>Player</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: "900", color: teamColor(side), letterSpacing: -1 }}>
                  GOAL
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ══ PENALTY CORNER + PENALTY STROKE ══ */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => startEvent("penalty_corner")}
              disabled={disabled}
              style={{ flex: 1, backgroundColor: "#171a2c", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", minHeight: 80, justifyContent: "space-between", opacity: disabled ? 0.4 : 1, ...raised3d(darkChipDeep) }}
            >
              <Ionicons name="football-outline" size={18} color="#fbbf24" />
              <View>
                <Text style={{ fontSize: 7, color: "rgba(251,191,36,0.7)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                  Chance Event • Player
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", color: "#dfe1f9" }}>
                  Penalty Corner
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => startEvent("penalty_stroke")}
              disabled={disabled}
              style={{ flex: 1, backgroundColor: "#171a2c", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", minHeight: 80, justifyContent: "space-between", opacity: disabled ? 0.4 : 1, ...raised3d(darkChipDeep) }}
            >
              <Ionicons name="disc-outline" size={18} color="#a78bfa" />
              <View>
                <Text style={{ fontSize: 7, color: "rgba(167,139,250,0.7)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                  Chance Event • Player
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", color: "#dfe1f9" }}>
                  Penalty Stroke
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ══ CARDS — 3 col ══ */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {CARD_OPTIONS.map((card) => (
              <TouchableOpacity
                key={card.type}
                onPress={() => startEvent(card.type)}
                disabled={disabled}
                style={{ flex: 1, backgroundColor: "#171a2c", paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", gap: 6, opacity: disabled ? 0.4 : 1, ...raised3d(card.color) }}
              >
                <View style={{ width: 14, height: 22, backgroundColor: card.color, borderRadius: 2 }} />
                <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.3, color: "#dfe1f9", textAlign: "center" }}>
                  {card.label}
                </Text>
                <Text style={{ fontSize: 7, color: "#9CA3AF", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 }}>Player</Text>
                <Text style={{ fontSize: 7, color: "#6B7280" }}>{card.suspension}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ══ SUBSTITUTION ══ */}
          <TouchableOpacity
            onPress={() => startEvent("substitution")}
            disabled={disabled}
            style={{
              backgroundColor: subBg,
              borderWidth: 1,
              borderColor: subBorder,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 12,
              opacity: disabled ? 0.4 : 1,
              ...raised3d(subDeep),
            }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={subText} />
            <Text style={{ fontSize: 11, fontWeight: "900", color: subText, letterSpacing: 2, textTransform: "uppercase" }}>Substitution</Text>
            <View style={{ backgroundColor: subBadgeBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: subBadgeText, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>TEAM</Text>
            </View>
          </TouchableOpacity>

          {/* <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {["home", "away"].map((side) => (
              <View key={`on-field-${side}`} style={{ flex: 1, backgroundColor: "#111423", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: "900", color: teamColor(side), textTransform: "uppercase", letterSpacing: 1.3 }}>
                    {side === "home" ? teamNames.home : teamNames.away}
                  </Text>
                  <Text style={{ fontSize: 10, color: "#dfe1f9", fontWeight: "900" }}>
                    {lineups[side].onFieldPlayerIds.length}/{allowedOnFieldCounts[side]}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {onFieldPreview[side].map((player) => (
                    <View key={`${side}-${getPlayerId(player)}`} style={{ backgroundColor: teamBg(side), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: teamColor(side), fontSize: 9, fontWeight: "800" }} numberOfLines={1}>
                        {getPlayerShortName(player)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View> */}

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {EXTRA_EVENT_OPTIONS.filter((eventOption) => ["foul", "free_hit", "save"].includes(eventOption.type)).map((eventOption) => (
              <TouchableOpacity
                key={eventOption.type}
                onPress={() => startEvent(eventOption.type)}
                disabled={disabled}
                style={{
                  flex: 1,
                  backgroundColor: "#111423",
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                  alignItems: "center",
                  gap: 6,
                  opacity: disabled ? 0.4 : 1,
                  ...raised3d(darkChipDeep),
                }}
              >
                <Ionicons name={eventOption.icon} size={18} color={eventOption.color} />
                  <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 8, fontWeight: "900", color: "#dfe1f9", textTransform: "uppercase", letterSpacing: 1.1 }}>
                      {eventOption.type === "save" ? "Team or Player" : "Team"}
                    </Text>
                  </View>
                <Text style={{ fontSize: 10, fontWeight: "900", textTransform: "uppercase", color: "#dfe1f9", letterSpacing: 1.2 }}>
                  {eventOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 }}>
            {EXTRA_EVENT_OPTIONS.filter((eventOption) => !["foul", "free_hit", "save"].includes(eventOption.type)).map((eventOption) => (
              <TouchableOpacity
                key={eventOption.type}
                onPress={() => startEvent(eventOption.type)}
                disabled={disabled}
                style={{
                  width: "48%",
                  backgroundColor: "#171a2c",
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                  minHeight: 82,
                  justifyContent: "space-between",
                  marginBottom: 10,
                  opacity: disabled ? 0.4 : 1,
                  ...raised3d(darkChipDeep),
                }}
              >
                <Ionicons name={eventOption.icon} size={18} color={eventOption.color} />
                <View>
                  <Text style={{ fontSize: 7, color: `${eventOption.color}CC`, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                    {eventOption.caption} • Team
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", color: "#dfe1f9" }}>
                    {eventOption.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ══ PERIOD BREAK ══ */}
          <View style={{ marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => startEvent("period_end")}
              disabled={disabled}
              style={{
                paddingVertical: 13,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 1,
                backgroundColor: !disabled ? periodBg : periodDisabledBg,
                borderColor: !disabled ? periodBorder : periodDisabledBorder,
                opacity: disabled ? 0.4 : 1,
                ...raised3d(!disabled ? periodDeep : darkChipDeep),
              }}
            >
              <Ionicons name="pause-circle-outline" size={16} color={!disabled ? periodText : periodDisabledText} />
              <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: !disabled ? periodText : periodDisabledText }}>
                End {quarterLabel === "OT" ? "Overtime" : quarterLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ══ PERIOD SCORE TABLE ══ */}
      {periodColumns.length > 0 && (
        <View style={{ backgroundColor: "#171a2c", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#6B7280", marginBottom: 10 }}>
            {periodTypeLabel} Breakdown
          </Text>
          <View style={{ backgroundColor: "#111423", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ width: 112, fontSize: 9, color: "#4B5563", fontWeight: "700", letterSpacing: 1.2 }}>TEAM</Text>
              {periodColumns.map((periodNumber) => (
                <Text key={`col-${periodNumber}`} style={{ flex: 1, minWidth: 34, textAlign: "center", fontSize: 9, color: "#4B5563", fontWeight: "700", letterSpacing: 1.1, fontVariant: ["tabular-nums"] }}>
                  {getHockeyShortPeriodLabel(periodNumber, matchFormat)}
                </Text>
              ))}
              <Text style={{ width: 34, textAlign: "center", fontSize: 9, color: "#6B7280", fontWeight: "900", letterSpacing: 1.2, fontVariant: ["tabular-nums"] }}>T</Text>
            </View>
            {["home", "away"].map((side, index) => {
              return (
                <View
                  key={side}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Text style={{ width: 112, fontSize: 11, fontWeight: "800", color: side === "home" ? "#47feb7" : "#b8c3ff" }} numberOfLines={1}>
                    {side === "home" ? teamNames.home : teamNames.away}
                  </Text>
                  {periodColumns.map((periodNumber) => (
                    <Text key={`${side}-${periodNumber}`} style={{ flex: 1, minWidth: 34, textAlign: "center", fontSize: 13, fontWeight: "900", color: "#dfe1f9", fontVariant: ["tabular-nums"] }}>
                      {quarterScoreMap[side].get(periodNumber) ?? 0}
                    </Text>
                  ))}
                  <Text style={{ width: 34, textAlign: "center", fontSize: 14, fontWeight: "900", color: side === "home" ? "#47feb7" : "#b8c3ff", fontVariant: ["tabular-nums"] }}>
                    {side === "home" ? homeScore : awayScore}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ══ LIVE MATCH TIMELINE ══ */}
      <View
        style={{
          marginTop: 4,
          backgroundColor: UI.isDark ? "transparent" : UI.card,
          borderRadius: UI.isDark ? 0 : 16,
          padding: UI.isDark ? 0 : 14,
          borderWidth: UI.isDark ? 0 : 1,
          borderColor: UI.isDark ? "transparent" : UI.border,
          borderTopWidth: 1,
          borderTopColor: UI.isDark ? "rgba(255,255,255,0.06)" : UI.border,
          paddingTop: 14,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
            <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: UI.isDark ? "#6B7280" : UI.muted }}>
              Live Match Timeline
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {liveEvents?.length > 0 && (
              <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#4B5563" : UI.textMuted }}>
                {Math.min(liveEvents.length, 5)} recent
              </Text>
            )}
            {suspensionBadges.length > 0 && (
              <View style={{ flexDirection: "row", gap: 3 }}>
                {suspensionBadges.map((ev, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 8,
                      height: 12,
                      borderRadius: 1,
                      backgroundColor:
                        ev.eventType === "yellow_card" ? "#FFEB3B"
                          : ev.eventType === "green_card" ? "#4CAF50"
                          : "#F44336",
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {liveEvents?.length > 0 ? (
          liveEvents.slice(0, 5).map((ev, i) => {
            const visual = getHockeyEventVisual(ev.eventType, UI.isDark);
            const isHome = ev.teamSide === "home";
            const teamBadgeBg = UI.isDark
              ? (isHome ? "rgba(71,254,183,0.2)" : "rgba(184,195,255,0.2)")
              : (isHome ? "#DCFCE7" : "#E0E7FF");
            const teamBadgeText = UI.isDark
              ? (isHome ? "#47feb7" : "#b8c3ff")
              : (isHome ? "#15803D" : "#4338CA");
            return (
              <View
                key={ev._id || i}
                style={{
                  backgroundColor: visual.background,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  borderRadius: 12,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: visual.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: UI.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
                    }}
                  >
                    <Ionicons name={visual.icon} size={15} color={visual.color} />
                  </View>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: teamBadgeBg }}>
                    <Text style={{ fontSize: 9, fontWeight: "900", color: teamBadgeText }}>
                      {isHome ? "H" : "A"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 12, color: visual.color, textTransform: "capitalize" }} numberOfLines={1}>
                      {getHockeyEventLabel(ev.eventType)}
                    </Text>
                    {ev.playerName && (
                      <Text style={{ fontSize: 10, color: UI.isDark ? "#6B7280" : UI.textDim, marginTop: 1 }} numberOfLines={1}>
                        {ev.playerName}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={{ color: UI.isDark ? "#4B5563" : UI.textMuted, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {ev.gameTime || "—"}
                </Text>
              </View>
            );
          })
        ) : (
          <View
            style={{
              paddingVertical: 22,
              alignItems: "center",
              borderRadius: 12,
              backgroundColor: UI.isDark ? "transparent" : UI.cardElevated,
              borderWidth: UI.isDark ? 0 : 1,
              borderColor: UI.isDark ? "transparent" : UI.border,
            }}
          >
            <Text style={{ color: UI.isDark ? "#4B5563" : UI.textDim, fontSize: 12, fontStyle: "italic" }}>
              Waiting for kickoff…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
