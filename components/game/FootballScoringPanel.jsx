import { useEffect, useState, useMemo, useRef } from "react";
import { fonts } from "@/constants/typography";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { FORMATION_OPTIONS, assignPlayersToFormation, playerIdOf as formationPlayerId } from "./footballFormations";

/** Small WebP thumbs (~3–7KB) for fast load on buttons + play-by-play. */
const FOOTBALL_SCORE_ICONS = {
  goal: require("@/assets/images/football-scoring/thumbs/fb-score-goal.webp"),
  own_goal: require("@/assets/images/football-scoring/thumbs/fb-score-own-goal.webp"),
  penalty: require("@/assets/images/football-scoring/thumbs/fb-score-penalty.webp"),
  yellow_card: require("@/assets/images/football-scoring/thumbs/fb-score-yellow.webp"),
  red_card: require("@/assets/images/football-scoring/thumbs/fb-score-red.webp"),
  substitution: require("@/assets/images/football-scoring/thumbs/fb-score-sub.webp"),
  shot_on_target: require("@/assets/images/football-scoring/thumbs/fb-score-shot.webp"),
  corner: require("@/assets/images/football-scoring/thumbs/fb-score-corner.webp"),
  foul_committed: require("@/assets/images/football-scoring/thumbs/fb-score-foul.webp"),
  offside: require("@/assets/images/football-scoring/thumbs/fb-score-offside.webp"),
  gk_save: require("@/assets/images/football-scoring/thumbs/fb-score-save.webp"),
  free_kick: require("@/assets/images/football-scoring/thumbs/fb-score-freekick.webp"),
};

/** Map any football eventType → 3D icon key. */
const EVENT_TYPE_TO_3D_ICON = {
  goal: "goal",
  own_goal: "own_goal",
  penalty: "penalty",
  penalty_scored: "penalty",
  penalty_missed: "penalty",
  yellow_card: "yellow_card",
  red_card: "red_card",
  second_yellow: "yellow_card",
  substitution: "substitution",
  shot_on_target: "shot_on_target",
  shot: "shot_on_target",
  shot_off_target: "shot_on_target",
  shot_blocked: "shot_on_target",
  corner: "corner",
  foul: "foul_committed",
  foul_committed: "foul_committed",
  offside: "offside",
  gk_save: "gk_save",
  free_kick: "free_kick",
  assist: "goal",
};

/** Solid cricket-style raised button colors for football scoring actions. */
const FOOTBALL_SCORE_BUTTONS = {
  goal: { bg: "#16A34A", border: "#15803D", deep: "#166534", text: "#FFFFFF", label: "Goal", icon: "goal" },
  own_goal: { bg: "#DC2626", border: "#B91C1C", deep: "#991B1B", text: "#FFFFFF", label: "Own Goal", icon: "own_goal" },
  penalty: { bg: "#7C3AED", border: "#6D28D9", deep: "#5B21B6", text: "#FFFFFF", label: "Penalty", icon: "penalty" },
  yellow_card: { bg: "#EAB308", border: "#CA8A04", deep: "#A16207", text: "#FFFFFF", label: "Yellow", icon: "yellow_card" },
  red_card: { bg: "#EF4444", border: "#DC2626", deep: "#B91C1C", text: "#FFFFFF", label: "Red", icon: "red_card" },
  substitution: { bg: "#2563EB", border: "#1D4ED8", deep: "#1E40AF", text: "#FFFFFF", label: "Sub", icon: "substitution" },
  shot_on_target: { bg: "#0284C7", border: "#0369A1", deep: "#075985", text: "#FFFFFF", label: "Shot on Target", icon: "shot_on_target" },
  corner: { bg: "#0D9488", border: "#0F766E", deep: "#115E59", text: "#FFFFFF", label: "Corner", icon: "corner" },
  foul_committed: { bg: "#EA580C", border: "#C2410C", deep: "#9A3412", text: "#FFFFFF", label: "Foul", icon: "foul_committed" },
  offside: { bg: "#9333EA", border: "#7E22CE", deep: "#6B21A8", text: "#FFFFFF", label: "Offside", icon: "offside" },
  gk_save: { bg: "#059669", border: "#047857", deep: "#065F46", text: "#FFFFFF", label: "Save", icon: "gk_save" },
  free_kick: { bg: "#0EA5E9", border: "#0284C7", deep: "#0369A1", text: "#FFFFFF", label: "Free Kick", icon: "free_kick" },
};

const TRACKER_SCORE_TYPES = [
  "shot_on_target",
  "corner",
  "foul_committed",
  "offside",
  "gk_save",
  "free_kick",
];

const EXCLUDED_PLAY_BY_PLAY_TYPES = new Set(["undo"]);
const TIMELINE_PAGE_SIZE = 40;

const PLAY_BY_PLAY_FILTERS = [
  { id: "all", label: "All" },
  { id: "scoring", label: "Goals" },
  { id: "cards", label: "Cards" },
  { id: "match", label: "Match" },
];

const SCORING_EVENT_TYPES = new Set(["goal", "own_goal", "penalty_scored", "penalty_missed", "assist"]);
const CARD_EVENT_TYPES = new Set(["yellow_card", "red_card", "second_yellow"]);
const MATCH_EVENT_TYPES = new Set([
  "shot_on_target",
  "shot",
  "shot_off_target",
  "shot_blocked",
  "corner",
  "foul",
  "foul_committed",
  "offside",
  "gk_save",
  "free_kick",
  "substitution",
]);

const TEAM_SELECTION_EVENTS = new Set([
  "goal",
  "own_goal",
  "penalty",
  "penalty_scored",
  "penalty_missed",
  "yellow_card",
  "red_card",
  "shot_on_target",
  "corner",
  "foul_committed",
  "offside",
  "gk_save",
  "free_kick",
]);

const normalizeFootballEventType = (type) => (type === "foul" ? "foul_committed" : type);

const sortFootballEventsNewestFirst = (events = []) =>
  events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event?.eventType && !EXCLUDED_PLAY_BY_PLAY_TYPES.has(event.eventType))
    .sort((a, b) => {
      const minuteA = Number(a.event.minute);
      const minuteB = Number(b.event.minute);
      const hasMinuteA = Number.isFinite(minuteA);
      const hasMinuteB = Number.isFinite(minuteB);
      if (hasMinuteA && hasMinuteB && minuteB !== minuteA) return minuteB - minuteA;
      if (hasMinuteB && !hasMinuteA) return 1;
      if (hasMinuteA && !hasMinuteB) return -1;
      return b.index - a.index;
    })
    .map(({ event }) => event);

const matchesPlayByPlayFilter = (event, filterId) => {
  const type = normalizeFootballEventType(event?.eventType);
  if (filterId === "scoring") return SCORING_EVENT_TYPES.has(type);
  if (filterId === "cards") return CARD_EVENT_TYPES.has(type);
  if (filterId === "match") return MATCH_EVENT_TYPES.has(type);
  return true;
};

const accentSoftBg = (UI, strong = false) => (
  UI.isDark
    ? (strong ? "rgba(71,254,183,0.2)" : "rgba(71,254,183,0.08)")
    : (strong ? "rgba(17,24,39,0.1)" : "rgba(17,24,39,0.05)")
);
const accentSoftBorder = (UI, strong = false) => (
  UI.isDark
    ? (strong ? "rgba(71,254,183,0.6)" : "rgba(71,254,183,0.25)")
    : (strong ? "rgba(17,24,39,0.4)" : "rgba(17,24,39,0.18)")
);

const FOOTBALL_EVENT_VISUALS = {
  goal: { icon: "football", ionColor: "#47feb7", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.28)", label: "Goal" },
  own_goal: { icon: "football-outline", ionColor: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", label: "Own Goal" },
  penalty_scored: { icon: "checkmark-circle", ionColor: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.28)", label: "Penalty Goal" },
  penalty_missed: { icon: "close-circle", ionColor: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", label: "Penalty Miss" },
  yellow_card: { icon: "card", ionColor: "#facc15", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.28)", label: "Yellow Card" },
  red_card: { icon: "card", ionColor: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.28)", label: "Red Card" },
  shot_on_target: { icon: "radio-button-on", ionColor: "#60a5fa", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.22)", label: "Shot on Target" },
  corner: { icon: "flag", ionColor: "#2dd4bf", bg: "rgba(20,184,166,0.1)", border: "rgba(20,184,166,0.22)", label: "Corner" },
  foul_committed: { icon: "warning", ionColor: "#fb923c", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.22)", label: "Foul" },
  offside: { icon: "remove-circle-outline", ionColor: "#c084fc", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.22)", label: "Offside" },
  gk_save: { icon: "hand-left", ionColor: "#34d399", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.22)", label: "Save" },
  free_kick: { icon: "flash", ionColor: "#38bdf8", bg: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.22)", label: "Free Kick" },
  substitution: { icon: "swap-horizontal", ionColor: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.22)", label: "Substitution" },
  foul: { icon: "warning", ionColor: "#fb923c", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.22)", label: "Foul" },
  second_yellow: { icon: "card", ionColor: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.22)", label: "2nd Yellow" },
  shot: { icon: "radio-button-off", ionColor: "#93c5fd", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.18)", label: "Shot" },
  shot_off_target: { icon: "radio-button-off", ionColor: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)", label: "Shot Off Target" },
  assist: { icon: "git-network", ionColor: "#4ade80", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", label: "Assist" },
};

const TRACKER_EVENTS = TRACKER_SCORE_TYPES.map((type) => ({
  type,
  ...FOOTBALL_EVENT_VISUALS[type],
  ...FOOTBALL_SCORE_BUTTONS[type],
}));

function SectionLabel({ children }) {
  const UI = useGameScoringTheme();
  return (
    <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase", color: UI.muted, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function FootballScoreIcon({ name, size = 34 }) {
  const source = FOOTBALL_SCORE_ICONS[name] || FOOTBALL_SCORE_ICONS[EVENT_TYPE_TO_3D_ICON[name]];
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

function footballEventIconKey(type) {
  const normalized = normalizeFootballEventType(type);
  return EVENT_TYPE_TO_3D_ICON[normalized] || EVENT_TYPE_TO_3D_ICON[type] || null;
}

function raisedScoreShadow(isDark) {
  return {
    shadowColor: isDark ? "#000000" : "#64748B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: isDark ? 0.42 : 0.3,
    shadowRadius: 5,
    elevation: 7,
  };
}

function getFootballPeriodLabel(currentHalf, matchStatus) {
  if (matchStatus === "penalties") return "Penalties";
  if (currentHalf === 1) return "1st Half";
  if (currentHalf === 2) return "2nd Half";
  if (currentHalf === 3) return "ET — 1st";
  if (currentHalf === 4) return "ET — 2nd";
  return "Match";
}

function getFlipBoardTheme(isDark) {
  if (isDark) {
    return {
      board: "#1C1C1E",
      boardBorder: "#2C2C2E",
      tile: "#3A3A3C",
      tileBorder: "#2C2C2E",
      divider: "#1C1C1E",
      hinge: "rgba(0,0,0,0.45)",
      digit: "#FFFFFF",
      vs: "#8E8E93",
    };
  }
  return {
    board: "#ECEDEF",
    boardBorder: "#D1D5DB",
    tile: "#F8FAFC",
    tileBorder: "#CBD5E1",
    divider: "#94A3B8",
    hinge: "rgba(15,23,42,0.12)",
    digit: "#111827",
    vs: "#64748B",
  };
}

/** Split-flap / flip-clock score digits (padded to 2). */
function FlipScoreDigits({ value = 0, compact = false, theme }) {
  const digits = String(Math.max(0, Math.min(99, Number(value) || 0))).padStart(2, "0").split("");
  const tileW = compact ? 36 : 44;
  const tileH = compact ? 52 : 64;
  const fontSize = compact ? 34 : 42;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.board,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.boardBorder,
        overflow: "hidden",
        padding: 3,
        gap: 0,
      }}
    >
      {digits.map((d, i) => (
        <View
          key={`${i}-${d}`}
          style={{
            width: tileW,
            height: tileH,
            backgroundColor: theme.tile,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: theme.tileBorder,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: i === 0 ? 0 : 3,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.scoreDisplay,
              fontSize,
              lineHeight: fontSize + 2,
              color: theme.digit,
              fontVariant: ["tabular-nums"],
              includeFontPadding: false,
              textAlign: "center",
            }}
          >
            {d}
          </Text>
          {/* Horizontal flip hinge */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 2,
              right: 2,
              top: "50%",
              height: 1,
              marginTop: -0.5,
              backgroundColor: theme.hinge,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function FootballScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
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
}) {
  const UI = useGameScoringTheme();
  const flip = getFlipBoardTheme(UI.isDark);
  const teamColor = (side) => (side === "home" ? UI.home : UI.away);
  const homeScore = sport?.score?.home ?? 0;
  const awayScore = sport?.score?.away ?? 0;
  const currentHalf = sport?.currentHalf || sport?.currentPeriod || 1;
  const matchStatus = sport?.matchStatus || "scheduled";
  const penalties = sport?.result?.penalties_score || { home: 0, away: 0 };
  const announcedAddedTime = sport?.addedTime || 0;
  const periodLabel = getFootballPeriodLabel(currentHalf, matchStatus);

  return (
    <View style={{
      backgroundColor: UI.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: UI.border,
      overflow: "hidden",
      marginBottom: compact ? 0 : 14,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          backgroundColor: isLive
            ? (UI.isDark ? "rgba(34,197,94,0.14)" : "#DCFCE7")
            : gameOver
              ? (UI.isDark ? "rgba(168,85,247,0.14)" : "#F3E8FF")
              : UI.warningBg,
          borderWidth: 1,
          borderColor: isLive
            ? (UI.isDark ? "rgba(34,197,94,0.3)" : "#86EFAC")
            : gameOver
              ? (UI.isDark ? "rgba(168,85,247,0.3)" : "#D8B4FE")
              : UI.warningBorder,
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: "800",
            color: isLive
              ? (UI.isDark ? "#4ade80" : "#15803D")
              : gameOver
                ? (UI.isDark ? "#c084fc" : "#7E22CE")
                : UI.warning,
            letterSpacing: 1,
          }}>
            {periodLabel.toUpperCase()}
          </Text>
        </View>
        {announcedAddedTime > 0 ? (
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700" }}>+{announcedAddedTime} stoppage</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 14, paddingTop: 6 }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: teamColor("home"), fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }} numberOfLines={1}>
            {teamNames.home}
          </Text>
          <FlipScoreDigits value={homeScore} compact={compact} theme={flip} />
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 64 }}>
          {matchStatus === "penalties" ? (
            <>
              <Text style={{ color: UI.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Pens</Text>
              <FlipScoreDigits value={penalties.home} compact theme={flip} />
              <Text style={{ color: flip.vs, fontSize: 11, fontWeight: "800", marginVertical: 4 }}>—</Text>
              <FlipScoreDigits value={penalties.away} compact theme={flip} />
            </>
          ) : (
            <Text style={{
              fontFamily: fonts.scoreDisplay,
              color: flip.vs,
              fontSize: compact ? 22 : 28,
              lineHeight: compact ? 22 : 28,
              marginBottom: 2,
            }}>
              :
            </Text>
          )}
          {isScheduled && isOwner && onStartGame ? (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{ marginTop: 10, backgroundColor: UI.goal, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 10, letterSpacing: 1 }}>START</Text>
            </TouchableOpacity>
          ) : null}
          {isLive && isOwner && !gameOver ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {onPauseResume ? (
                <TouchableOpacity onPress={onPauseResume} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: UI.warningBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={16} color={UI.warningStrong} />
                </TouchableOpacity>
              ) : null}
              {onEndGame ? (
                <TouchableOpacity onPress={onEndGame} style={{ paddingHorizontal: 10, height: 34, borderRadius: 10, backgroundColor: UI.isDark ? "rgba(239,68,68,0.2)" : UI.dangerBg, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: UI.dangerText, fontWeight: "800", fontSize: 10 }}>END</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: teamColor("away"), fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }} numberOfLines={1}>
            {teamNames.away}
          </Text>
          <FlipScoreDigits value={awayScore} compact={compact} theme={flip} />
        </View>
      </View>
    </View>
  );
}

function FootballScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  isUpdating,
  onEvent,
  onSubstitution,
  onSetupLineup,
  onMatchStateChange,
  onTimerAdjust,
  gameOver,
  displayOnly = false,
  userSide = "home",
  isOwner = false,
  isSelfOwnedOpponent = false,
  onPauseResume,
  onStartGame,
  onEndGame,
  onEndShootout,
  hideScoreboard = false,
}) {
  const UI = useGameScoringTheme();
  const teamColor = (side) => (side === "home" ? UI.home : UI.away);
  const teamBg = (side) => side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.12)" : "rgba(17,24,39,0.07)")
    : (UI.isDark ? "rgba(184,195,255,0.12)" : "rgba(100,116,139,0.10)");
  const teamBorder = (side) => side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.35)" : "rgba(17,24,39,0.22)")
    : (UI.isDark ? "rgba(184,195,255,0.35)" : "rgba(100,116,139,0.25)");
  const [pendingEvent, setPendingEvent] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [lineupSide, setLineupSide] = useState(null);
  const [lineupModalKey, setLineupModalKey] = useState(0);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [timelinePageSize, setTimelinePageSize] = useState(TIMELINE_PAGE_SIZE);
  const [showStoppageControls, setShowStoppageControls] = useState(false);

  useEffect(() => {
    if (!showTimelineModal) {
      setTimelineFilter("all");
      setTimelinePageSize(TIMELINE_PAGE_SIZE);
    }
  }, [showTimelineModal]);

  const sportData = currentGame?.sport || {};
  const homeId = String(currentGame?.base?.teamId || "");
  const userIsHome = userSide === "home";
  const opponentSide = userIsHome ? "away" : "home";

  const userTeamName = userIsHome ? teamNames?.home : teamNames?.away;
  const opponentTeamName = userIsHome ? teamNames?.away : teamNames?.home;
  const penaltiesScore = sportData?.result?.penalties_score || { home: 0, away: 0 };

  const getTeamPlayers = (side) =>
    (players?.[side] || []).filter((p) => p && p.role !== "manager");

  const getPlayerId = (player) => String(player?._id || player?.id || player?.playerId || "");
  const getPlayerName = (player) => {
    if (!player) return "—";
    const full = [player.firstName, player.lastName].filter(Boolean).join(" ");
    return full || player.playerName || "Player";
  };

  const currentHalf = sportData?.currentHalf || sportData?.currentPeriod || 1;
  const HALF_LABELS = { 1: "1st Half", 2: "2nd Half", 3: "ET 1st", 4: "ET 2nd" };
  const disabled = isUpdating || gameOver;
  const gameStatus = currentGame?.base?.status;
  const isLive = gameStatus === "live";
  const canManageBothTeams = isSelfOwnedOpponent;
  const managedSides = canManageBothTeams ? ["home", "away"] : [userSide];

  const countStartingXI = (lineup) => {
    if (!Array.isArray(lineup)) return 0;
    return lineup.filter(
      (player) => !player.isSubstitute && (player.substitutionMinute == null || player.substitutionMinute === undefined),
    ).length;
  };

  const hasValidStartingXI = (side) => {
    const lineup = side === "home" ? sportData?.homeLineup : sportData?.awayLineup;
    return countStartingXI(lineup) === 11;
  };

  const needsLineupSetup = (side) => getTeamPlayers(side).length > 11 && !hasValidStartingXI(side);

  const lineupSetupBlocking = isLive && isOwner && managedSides.some((side) => needsLineupSetup(side));
  const scoringDisabled = disabled || !isLive || lineupSetupBlocking;

  const startingXIConfigs = managedSides.map((side) => ({
    side,
    teamName: side === userSide ? userTeamName : opponentTeamName,
    squadSize: getTeamPlayers(side).length,
    hasSavedLineup: hasValidStartingXI(side),
    needsSetup: needsLineupSetup(side),
  }));

  const autoLineupSetupRef = useRef(false);
  useEffect(() => {
    if (displayOnly || !isLive || !onSetupLineup || autoLineupSetupRef.current || showLineupModal) return;

    const autoSides = managedSides.filter((side) => {
      const squad = getTeamPlayers(side);
      return squad.length > 0 && squad.length <= 11 && !hasValidStartingXI(side);
    });

    if (autoSides.length > 0) {
      autoLineupSetupRef.current = true;
      autoSides.forEach((side) => {
        const squad = getTeamPlayers(side);
        onSetupLineup({ side, starters: squad, bench: [] });
      });
      return;
    }

    const firstUnset = managedSides.find((side) => needsLineupSetup(side));
    if (firstUnset) {
      autoLineupSetupRef.current = true;
      setLineupSide(firstUnset);
      setShowLineupModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGame?.base?.status, sportData?.homeLineup, sportData?.awayLineup]);

  const rawMatchStatus = sportData?.matchStatus || (isLive ? "first_half" : "scheduled");
  const matchStatus = isLive && ["scheduled", "warmup"].includes(rawMatchStatus)
    ? "first_half"
    : rawMatchStatus;
  const announcedAddedTime = sportData?.addedTime || 0;
  const liveMinute = gameTime?.minutes ?? sportData?.currentMinute ?? 0;
  const liveSecond = gameTime?.seconds ?? sportData?.currentSecond ?? 0;

  const getLineupBuckets = (side) => {
    const lineup = side === "home" ? sportData?.homeLineup || [] : sportData?.awayLineup || [];
    const rosterById = new Map(getTeamPlayers(side).map((player) => [getPlayerId(player), player]));
    const mappedLineup = lineup
      .map((entry) => {
        const playerId = String(entry?.playerId || "");
        if (!playerId) return null;
        const rosterPlayer = rosterById.get(playerId);
        return {
          ...rosterPlayer,
          ...entry,
          _id: playerId,
          id: playerId,
          firstName: rosterPlayer?.firstName || entry?.playerName || entry?.firstName || "Player",
          lastName: rosterPlayer?.lastName || entry?.lastName || "",
          jerseyNumber: rosterPlayer?.jerseyNumber ?? entry?.jerseyNumber,
        };
      })
      .filter(Boolean);

    if (mappedLineup.length === 0) {
      const squad = getTeamPlayers(side);
      if (squad.length <= 11) {
        return { onField: squad, bench: [], subbedOff: [] };
      }
      return { onField: [], bench: [], subbedOff: [] };
    }

    const hasLeftPitch = (player) =>
      player.substitutionMinute != null && player.substitutionMinute !== undefined;

    const onField = mappedLineup.filter(
      (player) => !player.isSubstitute && !hasLeftPitch(player),
    );
    const bench = mappedLineup.filter(
      (player) => !!player.isSubstitute && !hasLeftPitch(player),
    );
    const subbedOff = mappedLineup.filter((player) => hasLeftPitch(player));

    return { onField, bench, subbedOff };
  };

  const availableSubstitutionSides = useMemo(
    () => (isSelfOwnedOpponent ? ["home", "away"] : [userSide]),
    [isSelfOwnedOpponent, userSide],
  );
  const lineupsBySide = useMemo(
    () => ({
      home: getLineupBuckets("home"),
      away: getLineupBuckets("away"),
    }),
    [
      sportData?.homeLineup,
      sportData?.awayLineup,
      players?.home,
      players?.away,
    ],
  );
  const teamNamesBySide = useMemo(
    () => ({ home: teamNames?.home || "Home", away: teamNames?.away || "Away" }),
    [teamNames?.home, teamNames?.away],
  );

  const handleMatchStatePress = (nextState) => {
    if (!onMatchStateChange || disabled) return;
    onMatchStateChange(nextState);
  };

  const handleTimerAdjust = (deltaSeconds) => {
    if (!onTimerAdjust || disabled) return;
    onTimerAdjust({ deltaSeconds });
  };

  // All events require player selection now (with Skip option for team-level ones)
  const PLAYER_EVENTS = [
    "goal", "own_goal", "penalty_scored", "penalty_missed",
    "yellow_card", "red_card",
    "shot_on_target", "corner", "foul_committed", "offside", "gk_save", "free_kick",
  ];

  // ── Yellow card tracking for second-yellow → red ──
  const allEvents = useMemo(() =>
    (sportData?.events || []).filter((e) => e != null && typeof e === "object" && e.eventType),
    [sportData?.events]);

  const getPlayerYellowCount = (playerId) => {
    if (!playerId) return 0;
    return allEvents.filter(
      (e) => e.eventType === "yellow_card" && String(e.playerId) === String(playerId),
    ).length;
  };

  // ── Sent-off players (red card or 2 yellows) ──
  const sentOffPlayerIds = useMemo(() => {
    const ids = new Set();
    const yellowCounts = {};
    for (const e of allEvents) {
      const pid = e.playerId ? String(e.playerId) : null;
      if (!pid) continue;
      if (e.eventType === "red_card" || e.eventType === "second_yellow") {
        ids.add(pid);
      } else if (e.eventType === "yellow_card") {
        yellowCounts[pid] = (yellowCounts[pid] || 0) + 1;
        if (yellowCounts[pid] >= 2) ids.add(pid);
      }
    }
    return ids;
  }, [allEvents]);

  const getEligibleFieldPlayers = (side) => {
    const onField = lineupsBySide?.[side]?.onField || [];
    if (onField.length > 0) {
      return onField.filter((player) => !sentOffPlayerIds.has(getPlayerId(player)));
    }
    return getTeamPlayers(side)
      .slice(0, 11)
      .filter((player) => !sentOffPlayerIds.has(getPlayerId(player)));
  };

  // ── Submit helpers ──
  const submitEvent = (eventType, teamSide, playerId, extraData = {}) => {
    onEvent(eventType, teamSide, playerId, extraData);
    setPendingEvent(null);
    setSelectedTeam(null);
  };

  const handleEventClick = (eventType) => {
    if (scoringDisabled || displayOnly) return;
    const requiresTeamChoice = TEAM_SELECTION_EVENTS.has(eventType);
    const needsPlayer = PLAYER_EVENTS.includes(eventType);
    setPendingEvent({
      eventType,
      step: requiresTeamChoice ? "team" : (needsPlayer ? "player" : null),
      needsPlayer,
    });
    setSelectedTeam(requiresTeamChoice ? null : userSide);
    if (!requiresTeamChoice && !needsPlayer) {
      submitEvent(eventType, userSide, null);
    }
  };

  const handlePenaltyClick = () => {
    if (scoringDisabled || displayOnly) return;
    setPendingEvent({
      eventType: "penalty",
      step: "team",
      needsPlayer: true,
      isPenalty: true,
    });
    setSelectedTeam(null);
  };

  const handleShootoutPenaltyClick = () => {
    if (scoringDisabled || displayOnly) return;
    setPendingEvent({
      eventType: "penalty",
      step: "team",
      needsPlayer: true,
      isPenalty: true,
      isShootout: true,
    });
    setSelectedTeam(null);
  };

  const handleTeamSelect = (side) => {
    setSelectedTeam(side);
    if (pendingEvent?.needsPlayer) {
      setPendingEvent({ ...pendingEvent, step: "player" });
    } else {
      // Team-level event with no player — use null so backend uses team placeholder
      submitEvent(pendingEvent.eventType, side, null);
    }
  };

  const handlePlayerSelect = (player) => {
    if (!player && player !== "TEAM") return;
    const playerId = player === "TEAM" ? null : getPlayerId(player);

    if (pendingEvent?.isPenalty) {
      setPendingEvent({ ...pendingEvent, step: "penalty_outcome", playerId });
      return;
    }

    if (pendingEvent?.eventType === "yellow_card" && playerId) {
      // Check for second yellow
      const yellowCount = getPlayerYellowCount(playerId);
      if (yellowCount >= 1) {
        Alert.alert(
          "Second Yellow Card",
          "This player already has a yellow card. This will also result in a red card.",
          [
            { text: "Cancel", style: "cancel", onPress: () => cancelPending() },
            {
              text: "Confirm 2nd Yellow + Red",
              style: "destructive",
              onPress: () => {
                submitEvent("second_yellow", selectedTeam, playerId);
              },
            },
          ],
        );
        return;
      }
    }

    submitEvent(pendingEvent.eventType, selectedTeam, playerId);
  };

  const handlePenaltyOutcome = (scored) => {
    const penaltyPlayerId = pendingEvent?.playerId;
    if (!penaltyPlayerId) {
      cancelPending();
      return;
    }
    submitEvent(
      scored ? "penalty_scored" : "penalty_missed",
      selectedTeam,
      penaltyPlayerId,
      pendingEvent?.isShootout ? { isShootoutPenalty: true } : {},
    );
  };

  const cancelPending = () => {
    setPendingEvent(null);
    setSelectedTeam(null);
  };

  // ── Play-by-play (all match events, newest first) ──
  const allTimelineEvents = useMemo(
    () => sortFootballEventsNewestFirst(allEvents),
    [allEvents],
  );
  const filteredTimelineEvents = useMemo(
    () => allTimelineEvents.filter((event) => matchesPlayByPlayFilter(event, timelineFilter)),
    [allTimelineEvents, timelineFilter],
  );
  const visibleTimelineEvents = useMemo(
    () => filteredTimelineEvents.slice(0, timelinePageSize),
    [filteredTimelineEvents, timelinePageSize],
  );
  const timelinePreview = useMemo(() => allTimelineEvents.slice(0, 5), [allTimelineEvents]);

  if (!currentGame) return null;

  const getPlayerShort = (playerId) => {
    if (!playerId) return "—";
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const p = all.find((pl) => pl && String(pl._id || pl.id) === String(playerId));
    if (!p) return "—";
    return getPlayerName(p);
  };

  const getEventBadge = (type, event) => {
    const normalizedType = normalizeFootballEventType(type);
    const visual = FOOTBALL_EVENT_VISUALS[normalizedType] || FOOTBALL_EVENT_VISUALS[type] || {
      icon: "ellipse-outline",
      ionColor: UI.muted,
      bg: UI.card,
      border: UI.border,
      label: type?.replace(/_/g, " ") || "Event",
    };
    const icon3d = footballEventIconKey(normalizedType) || footballEventIconKey(type);
    let badge = { ...visual, icon3d };
    if (event?.isShootoutPenalty && type === "penalty_scored") {
      badge = { ...badge, label: "Shootout Goal" };
    }
    if (event?.isShootoutPenalty && type === "penalty_missed") {
      badge = { ...badge, label: "Shootout Miss" };
    }
    return badge;
  };

  const isScheduled = gameStatus === "scheduled";
  const startGoalFlow = (side, eventType = "goal") => {
    if (scoringDisabled || displayOnly) return;
    setSelectedTeam(side);
    setPendingEvent({
      eventType,
      step: "player",
      needsPlayer: true,
    });
  };

  const getFootballClockDisplay = () => {
    const baseMinuteMap = { 1: 45, 2: 90, 3: 105, 4: 120 };
    const baseMinute = baseMinuteMap[currentHalf] || liveMinute;
    const currentAddedTime = Math.max(0, liveMinute - baseMinute);
    const displayMinute = currentAddedTime > 0 ? `${baseMinute}+${currentAddedTime}` : `${liveMinute}`;

    return {
      displayMinute,
      currentAddedTime,
      baseMinute,
    };
  };

  const { displayMinute: currentDisplayMinute, currentAddedTime } = getFootballClockDisplay();

  // ── Active card strip (yellow/red per player, with minute) ──
  const activeCards = useMemo(() => {
    const cards = [];
    const seenRed = new Set();
    const yellowsByPlayer = {};

    for (const e of allEvents) {
      const pid = e.playerId ? String(e.playerId) : null;
      const tSide = String(e.teamId) === homeId ? "home" : "away";
      const min = e.minute != null ? e.minute : null;

      if (e.eventType === "yellow_card" && pid) {
        if (!yellowsByPlayer[pid]) yellowsByPlayer[pid] = [];
        yellowsByPlayer[pid].push({ min, tSide, teamId: e.teamId });
      }
      if ((e.eventType === "red_card" || e.eventType === "second_yellow") && pid && !seenRed.has(pid)) {
        seenRed.add(pid);
        cards.push({ type: "red", pid, tSide, teamId: e.teamId, min });
      }
    }

    // Add players with yellow cards (not already red-carded)
    for (const [pid, yCards] of Object.entries(yellowsByPlayer)) {
      if (seenRed.has(pid)) continue; // red already shown
      const last = yCards[yCards.length - 1];
      cards.push({ type: yCards.length >= 2 ? "double_yellow" : "yellow", pid, tSide: last.tSide, teamId: last.teamId, min: last.min, count: yCards.length });
    }

    return cards;
  }, [allEvents, homeId]);

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  const pendingVisual = pendingEvent
    ? getEventBadge(pendingEvent.isPenalty ? "penalty_scored" : pendingEvent.eventType)
    : null;

  const renderPlayerPicker = () => (
    <ScrollView
      style={{ maxHeight: 360 }}
      contentContainerStyle={{ paddingBottom: 8 }}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      {getEligibleFieldPlayers(selectedTeam).map((p) => {
          const pid = getPlayerId(p);
          const isSentOff = sentOffPlayerIds.has(pid);
          return (
            <TouchableOpacity
              key={pid}
              onPress={isSentOff ? undefined : () => handlePlayerSelect(p)}
              disabled={isSentOff}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 12,
                marginBottom: 6,
                borderRadius: 12,
                backgroundColor: isSentOff ? "rgba(239,68,68,0.06)" : UI.cardElevated,
                borderWidth: 1,
                borderColor: isSentOff ? "rgba(239,68,68,0.25)" : UI.border,
                opacity: isSentOff ? 0.5 : 1,
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: teamBg(selectedTeam),
                borderWidth: 1,
                borderColor: teamBorder(selectedTeam),
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: teamColor(selectedTeam), fontWeight: "900", fontSize: 12 }}>
                  {p.jerseyNumber || "·"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isSentOff ? "#f87171" : UI.text, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                  {getPlayerName(p)}
                </Text>
                {isSentOff ? (
                  <Text style={{ color: "#f87171", fontSize: 10, marginTop: 2 }}>Sent off</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={UI.muted} />
            </TouchableOpacity>
          );
        })}
    </ScrollView>
  );

  const getTimelineEventSubtitle = (event) => {
    if (event?.eventType === "substitution" && event?.playerInId) {
      const playerIn = getPlayerShort(event.playerInId);
      const playerOut = getPlayerShort(event.playerId);
      if (playerIn !== "—" && playerOut !== "—") return `${playerOut} → ${playerIn}`;
    }
    const side = String(event?.teamId) === homeId ? "home" : "away";
    return side === "home" ? teamNames?.home : teamNames?.away;
  };

  const renderTimelineRow = (e, index) => {
    if (!e) return null;
    const badge = getEventBadge(e.eventType, e);
    const eIsHome = String(e.teamId) === homeId;
    const subtitle = getTimelineEventSubtitle(e);
    return (
      <View
        key={`${e.eventType}-${e.playerId}-${e.minute}-${index}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 10,
          borderRadius: 12,
          marginBottom: 6,
          backgroundColor: eIsHome
            ? (UI.isDark ? "rgba(71,254,183,0.05)" : "rgba(17,24,39,0.04)")
            : (UI.isDark ? "rgba(184,195,255,0.05)" : "rgba(100,116,139,0.06)"),
          borderLeftWidth: 3,
          borderLeftColor: eIsHome ? UI.home : UI.away,
        }}
      >
        <Text style={{ color: UI.muted, width: 32, textAlign: "right", fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {e.minute != null ? `${e.minute}'` : "—"}
        </Text>
        <View style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: UI.isDark ? badge.bg : "#FFFFFF",
          borderWidth: 1,
          borderColor: UI.isDark ? badge.border : UI.border,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          {badge.icon3d ? (
            <FootballScoreIcon name={badge.icon3d} size={28} />
          ) : (
            <Ionicons name={badge.icon} size={14} color={badge.ionColor} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: UI.text, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
            {e?.eventType === "substitution" ? badge.label : getPlayerShort(e?.playerId)}
          </Text>
          <Text style={{ color: UI.muted, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
            {badge.label}{subtitle ? ` · ${subtitle}` : ""}
          </Text>
        </View>
      </View>
    );
  };

  const renderPendingEventModal = () => {
    if (!pendingEvent || displayOnly) return null;

    const teamPickerSides = isSelfOwnedOpponent ? ["home", "away"] : [];

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={cancelPending}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: UI.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: UI.border,
            borderBottomWidth: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
            maxHeight: "88%",
          }}>
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border }} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: UI.isDark ? pendingVisual?.bg : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: UI.isDark ? pendingVisual?.border : UI.border,
                  alignItems: "center", justifyContent: "center",
                }}>
                  {pendingVisual?.icon3d ? (
                    <FootballScoreIcon name={pendingVisual.icon3d} size={34} />
                  ) : (
                    <Ionicons name={pendingVisual?.icon || "football"} size={20} color={pendingVisual?.ionColor || UI.text} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: UI.text, fontWeight: "800", fontSize: 15 }}>
                    {pendingEvent.isPenalty ? "Penalty Kick" : pendingVisual?.label}
                  </Text>
                  <Text style={{ color: UI.muted, fontSize: 11, marginTop: 2 }}>
                    {pendingEvent.step === "team"
                      ? "Which team?"
                      : pendingEvent.step === "player"
                        ? "Tap a player"
                        : "Scored or missed?"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={cancelPending}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.cardElevated, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={20} color={UI.muted} />
              </TouchableOpacity>
            </View>

            {pendingEvent.step === "team" && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {teamPickerSides.map((side) => (
                  <TouchableOpacity
                    key={side}
                    onPress={() => handleTeamSelect(side)}
                    style={{
                      flex: 1,
                      backgroundColor: teamBg(side),
                      borderWidth: 1.5,
                      borderColor: teamBorder(side),
                      borderRadius: 14,
                      paddingVertical: 22,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: teamColor(side), fontWeight: "900", fontSize: 14 }} numberOfLines={2}>
                      {side === "home" ? teamNames?.home : teamNames?.away}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {pendingEvent.step === "player" && selectedTeam && (
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ color: teamColor(selectedTeam), fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", flex: 1 }} numberOfLines={1}>
                    {selectedTeam === userSide ? userTeamName : opponentTeamName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handlePlayerSelect("TEAM")}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: UI.cardElevated }}
                  >
                    <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700" }}>Skip player</Text>
                  </TouchableOpacity>
                </View>
                {renderPlayerPicker()}
              </View>
            )}

            {pendingEvent.step === "penalty_outcome" && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => handlePenaltyOutcome(true)}
                  style={{ flex: 1, backgroundColor: "rgba(34,197,94,0.14)", borderWidth: 1.5, borderColor: "rgba(34,197,94,0.35)", borderRadius: 14, paddingVertical: 22, alignItems: "center" }}
                >
                  <Ionicons name="checkmark-circle" size={36} color="#4ade80" />
                  <Text style={{ color: "#4ade80", fontWeight: "900", fontSize: 13, marginTop: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Scored</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePenaltyOutcome(false)}
                  style={{ flex: 1, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1.5, borderColor: "rgba(239,68,68,0.3)", borderRadius: 14, paddingVertical: 22, alignItems: "center" }}
                >
                  <Ionicons name="close-circle" size={36} color="#f87171" />
                  <Text style={{ color: "#f87171", fontWeight: "900", fontSize: 13, marginTop: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Missed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={{ width: "100%" }}>

      {!hideScoreboard ? (
        <FootballScoreboardCard
          sport={sportData}
          teamNames={teamNames}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={isOwner}
          isUpdating={isUpdating}
          onPauseResume={onPauseResume}
          onStartGame={onStartGame}
          onEndGame={onEndGame}
        />
      ) : null}

      {activeCards.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <SectionLabel>On-field discipline</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {activeCards.map((card, i) => {
              const isYellow = card.type === "yellow" || card.type === "double_yellow";
              const playerName = getPlayerShort(card.pid);
              const teamName = card.tSide === "home" ? teamNames?.home : teamNames?.away;
              return (
                <View
                  key={`card-${card.pid}-${i}`}
                  style={{
                    minWidth: 128,
                    backgroundColor: isYellow ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)",
                    borderWidth: 1,
                    borderColor: isYellow ? "rgba(234,179,8,0.28)" : "rgba(239,68,68,0.28)",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: teamColor(card.tSide), fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }} numberOfLines={1}>
                    {teamName}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <View style={{ width: 10, height: 14, borderRadius: 2, backgroundColor: isYellow ? "#facc15" : "#ef4444" }} />
                    <Text style={{ color: UI.text, fontSize: 12, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                      {playerName}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {renderPendingEventModal()}

      {!displayOnly && (
        <View style={{ backgroundColor: UI.card, borderRadius: 18, borderWidth: 1, borderColor: UI.border, padding: 14 }}>

          {lineupSetupBlocking ? (
            <View style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              backgroundColor: UI.isDark ? "rgba(59,130,246,0.12)" : "#EFF6FF",
              borderWidth: 1,
              borderColor: UI.isDark ? "rgba(59,130,246,0.35)" : "#93C5FD",
            }}>
              <Text style={{ color: UI.isDark ? "#93c5fd" : "#1D4ED8", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Set starting XI before scoring
              </Text>
              <Text style={{ color: UI.muted, fontSize: 11, lineHeight: 16 }}>
                Your squad has more than 11 players. Choose who starts on the pitch and who is on the bench.
              </Text>
            </View>
          ) : null}

          {onSetupLineup && isOwner && isLive ? (
            <View style={{ marginBottom: 14 }}>
              <SectionLabel>Starting XI</SectionLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {startingXIConfigs.map(({ side, teamName, hasSavedLineup, needsSetup, squadSize }) => (
                  <TouchableOpacity
                    key={`starting-xi-${side}`}
                    onPress={() => {
                      if (squadSize <= 11) return;
                      setLineupSide(side);
                      setShowLineupModal(true);
                    }}
                    disabled={disabled || squadSize <= 11}
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
                      opacity: disabled || squadSize <= 11 ? 0.45 : 1,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                        {teamName}
                      </Text>
                      <Text style={{ color: UI.muted, fontSize: 10, marginTop: 2 }}>
                        {squadSize <= 11
                          ? `${squadSize} players — auto on pitch`
                          : needsSetup
                            ? "Tap to pick XI + bench"
                            : "XI saved"}
                      </Text>
                    </View>
                    <Ionicons
                      name={hasSavedLineup ? "checkmark-circle" : "people-outline"}
                      size={18}
                      color={hasSavedLineup ? "#4ade80" : "#60a5fa"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {!pendingEvent ? (
            <View>
              <SectionLabel>Score</SectionLabel>

              {isSelfOwnedOpponent ? (
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                  {["home", "away"].map((side) => {
                    const btn = FOOTBALL_SCORE_BUTTONS.goal;
                    return (
                      <TouchableOpacity
                        key={side}
                        onPress={() => startGoalFlow(side, "goal")}
                        disabled={scoringDisabled}
                        style={{
                          flex: 1,
                          backgroundColor: btn.bg,
                          borderRadius: 16,
                          paddingVertical: 18,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: btn.border,
                          borderBottomWidth: 5,
                          borderBottomColor: btn.deep,
                          opacity: scoringDisabled ? 0.45 : 1,
                          ...raisedScoreShadow(UI.isDark),
                        }}
                      >
                        <Text style={{ fontSize: 8, fontWeight: "900", letterSpacing: 2, color: "rgba(255,255,255,0.8)", marginBottom: 6 }} numberOfLines={1}>
                          {side === "home" ? teamNames?.home : teamNames?.away}
                        </Text>
                        <FootballScoreIcon name="goal" size={40} />
                        <Text style={{ fontSize: 18, fontWeight: "900", color: btn.text, marginTop: 6, letterSpacing: 1 }}>GOAL</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => startGoalFlow(userSide, "goal")}
                  disabled={scoringDisabled}
                  style={{
                    backgroundColor: FOOTBALL_SCORE_BUTTONS.goal.bg,
                    borderRadius: 16,
                    paddingVertical: 20,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: FOOTBALL_SCORE_BUTTONS.goal.border,
                    borderBottomWidth: 5,
                    borderBottomColor: FOOTBALL_SCORE_BUTTONS.goal.deep,
                    marginBottom: 12,
                    opacity: scoringDisabled ? 0.45 : 1,
                    ...raisedScoreShadow(UI.isDark),
                  }}
                >
                  <FootballScoreIcon name="goal" size={48} />
                  <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 20, marginTop: 8, letterSpacing: 1 }}>RECORD GOAL</Text>
                  <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, marginTop: 4 }}>{userTeamName}</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                {[
                  { key: "own_goal", onPress: () => handleEventClick("own_goal"), label: "Own Goal" },
                  {
                    key: "penalty",
                    onPress: matchStatus === "penalties" ? handleShootoutPenaltyClick : handlePenaltyClick,
                    label: matchStatus === "penalties" ? "Shootout" : "Penalty",
                  },
                ].map((item) => {
                  const btn = FOOTBALL_SCORE_BUTTONS[item.key];
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={item.onPress}
                      disabled={scoringDisabled}
                      style={{
                        flex: 1,
                        backgroundColor: btn.bg,
                        borderRadius: 14,
                        paddingVertical: 14,
                        paddingHorizontal: 10,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: btn.border,
                        borderBottomWidth: 4,
                        borderBottomColor: btn.deep,
                        opacity: scoringDisabled ? 0.45 : 1,
                        ...raisedScoreShadow(UI.isDark),
                      }}
                    >
                      <FootballScoreIcon name={btn.icon} size={36} />
                      <Text style={{ color: btn.text, fontWeight: "800", fontSize: 11, marginTop: 8, textTransform: "uppercase" }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <SectionLabel>Discipline & subs</SectionLabel>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                {[
                  { type: "yellow_card", onPress: () => handleEventClick("yellow_card") },
                  { type: "red_card", onPress: () => handleEventClick("red_card") },
                  { type: "substitution", onPress: () => setShowSubModal(true) },
                ].map((cardBtn) => {
                  const btn = FOOTBALL_SCORE_BUTTONS[cardBtn.type];
                  return (
                    <TouchableOpacity
                      key={cardBtn.type}
                      onPress={cardBtn.onPress}
                      disabled={scoringDisabled}
                      style={{
                        flex: 1,
                        backgroundColor: btn.bg,
                        borderRadius: 14,
                        paddingVertical: 14,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: btn.border,
                        borderBottomWidth: 4,
                        borderBottomColor: btn.deep,
                        opacity: scoringDisabled ? 0.45 : 1,
                        ...raisedScoreShadow(UI.isDark),
                      }}
                    >
                      <FootballScoreIcon name={btn.icon} size={34} />
                      <Text style={{ color: btn.text, fontWeight: "800", fontSize: 11, marginTop: 6, textTransform: "uppercase" }}>
                        {btn.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <SectionLabel>Match events</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {TRACKER_EVENTS.map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => handleEventClick(btn.type)}
                    disabled={scoringDisabled}
                    style={{
                      width: "48%",
                      backgroundColor: btn.bg,
                      borderWidth: 1,
                      borderColor: btn.border,
                      borderBottomWidth: 4,
                      borderBottomColor: btn.deep,
                      borderRadius: 14,
                      padding: 12,
                      minHeight: 84,
                      justifyContent: "space-between",
                      opacity: scoringDisabled ? 0.45 : 1,
                      ...raisedScoreShadow(UI.isDark),
                    }}
                  >
                    <FootballScoreIcon name={btn.icon || btn.type} size={32} />
                    <Text style={{ color: btn.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase", marginTop: 8 }}>
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* ═════ HALF CONTROLS (like cricket Start 2nd Innings) ═════ */}
      {!displayOnly && isOwner && !gameOver && onMatchStateChange && isLive ? (() => {
        const period = Number(currentHalf) || 1;
        const atHalfTime = matchStatus === "half_time";
        const inFirstHalf = !atHalfTime && period <= 1 && matchStatus !== "second_half" && matchStatus !== "extra_time" && matchStatus !== "penalties";
        const inSecondHalf = !atHalfTime && (period === 2 || matchStatus === "second_half");
        const nearHalf = liveMinute >= 45;
        const nearFull = liveMinute >= 90;

        if (atHalfTime) {
          return (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Start 2nd Half",
                  "Resume the match for the second half?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Start",
                      onPress: () => handleMatchStatePress({
                        matchStatus: "second_half",
                        currentPeriod: 2,
                      }),
                    },
                  ],
                );
              }}
              disabled={isUpdating || disabled}
              style={{
                backgroundColor: accentSoftBg(UI, true),
                borderWidth: 2,
                borderColor: accentSoftBorder(UI, true),
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 12,
                minHeight: 64,
                opacity: isUpdating || disabled ? 0.75 : 1,
              }}
            >
              <Text style={{ color: UI.accent, fontWeight: "900", fontSize: 14, letterSpacing: 1 }}>
                Start 2nd Half
              </Text>
              <Text style={{ color: UI.muted, fontSize: 10, marginTop: 4 }}>
                Half-time over — kick off the second half
              </Text>
            </TouchableOpacity>
          );
        }

        if (inFirstHalf) {
          return (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "End 1st Half",
                  nearHalf
                    ? "Whistle for half-time and pause the clock?"
                    : `Only ${liveMinute}' played. End the first half early?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: nearHalf ? "Half-time" : "End early",
                      style: nearHalf ? "default" : "destructive",
                      onPress: () => handleMatchStatePress({
                        matchStatus: "half_time",
                        currentPeriod: 1,
                      }),
                    },
                  ],
                );
              }}
              disabled={isUpdating || disabled}
              style={{
                backgroundColor: accentSoftBg(UI, nearHalf),
                borderWidth: 2,
                borderColor: accentSoftBorder(UI, nearHalf),
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 12,
                minHeight: 64,
                opacity: isUpdating || disabled ? 0.75 : 1,
              }}
            >
              <Text style={{ color: UI.accent, fontWeight: "900", fontSize: 14, letterSpacing: 1 }}>
                {nearHalf ? "End 1st Half" : "End 1st Half Early"}
              </Text>
              <Text style={{ color: UI.muted, fontSize: 10, marginTop: 4 }}>
                {nearHalf ? "Go to half-time — then start 2nd half" : "Manual half-time — then start 2nd half"}
              </Text>
            </TouchableOpacity>
          );
        }

        if (inSecondHalf) {
          return (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "End 2nd Half",
                  nearFull
                    ? "Whistle full time?"
                    : `Only ${liveMinute}' played. End the match early?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Full time",
                      style: nearFull ? "default" : "destructive",
                      onPress: () => handleMatchStatePress({
                        matchStatus: "finished",
                        currentPeriod: 2,
                      }),
                    },
                  ],
                );
              }}
              disabled={isUpdating || disabled}
              style={{
                backgroundColor: nearFull ? "rgba(248,113,113,0.16)" : "rgba(248,113,113,0.08)",
                borderWidth: 2,
                borderColor: nearFull ? "rgba(248,113,113,0.5)" : "rgba(248,113,113,0.25)",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 12,
                minHeight: 64,
                opacity: isUpdating || disabled ? 0.75 : 1,
              }}
            >
              <Text style={{ color: "#f87171", fontWeight: "900", fontSize: 14, letterSpacing: 1 }}>
                {nearFull ? "Full Time" : "End Match Early"}
              </Text>
              <Text style={{ color: UI.muted, fontSize: 10, marginTop: 4 }}>
                Finish the match
              </Text>
            </TouchableOpacity>
          );
        }

        return null;
      })() : null}

      {allTimelineEvents.length > 0 && (
        <View style={{ backgroundColor: UI.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: UI.border, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase", color: UI.muted }}>
                Play-by-play
              </Text>
              {/* <Text style={{ color: UI.muted, fontSize: 10, marginTop: 3 }}>Latest first</Text> */}
            </View>
            <TouchableOpacity
              onPress={() => setShowTimelineModal(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: UI.cardElevated }}
            >
              <Text style={{ color: UI.text, fontSize: 10, fontWeight: "800" }}>View all ({allTimelineEvents.length})</Text>
              <Ionicons name="chevron-forward" size={12} color={UI.muted} />
            </TouchableOpacity>
          </View>
          {timelinePreview.map((e, i) => renderTimelineRow(e, i))}
          {allTimelineEvents.length > timelinePreview.length ? (
            <TouchableOpacity
              onPress={() => setShowTimelineModal(true)}
              style={{ marginTop: 4, paddingVertical: 10, alignItems: "center", borderRadius: 10, backgroundColor: UI.cardElevated }}
            >
              <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "700" }}>
                +{allTimelineEvents.length - timelinePreview.length} more events
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <Modal visible={showTimelineModal} transparent animationType="slide" onRequestClose={() => setShowTimelineModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: UI.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: UI.border,
            height: "85%",
            maxHeight: "85%",
            paddingTop: 12,
            paddingBottom: 24,
          }}>
            <View style={{ alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12, flexShrink: 0 }}>
              <View>
                <Text style={{ color: UI.text, fontWeight: "900", fontSize: 18 }}>Play-by-play</Text>
                <Text style={{ color: UI.muted, fontSize: 11, marginTop: 2 }}>
                  {filteredTimelineEvents.length} events · newest first
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTimelineModal(false)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.cardElevated, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={20} color={UI.muted} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: 16,
                paddingBottom: 12,
                gap: 8,
                flexShrink: 0,
              }}
            >
              {PLAY_BY_PLAY_FILTERS.map((filter) => {
                const selected = timelineFilter === filter.id;
                const count = filter.id === "all"
                  ? allTimelineEvents.length
                  : allTimelineEvents.filter((event) => matchesPlayByPlayFilter(event, filter.id)).length;
                return (
                  <TouchableOpacity
                    key={filter.id}
                    onPress={() => {
                      setTimelineFilter(filter.id);
                      setTimelinePageSize(TIMELINE_PAGE_SIZE);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      minHeight: 40,
                      justifyContent: "center",
                      borderRadius: 999,
                      backgroundColor: selected
                        ? UI.activeTint || "rgba(71,254,183,0.16)"
                        : UI.cardElevated,
                      borderWidth: 1,
                      borderColor: selected ? (UI.isDark ? "rgba(71,254,183,0.35)" : "rgba(17,24,39,0.28)") : UI.border,
                    }}
                  >
                    <Text style={{ color: selected ? UI.home : UI.muted, fontSize: 12, fontWeight: "800", lineHeight: 16 }}>
                      {filter.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FlatList
              data={visibleTimelineEvents}
              keyExtractor={(item, index) => `${item.eventType}-${item.playerId}-${item.minute}-${index}`}
              style={{ flex: 1, paddingHorizontal: 16 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS === "android"}
              windowSize={7}
              ListEmptyComponent={(
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Ionicons name="football-outline" size={32} color={UI.muted} />
                  <Text style={{ color: UI.muted, fontSize: 12, marginTop: 8 }}>No events in this filter</Text>
                </View>
              )}
              ListFooterComponent={filteredTimelineEvents.length > timelinePageSize ? (
                <TouchableOpacity
                  onPress={() => setTimelinePageSize((size) => size + TIMELINE_PAGE_SIZE)}
                  style={{ alignItems: "center", paddingVertical: 14, marginTop: 4, borderRadius: 12, backgroundColor: UI.cardElevated }}
                >
                  <Text style={{ color: UI.home, fontWeight: "800", fontSize: 12 }}>
                    Load more ({filteredTimelineEvents.length - timelinePageSize} remaining)
                  </Text>
                </TouchableOpacity>
              ) : null}
              renderItem={({ item, index }) => renderTimelineRow(item, index)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showLineupModal} transparent animationType="slide" onRequestClose={() => setShowLineupModal(false)}>
        {showLineupModal && lineupSide ? (
          <FootballStartingLineupModal
            key={`${lineupSide}-${lineupModalKey}`}
            side={lineupSide}
            teamName={lineupSide === "home" ? teamNames?.home : teamNames?.away}
            rosterPlayers={getTeamPlayers(lineupSide)}
            initialStarterIds={(lineupsBySide[lineupSide]?.onField || []).map((player) => getPlayerId(player))}
            initialFormation={
              lineupSide === "home"
                ? sportData?.homeFormation || "4-3-3"
                : sportData?.awayFormation || "4-3-3"
            }
            onClose={() => setShowLineupModal(false)}
            onSubmit={async (starters, bench, formation) => {
              if (!onSetupLineup || !lineupSide) return;
              const savedSide = lineupSide;
              const result = await onSetupLineup({ side: savedSide, starters, bench, formation });
              if (!result?.ok) return;
              if (result.nextSide) {
                setLineupSide(result.nextSide);
                setLineupModalKey((key) => key + 1);
                return;
              }
              setShowLineupModal(false);
            }}
          />
        ) : null}
      </Modal>

      {/* ══════ SUBSTITUTION MODAL ══════ */}
      <Modal visible={showSubModal} transparent animationType="slide" onRequestClose={() => setShowSubModal(false)}>
        <FootballSubstitutionModal
          visible={showSubModal}
          lineupsBySide={lineupsBySide}
          teamNames={teamNamesBySide}
          initialSide={userSide}
          availableSides={availableSubstitutionSides}
          getPlayerId={getPlayerId}
          getPlayerName={getPlayerName}
          squadPlayers={availableSubstitutionSides.flatMap((side) => getTeamPlayers(side))}
          onClose={() => setShowSubModal(false)}
          onSubmit={(teamSide, playerOutId, playerInId, lineupSnapshot) => {
            if (onSubstitution) {
              onSubstitution(teamSide, playerOutId, playerInId, lineupSnapshot);
            } else {
              // Fallback: record as event
              onEvent("substitution", teamSide, playerOutId, { playerInId });
            }
            setShowSubModal(false);
          }}
        />
      </Modal>
    </View>
  );
}

// ── Goal Details Step (Own Goal toggle + Assist picker) ──
function GoalDetailsStep({ teamPlayers, scorerPlayerId, getPlayerId, getPlayerName, onSubmit, onCancel }) {
  const UI = useGameScoringTheme();
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [assistPlayerId, setAssistPlayerId] = useState(null);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 9, color: UI.muted, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold" }}>
        Goal Details
      </Text>

      {/* Own Goal Toggle */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={() => setIsOwnGoal(false)}
          style={{ flex: 1, backgroundColor: !isOwnGoal ? "rgba(34,197,94,0.2)" : UI.cardElevated, borderWidth: 1, borderColor: !isOwnGoal ? "rgba(34,197,94,0.4)" : UI.border, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: !isOwnGoal ? "#16A34A" : UI.muted, fontWeight: "700", fontSize: 11 }}>⚽ Regular Goal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setIsOwnGoal(true); setAssistPlayerId(null); }}
          style={{ flex: 1, backgroundColor: isOwnGoal ? "rgba(239,68,68,0.2)" : UI.cardElevated, borderWidth: 1, borderColor: isOwnGoal ? "rgba(239,68,68,0.4)" : UI.border, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: isOwnGoal ? "#DC2626" : UI.muted, fontWeight: "700", fontSize: 11 }}>⚽ Own Goal</Text>
        </TouchableOpacity>
      </View>

      {/* Assist Picker (only for regular goals) */}
      {!isOwnGoal && (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 9, color: UI.muted, fontWeight: "700", textTransform: "uppercase" }}>Assist (optional)</Text>
            {assistPlayerId && (
              <TouchableOpacity onPress={() => setAssistPlayerId(null)}>
                <Text style={{ fontSize: 9, color: "#60a5fa", fontWeight: "600" }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {teamPlayers
                .filter((p) => getPlayerId(p) !== scorerPlayerId)
                .map((p) => {
                  const pid = getPlayerId(p);
                  const selected = assistPlayerId === pid;
                  return (
                    <TouchableOpacity
                      key={pid}
                      onPress={() => setAssistPlayerId(selected ? null : pid)}
                      style={{ backgroundColor: selected ? "rgba(96,165,250,0.2)" : UI.cardElevated, borderWidth: 1, borderColor: selected ? "rgba(96,165,250,0.4)" : UI.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 }}
                    >
                      <Text style={{ color: selected ? "#2563EB" : UI.text, fontSize: 10, fontWeight: "600" }}>
                        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}{getPlayerName(p)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Submit */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity onPress={onCancel} style={{ flex: 1, backgroundColor: UI.cardElevated, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: UI.muted, fontWeight: "700", fontSize: 12 }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onSubmit(isOwnGoal, assistPlayerId)}
          style={{ flex: 2, backgroundColor: isOwnGoal ? "#dc2626" : "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
            {isOwnGoal ? "Record Own Goal" : assistPlayerId ? "Record Goal + Assist" : "Record Goal"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Football Substitution Modal (Player Out → Player In) ──
function FootballSubstitutionModal({
  visible,
  lineupsBySide,
  teamNames,
  initialSide,
  availableSides,
  getPlayerId,
  getPlayerName,
  squadPlayers = [],
  onClose,
  onSubmit,
}) {
  const UI = useGameScoringTheme();
  const safeInitialSide = availableSides?.includes(initialSide) ? initialSide : availableSides?.[0] || "home";
  const [activeSide, setActiveSide] = useState(safeInitialSide);
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setActiveSide(safeInitialSide);
    setPlayerOut(null);
    setPlayerIn(null);
  }, [visible, safeInitialSide]);

  const currentPlayers = lineupsBySide?.[activeSide]?.onField || [];
  const benchPlayers = lineupsBySide?.[activeSide]?.bench || [];
  const subbedOffPlayers = lineupsBySide?.[activeSide]?.subbedOff || [];
  const teamName = teamNames?.[activeSide] || "Team";

  const canSubmit = playerOut && playerIn && playerOut !== playerIn;
  const showSwapPreview = !!(playerOut && playerIn && playerOut !== playerIn);

  const findPlayerById = (playerId) => {
    if (!playerId) return null;
    const pools = [currentPlayers, benchPlayers, subbedOffPlayers, squadPlayers];
    for (const pool of pools) {
      const match = pool.find((player) => getPlayerId(player) === String(playerId));
      if (match) return match;
    }
    return null;
  };

  const outPlayer = findPlayerById(playerOut);
  const inPlayer = findPlayerById(playerIn);

  const formatPlayerLabel = (player) => {
    if (!player) return "";
    return `${player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}${getPlayerName(player)}`;
  };

  const handleConfirm = () => {
    if (!canSubmit) return;
    onSubmit(activeSide, playerOut, playerIn, {
      currentLineup: currentPlayers,
      benchLineup: benchPlayers,
    });
    onClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: UI.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%", borderWidth: 1, borderColor: UI.border }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "800", color: UI.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>Substitution</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: UI.text, marginTop: 2 }}>{teamName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.cardElevated, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color={UI.muted} />
          </TouchableOpacity>
        </View>

        {availableSides?.length > 1 && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {availableSides.map((side) => {
              const selected = side === activeSide;
              return (
                <TouchableOpacity
                  key={side}
                  onPress={() => {
                    setActiveSide(side);
                    setPlayerOut(null);
                    setPlayerIn(null);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: selected ? "rgba(99,102,241,0.18)" : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected ? "#6366F1" : UI.border,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: selected ? "#6366F1" : UI.text }}>
                    {teamNames?.[side] || side}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {showSwapPreview && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            padding: 12,
            borderRadius: 14,
            backgroundColor: "rgba(99,102,241,0.12)",
            borderWidth: 1,
            borderColor: "rgba(129,140,248,0.35)",
          }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#f87171", letterSpacing: 1, marginBottom: 4 }}>OFF</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: UI.text, textAlign: "center" }} numberOfLines={2}>
                {formatPlayerLabel(outPlayer)}
              </Text>
            </View>
            <Ionicons name="swap-horizontal" size={22} color="#a5b4fc" />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#4ade80", letterSpacing: 1, marginBottom: 4 }}>ON</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: UI.text, textAlign: "center" }} numberOfLines={2}>
                {formatPlayerLabel(inPlayer)}
              </Text>
            </View>
          </View>
        )}

        {/* Player Out */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#f87171", textTransform: "uppercase", marginBottom: 6 }}>
          Player Coming Off
        </Text>
        <ScrollView style={{ maxHeight: 130, marginBottom: 12 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {currentPlayers.map((player) => {
              const pid = getPlayerId(player);
              const selected = playerOut === pid;
              return (
                <TouchableOpacity
                  key={pid}
                  onPress={() => {
                    setPlayerOut(pid);
                    if (playerIn === pid) setPlayerIn(null);
                  }}
                  style={{
                    backgroundColor: selected ? "rgba(248,113,113,0.2)" : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected ? "#DC2626" : UI.border,
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? "#DC2626" : UI.text }}>
                    {formatPlayerLabel(player)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Player In + subbed off (shown below after they leave the pitch) */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#4ade80", textTransform: "uppercase", marginBottom: 6 }}>
          Player Coming On
        </Text>
        <ScrollView style={{ maxHeight: 180, marginBottom: 16 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {benchPlayers
              .filter((player) => getPlayerId(player) !== playerOut)
              .map((player) => {
                const pid = getPlayerId(player);
                const selected = playerIn === pid;
                return (
                  <TouchableOpacity
                    key={pid}
                    onPress={() => {
                      setPlayerIn(pid);
                      if (playerOut === pid) setPlayerOut(null);
                    }}
                    style={{
                      backgroundColor: selected ? "rgba(74,222,128,0.18)" : UI.cardElevated,
                      borderWidth: 1,
                      borderColor: selected ? "#16A34A" : UI.border,
                      borderRadius: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? "#16A34A" : UI.text }}>
                      {formatPlayerLabel(player)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            {subbedOffPlayers.map((player) => {
              const pid = getPlayerId(player);
              const offMinute = player.substitutionMinute;
              return (
                <View
                  key={`off-${pid}`}
                  style={{
                    backgroundColor: "rgba(248,113,113,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(248,113,113,0.28)",
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#f87171" }}>
                    {formatPlayerLabel(player)}
                  </Text>
                  <Text style={{ fontSize: 9, color: UI.muted, marginTop: 2 }}>
                    {offMinute != null ? `Subbed off ${offMinute}'` : "Subbed off"}
                  </Text>
                </View>
              );
            })}
            {benchPlayers.length === 0 && subbedOffPlayers.length === 0 ? (
              <Text style={{ color: UI.muted, fontSize: 11 }}>No bench players available.</Text>
            ) : null}
          </View>
        </ScrollView>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={!canSubmit}
          style={{ backgroundColor: canSubmit ? UI.accent : accentSoftBg(UI, true), borderRadius: 14, paddingVertical: 16, alignItems: "center" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "900", color: canSubmit ? UI.onAccent : UI.muted, letterSpacing: 0.5 }}>Confirm Substitution</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FootballStartingLineupModal({
  side,
  teamName,
  rosterPlayers,
  initialStarterIds = [],
  initialFormation = "4-3-3",
  onClose,
  onSubmit,
}) {
  const UI = useGameScoringTheme();
  const [selectedIds, setSelectedIds] = useState(() =>
    initialStarterIds.map((id) => String(id)),
  );
  const [formation, setFormation] = useState(initialFormation || "4-3-3");
  const [saving, setSaving] = useState(false);

  const getPid = (player) => String(player._id || player.id || player.playerId);

  const togglePlayer = (player) => {
    const playerId = getPid(player);
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= 11) return current;
      return [...current, playerId];
    });
  };

  const selectedSet = new Set(selectedIds);
  const benchPlayers = rosterPlayers.filter((player) => !selectedSet.has(getPid(player)));
  const selectedStarters = rosterPlayers.filter((player) => selectedSet.has(getPid(player)));
  const placementPreview = useMemo(
    () => assignPlayersToFormation(selectedStarters, formation),
    [selectedStarters, formation],
  );

  const formatName = (player) => {
    const name = [player.firstName, player.lastName].filter(Boolean).join(" ");
    const jersey = player.jerseyNumber ? `#${player.jerseyNumber} ` : player.number ? `#${player.number} ` : "";
    return `${jersey}${name || "Player"}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
      <View style={{
        backgroundColor: UI.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "92%",
        borderWidth: 1,
        borderColor: UI.border,
      }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: UI.border }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: UI.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Starting XI
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: UI.text, marginTop: 2 }}>{teamName}</Text>
            <Text style={{ fontSize: 11, color: UI.muted, marginTop: 4 }}>
              Pick 11 · auto-placed into {formation}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.cardElevated, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color={UI.muted} />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 10, fontWeight: "700", color: UI.muted, textTransform: "uppercase", marginBottom: 6 }}>
          Formation
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6 }}>
          {FORMATION_OPTIONS.map((opt) => {
            const active = formation === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setFormation(opt)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? UI.activeTint : UI.cardElevated,
                  borderWidth: 1,
                  borderColor: active ? UI.accent : UI.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: active ? UI.accent : UI.muted }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Live pitch preview of formation placement */}
        <View style={{
          height: 168,
          borderRadius: 12,
          backgroundColor: "#1a3d2e",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          marginBottom: 12,
          overflow: "hidden",
          position: "relative",
        }}>
          <View style={{ position: "absolute", top: "50%", left: 8, right: 8, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} />
          {placementPreview.placements.map(({ slot, player }) => {
            const jersey = player.jerseyNumber ?? player.number;
            const label = jersey != null ? String(jersey) : slot.code;
            return (
              <View
                key={`${slot.key}-${formationPlayerId(player)}`}
                style={{
                  position: "absolute",
                  left: `${slot.x}%`,
                  top: `${(100 - slot.y) * 0.82 + 6}%`,
                  marginLeft: -14,
                  marginTop: -14,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#0B1324",
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{label}</Text>
              </View>
            );
          })}
          {selectedStarters.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700" }}>
                Select players to preview pitch positions
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: selectedIds.length === 11 ? "#4ade80" : "#fbbf24" }}>
            {selectedIds.length}/11 on pitch
          </Text>
          <TouchableOpacity onPress={() => setSelectedIds([])}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#60a5fa" }}>Clear</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 10, fontWeight: "700", color: "#4ade80", textTransform: "uppercase", marginBottom: 6 }}>
          On the pitch ({selectedStarters.length})
        </Text>
        <ScrollView style={{ maxHeight: 100, marginBottom: 10 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {placementPreview.placements.map(({ slot, player }) => {
              const playerId = getPid(player);
              return (
                <TouchableOpacity
                  key={`on-${playerId}`}
                  onPress={() => togglePlayer(player)}
                  style={{
                    backgroundColor: "rgba(74,222,128,0.22)",
                    borderWidth: 1,
                    borderColor: "#4ade80",
                    borderRadius: 8,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#4ade80" }}>
                    {slot.code} · {formatName(player)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {selectedStarters.length === 0 ? (
              <Text style={{ color: UI.muted, fontSize: 11 }}>Tap players below to add them</Text>
            ) : null}
          </View>
        </ScrollView>

        <Text style={{ fontSize: 10, fontWeight: "700", color: UI.muted, textTransform: "uppercase", marginBottom: 6 }}>
          Squad — tap to add/remove ({benchPlayers.length} on bench)
        </Text>
        <ScrollView style={{ maxHeight: 180, marginBottom: 14 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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
                    backgroundColor: selected ? "rgba(74,222,128,0.14)" : UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selected ? "#16A34A" : UI.border,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    opacity: !selected && selectedIds.length >= 11 ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: selected ? "#4ade80" : UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                    {formatName(player)}
                  </Text>
                  <Text style={{ color: UI.muted, fontSize: 10, marginTop: 3 }} numberOfLines={1}>
                    {player.position || (selected ? "Starting" : "Tap to select")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={async () => {
            if (selectedIds.length !== 11 || saving) return;
            setSaving(true);
            try {
              await onSubmit(selectedStarters, benchPlayers, formation);
            } finally {
              setSaving(false);
            }
          }}
          disabled={selectedIds.length !== 11 || saving}
          style={{
            backgroundColor: selectedIds.length === 11 && !saving ? UI.accent : accentSoftBg(UI, true),
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "900", color: selectedIds.length === 11 ? UI.onAccent : UI.muted }}>
            {saving ? "Saving…" : "Save Starting XI"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default FootballScoringPanelMobile;
