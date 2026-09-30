import { useState, useEffect, useRef } from "react";
import {
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
const fmtTime = (m, s) => `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

const PERIOD_LABEL = { 1: "1ST", 2: "2ND", 3: "3RD", 4: "OT", 5: "SO" };
const getPeriodLabel = (currentPeriod, isOvertime, isShootout) =>
  isShootout ? "SO" : isOvertime ? "OT" : (PERIOD_LABEL[currentPeriod] || `${currentPeriod}TH`);

const GOAL_TYPES = [
  { key: "even_strength", label: "EV",   desc: "Even Strength",  bg: "rgba(71,254,183,0.15)",  border: "rgba(71,254,183,0.4)",  color: "#47feb7" },
  { key: "power_play",    label: "PP",   desc: "Power Play",     bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.4)",  color: "#fbbf24" },
  { key: "short_handed",  label: "SH",   desc: "Short-Handed",   bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.4)", color: "#a78bfa" },
  { key: "empty_net",     label: "EN",   desc: "Empty Net",      bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#f87171" },
];

const PENALTY_OPTIONS = [
  { label: "Minor",        duration: 2,  desc: "2 min",  color: "#fbbf24" },
  { label: "Dbl Minor",    duration: 4,  desc: "4 min",  color: "#fb923c" },
  { label: "Major",        duration: 5,  desc: "5 min",  color: "#f87171" },
  { label: "Misconduct",   duration: 10, desc: "10 min", color: "#ef4444" },
];

// Quick events that only need team selection (no player required)
const TEAM_ONLY_EVENTS = new Set(["icing", "offside", "power_play_start"]);
const PLAYER_SELECTION_REQUIRED_EVENTS = new Set(["goal", "penalty", "shot_on_goal", "missed_shot", "blocked_shot", "hit", "takeaway", "giveaway", "faceoff_won", "faceoff_lost"]);
const MAX_PENDING_EVENTS = 50;
const PERIOD_SECONDS = 20 * 60;
const FULL_STRENGTH_SKATERS = 5;
const MIN_STRENGTH_SKATERS = 3;

const ICE_HOCKEY_EVENT_VISUALS = {
  goal: {
    icon: "football-outline",
    dark: { color: "#47feb7", background: "rgba(71,254,183,0.07)", border: "rgba(71,254,183,0.25)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  penalty: {
    icon: "alert-circle-outline",
    dark: { color: "#f87171", background: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.2)" },
    light: { color: "#B91C1C", background: "#FEE2E2", border: "#FCA5A5" },
  },
  shot_on_goal: {
    icon: "radio-button-on-outline",
    dark: { color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.22)" },
    light: { color: "#1D4ED8", background: "#DBEAFE", border: "#93C5FD" },
  },
  missed_shot: {
    icon: "close-circle-outline",
    dark: { color: "#f87171", background: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.22)" },
    light: { color: "#B91C1C", background: "#FEE2E2", border: "#FCA5A5" },
  },
  blocked_shot: {
    icon: "shield-outline",
    dark: { color: "#2dd4bf", background: "rgba(45,212,191,0.08)", border: "rgba(45,212,191,0.22)" },
    light: { color: "#0F766E", background: "#CCFBF1", border: "#5EEAD4" },
  },
  hit: {
    icon: "flash-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
  takeaway: {
    icon: "arrow-forward-circle-outline",
    dark: { color: "#47feb7", background: "rgba(71,254,183,0.08)", border: "rgba(71,254,183,0.22)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  giveaway: {
    icon: "arrow-back-circle-outline",
    dark: { color: "#fb7185", background: "rgba(251,113,133,0.08)", border: "rgba(251,113,133,0.22)" },
    light: { color: "#BE123C", background: "#FFE4E6", border: "#FDA4AF" },
  },
  faceoff_won: {
    icon: "ellipse-outline",
    dark: { color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.22)" },
    light: { color: "#4338CA", background: "#E0E7FF", border: "#A5B4FC" },
  },
  faceoff_lost: {
    icon: "ellipse-outline",
    dark: { color: "#9CA3AF", background: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)" },
    light: { color: "#4B5563", background: "#F3F4F6", border: "#D1D5DB" },
  },
  icing: {
    icon: "snow-outline",
    dark: { color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.22)" },
    light: { color: "#1D4ED8", background: "#DBEAFE", border: "#93C5FD" },
  },
  offside: {
    icon: "flag-outline",
    dark: { color: "#fb923c", background: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.22)" },
    light: { color: "#C2410C", background: "#FFEDD5", border: "#FDBA74" },
  },
  line_change: {
    icon: "swap-horizontal-outline",
    dark: { color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.22)" },
    light: { color: "#1D4ED8", background: "#DBEAFE", border: "#93C5FD" },
  },
  goalie_pulled: {
    icon: "exit-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
  goalie_return: {
    icon: "enter-outline",
    dark: { color: "#47feb7", background: "rgba(71,254,183,0.08)", border: "rgba(71,254,183,0.22)" },
    light: { color: "#15803D", background: "#DCFCE7", border: "#86EFAC" },
  },
  period_break: {
    icon: "pause-circle-outline",
    dark: { color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
    light: { color: "#B45309", background: "#FEF3C7", border: "#FCD34D" },
  },
};

const getIceHockeyEventVisual = (eventType, isDark = true) => {
  const preset = ICE_HOCKEY_EVENT_VISUALS[eventType];
  if (preset) {
    return { icon: preset.icon, ...(isDark ? preset.dark : preset.light) };
  }
  return isDark
    ? { icon: "ellipse-outline", color: "#dfe1f9", background: "#171a2c", border: "rgba(255,255,255,0.05)" }
    : { icon: "ellipse-outline", color: "#111827", background: "#F3F4F6", border: "#E5E7EB" };
};

const isEligibleIceHockeyPlayer = (player) => {
  if (!player) return false;
  const role = String(player.role || "player").trim().toLowerCase();
  return role === "player";
};

const filterIceHockeyPlayers = (teamPlayers = []) =>
  (teamPlayers || []).filter(isEligibleIceHockeyPlayer);

const getPlayerShortName = (player) => {
  const first = String(player?.firstName || "").trim();
  const last = String(player?.lastName || "").trim();
  if (first && last) return `${first} ${last.charAt(0)}.`;
  return first || last || "Player";
};

const toPlayerId = (player) => player?._id || player?.id || null;

const uniquePlayerIds = (values = []) => Array.from(new Set((values || []).filter(Boolean).map((value) => String(value))));

const isLikelyGoalie = (player) => {
  const text = `${player?.position || ""} ${player?.role || ""}`.toLowerCase();
  return text.includes("goalie") || text.includes("goaltender") || text.includes("goalkeeper") || text.split(/\s+/).includes("g");
};

const buildOnIceSide = (teamPlayers = [], sideState = {}, strengthSkaters = FULL_STRENGTH_SKATERS) => {
  const rosterPlayers = filterIceHockeyPlayers(teamPlayers);
  const rosterPlayerIds = uniquePlayerIds(rosterPlayers.map(toPlayerId));
  const fallbackGoalieId = toPlayerId(rosterPlayers.find(isLikelyGoalie));
  const goalieId = uniquePlayerIds([sideState?.goalieId, fallbackGoalieId]).find((playerId) => rosterPlayerIds.includes(playerId)) || null;
  let skaterIds = uniquePlayerIds(sideState?.skaterIds || []).filter((playerId) => rosterPlayerIds.includes(playerId) && playerId !== goalieId);
  if (skaterIds.length === 0) {
    skaterIds = rosterPlayerIds.filter((playerId) => playerId !== goalieId).slice(0, Math.max(1, Number(strengthSkaters) || FULL_STRENGTH_SKATERS));
  }
  return {
    rosterPlayerIds,
    skaterIds,
    goalieId,
    goaliePulled: !!sideState?.goaliePulled,
    tooManyPlayers: !!sideState?.tooManyPlayers,
  };
};

const buildOnIceSnapshot = (sport = {}, teamPlayersBySide = {}) => ({
  home: buildOnIceSide(teamPlayersBySide.home || [], sport?.onIce?.home || {}, sport?.strength?.home?.skaters || FULL_STRENGTH_SKATERS),
  away: buildOnIceSide(teamPlayersBySide.away || [], sport?.onIce?.away || {}, sport?.strength?.away?.skaters || FULL_STRENGTH_SKATERS),
});

const buildRosterSnapshot = (teamPlayersBySide = {}) => ({
  homePlayerIds: uniquePlayerIds((teamPlayersBySide.home || []).map(toPlayerId)),
  awayPlayerIds: uniquePlayerIds((teamPlayersBySide.away || []).map(toPlayerId)),
  homeGoalieId: toPlayerId((teamPlayersBySide.home || []).find(isLikelyGoalie)),
  awayGoalieId: toPlayerId((teamPlayersBySide.away || []).find(isLikelyGoalie)),
});

const getBenchPlayers = (teamPlayers = [], onIceSide = {}) => {
  const onIceIds = new Set(uniquePlayerIds([...(onIceSide?.skaterIds || []), onIceSide?.goalieId]));
  return filterIceHockeyPlayers(teamPlayers).filter((player) => !onIceIds.has(String(toPlayerId(player))));
};

const parseClockSeconds = (time = {}) => {
  if (typeof time === "string") {
    const [minutes = "0", seconds = "0"] = time.split(":");
    const total = (Number.parseInt(minutes, 10) * 60) + Number.parseInt(seconds, 10);
    return Number.isFinite(total) ? Math.max(0, total) : PERIOD_SECONDS;
  }
  const minutes = Number(time?.minutes);
  const seconds = Number(time?.seconds);
  if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
    return Math.max(0, (minutes * 60) + seconds);
  }
  return PERIOD_SECONDS;
};

const getElapsedSeconds = (period = 1, time = {}) => {
  const normalizedPeriod = Math.max(1, Number(period) || 1);
  return ((normalizedPeriod - 1) * PERIOD_SECONDS) + (PERIOD_SECONDS - parseClockSeconds(time));
};

const formatPenaltyTime = (seconds) => {
  const remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
};

const getLivePenaltyRemaining = (penalty, sport = {}, gameTime = {}) => {
  const baseRemaining = Number(penalty?.remainingSeconds);
  if (!Number.isFinite(baseRemaining)) return 0;
  const lastElapsed = Number(penalty?.lastUpdatedElapsedSeconds ?? penalty?.startedElapsedSeconds);
  if (!Number.isFinite(lastElapsed)) return Math.max(0, baseRemaining);
  const elapsed = getElapsedSeconds(sport?.currentPeriod || penalty?.lastUpdatedPeriod || 1, gameTime);
  return Math.max(0, baseRemaining - Math.max(0, elapsed - lastElapsed));
};

const getActivePenaltyViews = (sport = {}, gameTime = {}) =>
  (sport?.activePenalties || [])
    .filter(penalty => penalty?.isActive)
    .map(penalty => ({
      ...penalty,
      remainingSeconds: getLivePenaltyRemaining(penalty, sport, gameTime),
    }))
    .filter(penalty => penalty.remainingSeconds > 0)
    .sort((a, b) => (b.startedElapsedSeconds ?? 0) - (a.startedElapsedSeconds ?? 0));

const getStrengthDisplay = (sport = {}, gameTime = {}) => {
  const activePenalties = getActivePenaltyViews(sport, gameTime);
  const homePenaltyCount = activePenalties.filter(penalty => penalty.teamSide === "home" && penalty.affectsStrength !== false).length;
  const awayPenaltyCount = activePenalties.filter(penalty => penalty.teamSide === "away" && penalty.affectsStrength !== false).length;
  const homeSkaters = Number(sport?.strength?.home?.skaters) || Math.max(MIN_STRENGTH_SKATERS, FULL_STRENGTH_SKATERS - homePenaltyCount);
  const awaySkaters = Number(sport?.strength?.away?.skaters) || Math.max(MIN_STRENGTH_SKATERS, FULL_STRENGTH_SKATERS - awayPenaltyCount);
  return { home: homeSkaters, away: awaySkaters, label: `${homeSkaters}v${awaySkaters}` };
};

const renderIceHockeyPenaltyStrip = ({ penalties = [], teamNames, resolvePlayerName }) => {
  if (penalties.length === 0) return null;
  const visiblePenalties = penalties;

  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {visiblePenalties.map((penalty, index) => {
          const penaltyPlayer = penalty.playerName || resolvePlayerName?.(penalty.playerId) || null;
          return (
            <View
              key={penalty.penaltyId || `${penalty.playerId}-${index}`}
              style={{
                minWidth: 124,
                backgroundColor: "rgba(239,68,68,0.08)",
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.22)",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <Text style={{ color: penalty.teamSide === "home" ? "#47feb7" : "#b8c3ff", fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }} numberOfLines={1}>
                {penalty.teamSide === "home" ? teamNames.home : teamNames.away}
              </Text>
              {!!penaltyPlayer && (
                <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "700" }} numberOfLines={1}>
                  {penaltyPlayer}
                </Text>
              )}
              <Text style={{ color: "#f87171", fontSize: 11, fontWeight: "900", fontFamily: "monospace" }}>
                {formatPenaltyTime(penalty.remainingSeconds)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const UNDO_IGNORED_ICE_HOCKEY_EVENTS = new Set(["undo", "possession_change", "period_break", "line_change"]);

const getIceHockeyManageableSides = (userSide, isSelfOwnedOpponent) => {
  if (isSelfOwnedOpponent) return ["home", "away"];
  return userSide === "home" || userSide === "away" ? [userSide] : [];
};

const getLatestIceHockeyUndoableEvent = (events = []) => {
  for (let index = (events || []).length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && !UNDO_IGNORED_ICE_HOCKEY_EVENTS.has(event.eventType)) {
      return event;
    }
  }
  return null;
};

const getIceHockeyEventTeamSide = (event, baseGame) => {
  if (event?.teamSide === "home" || event?.teamSide === "away") {
    return event.teamSide;
  }

  const normalizedTeamId = String(event?.teamId || "");
  if (!normalizedTeamId) return null;
  if (normalizedTeamId === String(baseGame?.teamId || "")) return "home";
  if (normalizedTeamId === String(baseGame?.opponentTeamId || "")) return "away";
  return null;
};

const getIceHockeyTeamName = (teamNames, side) => (side === "home" ? teamNames.home : teamNames.away);

export function IceHockeyScoreboardCard({
  sport = {},
  baseGame = null,
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  displayOnly = false,
  isUpdating,
  gameOver,
  isScheduled = false,
  isOwner = false,
  onPauseResume,
  onEndGame,
  onStartGame,
  onUndo,
  onEndPeriod,
  userSide = "home",
  isSelfOwnedOpponent = false,
}) {
  const UI = useGameScoringTheme();
  const periodActive = !gameTime?.isRunning;
  const periodBg = UI.isDark ? "rgba(251,191,36,0.15)" : "#F59E0B";
  const periodBorder = UI.isDark ? "rgba(251,191,36,0.4)" : "#D97706";
  const periodDeep = UI.isDark ? "#7a5a10" : "#B45309";
  const periodText = UI.isDark ? "#fbbf24" : "#FFFFFF";
  const periodDisabledBg = UI.isDark ? "#171a2c" : "#E5E7EB";
  const periodDisabledBorder = UI.isDark ? "rgba(255,255,255,0.06)" : "#D1D5DB";
  const periodDisabledText = UI.isDark ? "#6B7280" : "#9CA3AF";
  const darkChipDeep = UI.isDark ? "#0b0d18" : "#0f111c";

  const homeScore = sport?.score?.home ?? 0;
  const awayScore = sport?.score?.away ?? 0;
  const currentPeriod = sport?.currentPeriod ?? 1;
  const isOvertime = sport?.isOvertime ?? false;
  const isShootout = sport?.isShootout ?? false;
  const homePP = sport?.powerPlays?.home ?? { opportunities: 0, goals: 0 };
  const awayPP = sport?.powerPlays?.away ?? { opportunities: 0, goals: 0 };
  const homePIM = sport?.penaltyMinutes?.home ?? 0;
  const awayPIM = sport?.penaltyMinutes?.away ?? 0;
  const homeShots = sport?.shots?.home ?? 0;
  const awayShots = sport?.shots?.away ?? 0;

  // Penalty display ticks independently of the game clock.
  // On each server update the baseline resets; while server value is unchanged (pause) the
  // local wall-clock elapsed keeps the timer running.
  const cardPenaltyDisplayRef = useRef({});
  const [cardPenaltyTick, setCardPenaltyTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCardPenaltyTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activePenalties = getActivePenaltyViews(sport, gameTime);
  // cardPenaltyTick >= 0 is always true — references it so React re-evaluates every second
  const cardNow = cardPenaltyTick >= 0 ? Date.now() : Date.now();
  const activePenaltiesDisplay = activePenalties.map(p => {
    const durationSeconds = p.durationSeconds || (p.durationMinutes || 2) * 60;
    if (p.penaltyStartedAt) {
      const startMs = typeof p.penaltyStartedAt === 'number' ? p.penaltyStartedAt : new Date(p.penaltyStartedAt).getTime();
      if (Number.isFinite(startMs)) {
        return { ...p, remainingSeconds: Math.max(0, durationSeconds - Math.floor((cardNow - startMs) / 1000)) };
      }
    }
    const key = String(p.penaltyId || p.playerId || '');
    const stored = cardPenaltyDisplayRef.current[key];
    if (!stored || stored.syncedRemaining !== p.remainingSeconds) {
      cardPenaltyDisplayRef.current[key] = { syncedAt: cardNow, syncedRemaining: p.remainingSeconds };
      return p;
    }
    const localElapsed = Math.floor((cardNow - stored.syncedAt) / 1000);
    return { ...p, remainingSeconds: Math.max(0, stored.syncedRemaining - localElapsed) };
  }).filter(p => p.remainingSeconds > 0);

  const strength = getStrengthDisplay(sport, gameTime);
  const periodLabel = getPeriodLabel(currentPeriod, isOvertime, isShootout);
  const manageableSides = getIceHockeyManageableSides(userSide, isSelfOwnedOpponent);
  const latestUndoableEvent = getLatestIceHockeyUndoableEvent(sport?.events || []);
  const latestUndoableEventSide = getIceHockeyEventTeamSide(latestUndoableEvent, baseGame);
  const hasUndoableEvents = !!latestUndoableEvent && manageableSides.includes(latestUndoableEventSide);

  return (
    <View style={{ backgroundColor: "#1a1d2e", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(71,254,183,0.15)", overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", backgroundColor: "#47feb7" }} />
      <View style={{ position: "absolute", top: 0, right: 0, width: 3, height: "100%", backgroundColor: "#b8c3ff" }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#47feb7", maxWidth: "30%" }} numberOfLines={1}>
          {teamNames.home}
        </Text>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 4, color: "#9CA3AF", textTransform: "uppercase" }}>
            {periodLabel} PERIOD
          </Text>
        </View>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#b8c3ff", maxWidth: "30%", textAlign: "right" }} numberOfLines={1}>
          {teamNames.away}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 42, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 50, minWidth: 56, textAlign: "center" }}>
          {String(homeScore).padStart(2, "0")}
        </Text>

        <View style={{ alignItems: "center", gap: 6 }}>
          <View style={{ backgroundColor: "#0d101f", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", fontFamily: "monospace", letterSpacing: 4, color: "#47feb7" }}>
              {fmtTime(gameTime?.minutes ?? 20, gameTime?.seconds ?? 0)}
            </Text>
          </View>
          {isScheduled && isOwner && (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>▶ Start Game</Text>
            </TouchableOpacity>
          )}
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
          {isScheduled && !isOwner && (
            <Text style={{ color: "#6B7280", fontSize: 10 }}>⏳ Waiting for coach</Text>
          )}
        </View>

        <Text style={{ fontSize: 42, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 50, minWidth: 56, textAlign: "center" }}>
          {String(awayScore).padStart(2, "0")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
        {[
          { label: "SOG", home: homeShots, away: awayShots },
          { label: "PP", home: `${homePP.goals}/${homePP.opportunities}`, away: `${awayPP.goals}/${awayPP.opportunities}` },
          { label: "PIM", home: homePIM, away: awayPIM },
          { label: "STR", home: strength.home, away: strength.away },
        ].map(stat => (
          <View key={stat.label} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#dfe1f9" }}>
              <Text style={{ color: "#47feb7" }}>{stat.home}</Text>
              <Text style={{ color: "#6B7280" }}> – </Text>
              <Text style={{ color: "#b8c3ff" }}>{stat.away}</Text>
            </Text>
          </View>
        ))}
      </View>
      {renderIceHockeyPenaltyStrip({ penalties: activePenaltiesDisplay, teamNames })}
      {!displayOnly && !gameOver && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          <TouchableOpacity
            onPress={() => onUndo?.(latestUndoableEventSide || null)}
            disabled={!hasUndoableEvents}
            style={{
              flex: 1,
              backgroundColor: hasUndoableEvents ? "rgba(107,114,128,0.15)" : "rgba(255,255,255,0.05)",
              paddingVertical: 13,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: hasUndoableEvents ? "rgba(107,114,128,0.3)" : "rgba(255,255,255,0.08)",
              opacity: !hasUndoableEvents ? 0.45 : 1,
            }}
          >
            <Ionicons name="arrow-undo" size={16} color={hasUndoableEvents ? "#9CA3AF" : "#6B7280"} />
            <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: hasUndoableEvents ? "#9CA3AF" : "#6B7280" }}>
              Undo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onEndPeriod}
            disabled={gameTime?.isRunning}
            style={{
              flex: 2,
              paddingVertical: 13,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              backgroundColor: periodActive ? periodBg : periodDisabledBg,
              borderColor: periodActive ? periodBorder : periodDisabledBorder,
              opacity: gameTime?.isRunning ? 0.35 : 1,
              ...raised3d(periodActive ? periodDeep : darkChipDeep),
            }}
          >
            <Ionicons name="pause-circle-outline" size={16} color={periodActive ? periodText : periodDisabledText} />
            <Text style={{ fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: periodActive ? periodText : periodDisabledText }}>
              End {periodLabel} Period
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function IceHockeyScoringPanel({
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
  isScheduled = false,
  isOwner = false,
  hideScoreboard = false,
  userSide = "home",
  isSelfOwnedOpponent = false,
}) {
  const UI = useGameScoringTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const filteredPlayers = {
    home: filterIceHockeyPlayers(players.home || []),
    away: filterIceHockeyPlayers(players.away || []),
  };
  const allPlayers = [...filteredPlayers.home, ...filteredPlayers.away].filter(Boolean);
  const resolvePlayerName = (playerId) => {
    if (!playerId) return "";
    const player = allPlayers.find(pl => String(pl._id || pl.id) === String(playerId));
    return player ? `${player.firstName || ""} ${player.lastName || ""}`.trim() : "";
  };
  const sport = currentGame?.sport || {};
  const baseGame = currentGame?.base || null;
  const activePenalties = getActivePenaltyViews(sport, gameTime);
  const strength = getStrengthDisplay(sport, gameTime);
  const homeScore    = sport?.score?.home ?? 0;
  const awayScore    = sport?.score?.away ?? 0;
  const currentPeriod = sport?.currentPeriod ?? 1;
  const isOvertime   = sport?.isOvertime ?? false;
  const isShootout   = sport?.isShootout ?? false;

  const homePP  = sport?.powerPlays?.home ?? { opportunities: 0, goals: 0 };
  const awayPP  = sport?.powerPlays?.away ?? { opportunities: 0, goals: 0 };
  const homePIM = sport?.penaltyMinutes?.home ?? 0;
  const awayPIM = sport?.penaltyMinutes?.away ?? 0;
  const homeShots = sport?.shots?.home ?? 0;
  const awayShots = sport?.shots?.away ?? 0;
  const onIceSnapshot = buildOnIceSnapshot(sport, filteredPlayers);
  const rosterSnapshot = buildRosterSnapshot(filteredPlayers);
  const overlayMaxHeight = Math.max(360, Math.floor(viewportHeight * 0.72));
  const manageableSides = getIceHockeyManageableSides(userSide, isSelfOwnedOpponent);
  const lockedTeamSide = manageableSides.length === 1 ? manageableSides[0] : null;
  const latestUndoableEvent = getLatestIceHockeyUndoableEvent(sport?.events || []);
  const latestUndoableEventSide = getIceHockeyEventTeamSide(latestUndoableEvent, baseGame);
  const canUndoLatestEvent = !!latestUndoableEvent && manageableSides.includes(latestUndoableEventSide);
  const singleManagedTeamName = lockedTeamSide ? getIceHockeyTeamName(teamNames, lockedTeamSide) : null;

  // Prevent timer from auto-starting on Start Game
  // Only allow timer to start when coach explicitly presses Resume/Pause
  // If onStartGame triggers timer, block that logic here
  // (Assume onStartGame only sets up the game, not the timer)

  // ── overlay state machine ────────────────────────────────────────────────
  const [pendingEvent, setPendingEvent] = useState(null);   // eventType string
  const [step, setStep]         = useState("team");         // team | goal_type | player | penalty_type | assist
  const [selTeam, setSelTeam]   = useState(null);
  const [selGoalType, setSelGoalType] = useState("even_strength");
  const [selPlayer, setSelPlayer]     = useState(null);
  const [selAssist1, setSelAssist1]   = useState(null);
  const [selAssist2, setSelAssist2]   = useState(null);
  const [selOutgoingPlayer, setSelOutgoingPlayer] = useState(null);
  const [selIncomingPlayer, setSelIncomingPlayer] = useState(null);
  const [selGoaliePlayer, setSelGoaliePlayer] = useState(null);
  const [selPenaltyDuration, setSelPenaltyDuration] = useState(2);
  const [selPenaltyLabel, setSelPenaltyLabel] = useState("Minor");
  const [lineChangeSuccess, setLineChangeSuccess] = useState(null);
  const [eventQueue, setEventQueue] = useState([]);
  const eventQueueProcessingRef = useRef(false);
  const autoPeriodAdvanceRef = useRef(null);

  // Penalty display ticks independently of game clock
  const penaltyDisplayRef = useRef({});
  const [penaltyTick, setPenaltyTick] = useState(0);

  const disabled = gameOver;

  // ── swipe-to-undo gesture refs ───────────────────────────────────────────
  const gestureState = useRef({ disabled: false, displayOnly: false, canUndoLatestEvent: false, undoTeamSide: null });
  gestureState.current = {
    disabled,
    displayOnly,
    canUndoLatestEvent,
    undoTeamSide: latestUndoableEventSide || null,
  };

  // setEventQueue is stable across renders (React guarantee) — safe to close over directly
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 40,
      onPanResponderRelease: (_, gs) => {
        const { disabled: d, displayOnly: disp, canUndoLatestEvent: canUndo, undoTeamSide } = gestureState.current;
        if (gs.dx < -80 && !d && !disp && canUndo) {
          setEventQueue(prev =>
            prev.length >= MAX_PENDING_EVENTS ? prev : [...prev, { type: "undo", team: undoTeamSide || null, player: null, extra: {} }],
          );
        }
      },
    })
  ).current;

  // ── double-tap = instant EV goal ─────────────────────────────────────────
  const handleGoalTap = (side) => {
    if (disabled || displayOnly || !manageableSides.includes(side)) return;
    setPendingEvent("goal");
    setSelTeam(side);
    setStep("goal_type");
  };

  // ── sequential queue ─────────────────────────────────────────────────────
  useEffect(() => {
    if (eventQueueProcessingRef.current || eventQueue.length === 0 || displayOnly || gameOver) return;
    const { type, team, player, extra } = eventQueue[0];
    eventQueueProcessingRef.current = true;

    let eventResult;
    try {
      eventResult = onEvent(type, team, player, extra);
    } catch {
      eventResult = null;
    }

    Promise.resolve(eventResult)
      .finally(() => {
        eventQueueProcessingRef.current = false;
        setEventQueue(prev => prev.slice(1));
      });
  }, [eventQueue, displayOnly, gameOver, onEvent]);

  useEffect(() => {
    const isAtPeriodEnd = gameTime?.isRunning && gameTime?.minutes === 0 && gameTime?.seconds === 0;
    if (!displayOnly && !disabled && isAtPeriodEnd) {
      const periodKey = `${currentPeriod}-${isOvertime ? "ot" : "reg"}-${isShootout ? "so" : "live"}`;
      if (autoPeriodAdvanceRef.current !== periodKey) {
        autoPeriodAdvanceRef.current = periodKey;
        enqueue("period_break", "home");
      }
      return;
    }
    autoPeriodAdvanceRef.current = null;
  }, [displayOnly, disabled, gameTime?.isRunning, gameTime?.minutes, gameTime?.seconds, currentPeriod, isOvertime, isShootout]);

  // Penalty display: always-on 1-second tick; syncs from server on new values,
  // counts locally when server value is unchanged (i.e. game clock paused).
  useEffect(() => {
    const id = setInterval(() => setPenaltyTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // penaltyTick >= 0 is always true — references it so React re-evaluates every second
  const penaltyNow = penaltyTick >= 0 ? Date.now() : Date.now();
  const activePenaltiesDisplay = activePenalties.map(p => {
    const durationSeconds = p.durationSeconds || (p.durationMinutes || 2) * 60;
    if (p.penaltyStartedAt) {
      const startMs = typeof p.penaltyStartedAt === 'number' ? p.penaltyStartedAt : new Date(p.penaltyStartedAt).getTime();
      if (Number.isFinite(startMs)) {
        return { ...p, remainingSeconds: Math.max(0, durationSeconds - Math.floor((penaltyNow - startMs) / 1000)) };
      }
    }
    const key = String(p.penaltyId || p.playerId || '');
    const stored = penaltyDisplayRef.current[key];
    if (!stored || stored.syncedRemaining !== p.remainingSeconds) {
      penaltyDisplayRef.current[key] = { syncedAt: penaltyNow, syncedRemaining: p.remainingSeconds };
      return p;
    }
    const localElapsed = Math.floor((penaltyNow - stored.syncedAt) / 1000);
    return { ...p, remainingSeconds: Math.max(0, stored.syncedRemaining - localElapsed) };
  }).filter(p => p.remainingSeconds > 0);

  const enqueue = (type, team, player = null, extra = {}) =>
    setEventQueue(prev =>
      prev.length >= MAX_PENDING_EVENTS ? prev : [...prev, { type, team, player, extra }],
    );

  // ── reset overlay ────────────────────────────────────────────────────────
  const closeOverlay = () => {
    setPendingEvent(null);
    setStep("team");
    setSelTeam(null);
    setSelPlayer(null);
    setSelAssist1(null);
    setSelAssist2(null);
    setSelOutgoingPlayer(null);
    setSelIncomingPlayer(null);
    setSelGoaliePlayer(null);
    setSelGoalType("even_strength");
    setSelPenaltyDuration(2);
    setSelPenaltyLabel("Minor");
    setLineChangeSuccess(null);
  };

  // ── start an event ───────────────────────────────────────────────────────
  const startEvent = (type) => {
    if (disabled || displayOnly) return;
    if (type === "undo") {
      if (canUndoLatestEvent) {
        enqueue("undo", latestUndoableEventSide || null);
      }
      return;
    }
    if (type === "period_break") { enqueue("period_break", lockedTeamSide || "home"); return; }
    setPendingEvent(type);
    if (lockedTeamSide) {
      setSelTeam(lockedTeamSide);
      if (type === "line_change") {
        setSelGoaliePlayer(onIceSnapshot?.[lockedTeamSide]?.goalieId || null);
        setStep("line_change");
      } else if (type === "goalie_return") {
        setStep("goalie_return");
      } else if (type === "goal") {
        setStep("goal_type");
      } else {
        setStep("player");
      }
      return;
    }
    setSelTeam(null);
    setStep("team");
  };

  const openPlayerEventForTeam = (type, team) => {
    if (disabled || displayOnly || !manageableSides.includes(team)) return;
    setPendingEvent(type);
    setSelTeam(team);
    setStep(type === "goal" ? "goal_type" : "player");
  };

  const withUpdatedOnIceSnapshot = (team, updater) => {
    const currentSide = onIceSnapshot?.[team] || { rosterPlayerIds: [], skaterIds: [], goalieId: null, goaliePulled: false };
    const nextSide = updater({
      ...currentSide,
      rosterPlayerIds: [...(currentSide.rosterPlayerIds || [])],
      skaterIds: [...(currentSide.skaterIds || [])],
    });
    return {
      ...onIceSnapshot,
      [team]: {
        ...nextSide,
        skaterIds: uniquePlayerIds(nextSide.skaterIds || []).filter((playerId) => playerId !== nextSide.goalieId),
      },
    };
  };

  const openLineChange = (team) => {
    if (disabled || displayOnly || !manageableSides.includes(team)) return;
    setSelGoaliePlayer(onIceSnapshot?.[team]?.goalieId || null);
    setPendingEvent("line_change");
    setSelTeam(team);
    setStep("line_change");
  };

  const handleGoalieToggle = (team) => {
    if (disabled || displayOnly || !manageableSides.includes(team)) return;
    const currentSide = onIceSnapshot?.[team];
    if (!currentSide?.goalieId) {
      openLineChange(team);
      return;
    }

    if (!currentSide.goaliePulled) {
      const nextOnIceSnapshot = withUpdatedOnIceSnapshot(team, (sideState) => ({
        ...sideState,
        goaliePulled: true,
      }));
      enqueue("goalie_pulled", team, currentSide.goalieId, {
        goalieId: currentSide.goalieId,
        onIceSnapshot: nextOnIceSnapshot,
        rosterSnapshot,
      });
      return;
    }

    setPendingEvent("goalie_return");
    setSelTeam(team);
    setStep("goalie_return");
  };

  // ── quick two-team buttons (icing, offside, shot, hit, etc.) ────────────
  const quickDispatch = (type, team) => {
    if (disabled || displayOnly || !manageableSides.includes(team)) return;
    enqueue(type, team);
  };

  // ── team selected ────────────────────────────────────────────────────────
  const onTeamSelect = (team) => {
    if (!manageableSides.includes(team)) return;
    setSelTeam(team);
    if (TEAM_ONLY_EVENTS.has(pendingEvent)) {
      enqueue(pendingEvent, team);
      closeOverlay();
    } else if (pendingEvent === "goal") {
      setStep("goal_type");
    } else if (pendingEvent === "line_change" || pendingEvent === "goalie_return") {
      if (pendingEvent === "line_change") {
        setSelGoaliePlayer(onIceSnapshot?.[team]?.goalieId || null);
      }
      setStep(pendingEvent);
    } else if (pendingEvent === "penalty") {
      setStep("player");
    } else {
      // shot_on_goal, missed_shot, blocked_shot, faceoff_won/lost, hit, takeaway, giveaway
      setStep("player");
    }
  };

  // ── goal type selected → go to player ───────────────────────────────────
  const onGoalTypeSelect = (key) => {
    setSelGoalType(key);
    setStep("player");
  };

  // ── final confirm ────────────────────────────────────────────────────────
  const onConfirm = () => {
    const baseExtra = { rosterSnapshot, onIceSnapshot };
    if (pendingEvent === "goal") {
      const extra = { ...baseExtra, goalType: selGoalType };
      if (selAssist1) extra.assistPlayerId1 = selAssist1;
      if (selAssist2) extra.assistPlayerId2 = selAssist2;
      enqueue("goal", selTeam, selPlayer, extra);
    } else if (pendingEvent === "penalty") {
      enqueue("penalty", selTeam, selPlayer, {
        ...baseExtra,
        penaltyType: selPenaltyLabel,
        penaltyDuration: selPenaltyDuration,
      });
    } else if (pendingEvent === "line_change") {
      const nextOnIceSnapshot = withUpdatedOnIceSnapshot(selTeam, (sideState) => {
        const nextGoalieId = selGoaliePlayer || sideState.goalieId || null;
        let nextSkaters = [...(sideState.skaterIds || [])];
        if (selOutgoingPlayer) {
          nextSkaters = nextSkaters.filter((playerId) => String(playerId) !== String(selOutgoingPlayer));
        }
        if (selIncomingPlayer) {
          nextSkaters.push(selIncomingPlayer);
        }
        return {
          ...sideState,
          goalieId: nextGoalieId,
          skaterIds: nextSkaters,
        };
      });
      enqueue("line_change", selTeam, null, {
        rosterSnapshot,
        onIceSnapshot: nextOnIceSnapshot,
        goalieId: selGoaliePlayer || null,
        outPlayerId: selOutgoingPlayer || null,
        inPlayerId: selIncomingPlayer || null,
      });
      // Build success confirmation data — shown instead of closing immediately
      const newOnIcePlayers = (filteredPlayers?.[selTeam] || []).filter(p => {
        const pid = String(toPlayerId(p));
        return (nextOnIceSnapshot?.[selTeam]?.skaterIds || []).includes(pid);
      });
      setLineChangeSuccess({
        outPlayerId: selOutgoingPlayer,
        outPlayerName: selOutgoingPlayer ? resolvePlayerName(selOutgoingPlayer) : null,
        inPlayerId: selIncomingPlayer,
        inPlayerName: selIncomingPlayer ? resolvePlayerName(selIncomingPlayer) : null,
        goalieChanged: String(selGoaliePlayer || "") !== String(onIceSnapshot?.[selTeam]?.goalieId || ""),
        newOnIcePlayers,
      });
      return; // Do NOT close modal — user must explicitly dismiss
    } else if (pendingEvent === "goalie_return") {
      const currentSide = onIceSnapshot?.[selTeam] || {};
      const nextOnIceSnapshot = withUpdatedOnIceSnapshot(selTeam, (sideState) => ({
        ...sideState,
        goaliePulled: false,
        skaterIds: (sideState.skaterIds || []).filter((playerId) => String(playerId) !== String(selOutgoingPlayer || "")),
      }));
      enqueue("goalie_return", selTeam, currentSide.goalieId || null, {
        rosterSnapshot,
        onIceSnapshot: nextOnIceSnapshot,
        goalieId: currentSide.goalieId || null,
        outPlayerId: selOutgoingPlayer || null,
      });
    } else {
      enqueue(pendingEvent, selTeam, selPlayer, baseExtra);
    }
    closeOverlay();
  };

  const teamAccent = (side) => (side === "home" ? "#47feb7" : "#b8c3ff");
  const teamColor = (side) => (UI.isDark ? teamAccent(side) : "#FFFFFF");
  const teamBg = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.12)" : "#22C55E")
    : (UI.isDark ? "rgba(184,195,255,0.12)" : "#6366F1"));
  const teamBorder = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.3)" : "#16A34A")
    : (UI.isDark ? "rgba(184,195,255,0.3)" : "#4F46E5"));
  const teamDeep = (side) => (side === "home"
    ? (UI.isDark ? "#0d5c45" : "#15803D")
    : (UI.isDark ? "#3b3f6b" : "#4338CA"));
  const teamLabelColor = (side) => (side === "home"
    ? (UI.isDark ? "rgba(71,254,183,0.7)" : "rgba(255,255,255,0.9)")
    : (UI.isDark ? "rgba(184,195,255,0.7)" : "rgba(255,255,255,0.9)"));
  const darkChipDeep = UI.isDark ? "#0b0d18" : "#0f111c";
  const chipBg = UI.isDark ? "#171a2c" : "#FFFFFF";
  const chipBorder = UI.isDark ? "rgba(255,255,255,0.06)" : "#D1D5DB";
  const chipLabel = UI.isDark ? "#9CA3AF" : "#4B5563";
  const penaltyBg = UI.isDark ? "rgba(239,68,68,0.14)" : "#EF4444";
  const penaltyBorder = UI.isDark ? "rgba(239,68,68,0.45)" : "#DC2626";
  const penaltyDeep = UI.isDark ? "#7f1d1d" : "#B91C1C";
  const penaltyText = UI.isDark ? "#f87171" : "#FFFFFF";
  const penaltyCaption = UI.isDark ? "rgba(248,113,113,0.55)" : "rgba(255,255,255,0.85)";
  const renderLineupGridSection = ({
    title,
    accentColor,
    helperText = null,
    players: sectionPlayers = [],
    selectedId = null,
    emptyText,
    actionLabel,
    onPress,
    penalizedPlayerIds = new Set(),
  }) => (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 2 }}>
          {title}
        </Text>
        {!!helperText && (
          <Text style={{ color: accentColor, fontSize: 10, fontWeight: "700" }}>
            {helperText}
          </Text>
        )}
      </View>
      {sectionPlayers.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
          {sectionPlayers.map((player) => {
            const playerId = toPlayerId(player);
            const isSelected = String(selectedId) === String(playerId);
            const isPenalized = penalizedPlayerIds.has(String(playerId));
            return (
              <TouchableOpacity
                key={`${title}-${playerId}`}
                onPress={() => onPress(playerId, isSelected)}
                style={{
                  width: "25%",
                  paddingHorizontal: 3,
                  marginBottom: 6,
                }}
              >
                <View style={{
                  minHeight: 64,
                  borderRadius: 10,
                  paddingHorizontal: 7,
                  paddingVertical: 7,
                  justifyContent: "space-between",
                  backgroundColor: isPenalized ? "rgba(239,68,68,0.08)" : isSelected ? `${accentColor}22` : "#171a2c",
                  borderWidth: 1,
                  borderColor: isPenalized ? "rgba(239,68,68,0.4)" : isSelected ? accentColor : "rgba(255,255,255,0.06)",
                }}>
                  {isPenalized && (
                    <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, zIndex: 1 }}>
                      <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 }}>PEN</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#dfe1f9", fontSize: 12, fontWeight: "800" }} numberOfLines={2}>
                      {getPlayerShortName(player)}
                    </Text>
                    {!!player?.position && (
                      <Text style={{ color: "#6B7280", fontSize: 9, marginTop: 4, textTransform: "uppercase" }} numberOfLines={1}>
                        {String(player.position)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#6B7280", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                      {isPenalized ? "BOX" : isSelected ? actionLabel.active : actionLabel.idle}
                    </Text>
                    {!!player?.jerseyNumber && (
                      <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#9CA3AF", fontSize: 10, fontWeight: "700" }}>
                        #{player.jerseyNumber}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={{ backgroundColor: "#171a2c", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
          <Text style={{ color: "#6B7280", fontSize: 11, textAlign: "center" }}>
            {emptyText}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPlayerGridSection = ({
    title,
    accentColor,
    players: sectionPlayers = [],
    selectedId = null,
    emptyText,
    onPress,
    penalizedPlayerIds = new Set(),
  }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </Text>
      {sectionPlayers.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
          {sectionPlayers.map((player) => {
            const playerId = player._id || player.id;
            const isSelected = String(selectedId) === String(playerId);
            const isPenalized = penalizedPlayerIds.has(String(playerId));
            return (
              <TouchableOpacity
                key={`${title}-${playerId}`}
                onPress={() => onPress(playerId, isSelected)}
                style={{ width: "25%", paddingHorizontal: 3, marginBottom: 6 }}
              >
                <View style={{
                  minHeight: 64,
                  borderRadius: 10,
                  paddingHorizontal: 7,
                  paddingVertical: 10,
                  justifyContent: "space-between",
                  backgroundColor: isPenalized ? "rgba(239,68,68,0.08)" : isSelected ? `${accentColor}22` : "#171a2c",
                  borderWidth: 1,
                  borderColor: isPenalized ? "rgba(239,68,68,0.4)" : isSelected ? accentColor : "rgba(255,255,255,0.06)",
                }}>
                  {isPenalized && (
                    <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, zIndex: 1 }}>
                      <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 }}>PEN</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#dfe1f9", fontSize: 12, fontWeight: "800" }} numberOfLines={2}>
                      {getPlayerShortName(player)}
                    </Text>
                    {!!player?.position && (
                      <Text style={{ color: "#6B7280", fontSize: 9, marginTop: 4, textTransform: "uppercase" }} numberOfLines={1}>
                        {String(player.position)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#6B7280", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                      {isPenalized ? "IN BOX" : isSelected ? "Selected" : "Select"}
                    </Text>
                    {!!player?.jerseyNumber && (
                      <Text style={{ color: isPenalized ? "#f87171" : isSelected ? accentColor : "#9CA3AF", fontSize: 10, fontWeight: "700" }}>
                        #{player.jerseyNumber}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={{ backgroundColor: "#171a2c", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
          <Text style={{ color: "#6B7280", fontSize: 11, textAlign: "center" }}>
            {emptyText}
          </Text>
        </View>
      )}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════
  // OVERLAY
  // ═══════════════════════════════════════════════════════════════
  if (pendingEvent && !displayOnly) {
    const eventLabel = pendingEvent.replace(/_/g, " ").toUpperCase();
    const selectedOnIceSide = selTeam ? onIceSnapshot?.[selTeam] : null;
    const selectedTeamPlayers = selTeam ? (filteredPlayers?.[selTeam] || []) : [];
    // Exclude the selected goalie from skaters and bench lists in the modal
    const effectiveGoalieId = selGoaliePlayer || selectedOnIceSide?.goalieId || null;
    // Players currently serving a penalty — uses activePenaltiesDisplay (wall-clock adjusted)
    // so a player whose penalty expired by wall time is immediately unblocked, even while paused.
    const teamPenaltyPlayerIds = selTeam
      ? new Set(activePenaltiesDisplay.filter(p => p.teamSide === selTeam).map(p => String(p.playerId)))
      : new Set();
    const selectedOnIcePlayers = selTeam
      ? ((filteredPlayers?.[selTeam] || []).filter((player) => {
          const pid = String(toPlayerId(player));
          return (selectedOnIceSide?.skaterIds || []).includes(pid)
            && pid !== String(effectiveGoalieId)
            && !teamPenaltyPlayerIds.has(pid); // exclude players in the penalty box
        }))
      : [];
    // Bench = not truly on ice, not goalie, not penalized.
    // Penalized players are shown in a dedicated "Penalty Box" section instead.
    // trulyOnIceSet = skaterIds minus penalized (so penalized skaters don't hide from bench).
    const trulyOnIceSet = new Set(
      (selectedOnIceSide?.skaterIds || []).map(String).filter(pid => !teamPenaltyPlayerIds.has(pid))
    );
    const selectedBenchPlayers = selTeam
      ? (filteredPlayers?.[selTeam] || []).filter(p => {
          const pid = String(toPlayerId(p));
          return !trulyOnIceSet.has(pid) && pid !== String(effectiveGoalieId) && !teamPenaltyPlayerIds.has(pid);
        })
      : [];
    const penaltyBoxPlayers = selTeam
      ? (filteredPlayers?.[selTeam] || []).filter(p => teamPenaltyPlayerIds.has(String(toPlayerId(p))))
      : [];
    const selectedStrengthSkaters = selTeam ? Number(sport?.strength?.[selTeam]?.skaters) || FULL_STRENGTH_SKATERS : FULL_STRENGTH_SKATERS;
    const isPlayerRequiredEvent = PLAYER_SELECTION_REQUIRED_EVENTS.has(pendingEvent);
    const hasGoalieChanged = String(selGoaliePlayer || "") !== String(selectedOnIceSide?.goalieId || "");
    const isConfirmDisabled = pendingEvent === "line_change"
      ? !selOutgoingPlayer && !selIncomingPlayer && !hasGoalieChanged
      : pendingEvent === "goalie_return"
        ? !!(selectedOnIceSide?.goaliePulled && (selectedOnIceSide?.skaterIds?.length || 0) > selectedStrengthSkaters && !selOutgoingPlayer)
        : isPlayerRequiredEvent && !selPlayer;
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={closeOverlay}>
        <View style={{ flex: 1, backgroundColor: "rgba(4,8,20,0.72)", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 28 }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} activeOpacity={1} onPress={closeOverlay} />
          <View style={{ backgroundColor: "#1a1d2e", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", maxHeight: overlayMaxHeight, width: "100%", maxWidth: 720, alignSelf: "center", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 18 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 3, color: "#47feb7", textTransform: "uppercase" }}>
                {eventLabel}
              </Text>
              <TouchableOpacity onPress={closeOverlay}>
                <Ionicons name="close-circle" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ paddingBottom: 4 }}>

        {/* ── STEP: team ── */}
        {step === "team" && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Which Team?
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {manageableSides.map(side => (
                <TouchableOpacity
                  key={side}
                  onPress={() => onTeamSelect(side)}
                  style={{ flex: 1, backgroundColor: teamBg(side), borderWidth: 1, borderColor: teamBorder(side), borderRadius: 12, paddingVertical: 20, alignItems: "center", gap: 4, ...raised3d(teamDeep(side)) }}
                >
                  <Text style={{ color: teamColor(side), fontWeight: "900", fontSize: 16 }}>
                    {side === "home" ? teamNames.home : teamNames.away}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 2 }}>{side}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP: goal_type ── */}
        {step === "goal_type" && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Goal Type
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              {GOAL_TYPES.map(gt => (
                <TouchableOpacity
                  key={gt.key}
                  onPress={() => onGoalTypeSelect(gt.key)}
                  style={{ flex: 1, minWidth: "40%", backgroundColor: gt.bg, borderWidth: 2, borderColor: selGoalType === gt.key ? gt.color : gt.border, borderRadius: 12, paddingVertical: 16, alignItems: "center", gap: 4 }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "900", color: gt.color }}>{gt.label}</Text>
                  <Text style={{ fontSize: 9, color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase" }}>{gt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── SUCCESS STATE: Line Change Confirmed ── */}
        {lineChangeSuccess && pendingEvent === "line_change" && (
          <View style={{ alignItems: "center", paddingVertical: 4 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(71,254,183,0.14)", borderWidth: 2, borderColor: "#47feb7", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Ionicons name="checkmark" size={30} color="#47feb7" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#47feb7", letterSpacing: 2, marginBottom: 4 }}>Line Change Applied</Text>
            <Text style={{ color: "#6B7280", fontSize: 10, marginBottom: 14 }}>Submitted — syncing to server</Text>
            {lineChangeSuccess.outPlayerName && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <View style={{ backgroundColor: "rgba(248,113,113,0.15)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "800" }}>⬆  {lineChangeSuccess.outPlayerName}</Text>
                </View>
                <Text style={{ color: "#6B7280", fontSize: 10 }}>→ Bench</Text>
              </View>
            )}
            {lineChangeSuccess.inPlayerName && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <View style={{ backgroundColor: "rgba(71,254,183,0.15)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: "#47feb7", fontSize: 12, fontWeight: "800" }}>⬇  {lineChangeSuccess.inPlayerName}</Text>
                </View>
                <Text style={{ color: "#6B7280", fontSize: 10 }}>→ On Ice</Text>
              </View>
            )}
            {lineChangeSuccess.goalieChanged && !lineChangeSuccess.outPlayerName && !lineChangeSuccess.inPlayerName && (
              <Text style={{ color: "#fbbf24", fontSize: 13, fontWeight: "700", marginBottom: 4 }}>Goalie updated</Text>
            )}
            {lineChangeSuccess.newOnIcePlayers?.length > 0 && (
              <View style={{ backgroundColor: "#141726", borderRadius: 12, padding: 12, marginTop: 14, width: "100%", borderWidth: 1, borderColor: "rgba(71,254,183,0.12)" }}>
                <Text style={{ color: "#6B7280", fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>New On-Ice Lineup</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {lineChangeSuccess.newOnIcePlayers.map((player, i) => (
                    <View key={i} style={{ backgroundColor: "rgba(71,254,183,0.10)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
                      <Text style={{ color: "#47feb7", fontSize: 10, fontWeight: "700" }}>{getPlayerShortName(player)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              onPress={closeOverlay}
              style={{ marginTop: 20, backgroundColor: "#47feb7", paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#003824", fontWeight: "900", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: line_change — redesigned 3-zone layout ── */}
        {step === "line_change" && !lineChangeSuccess && selectedOnIceSide && (
          <View>
            {/* Header: count pills + clear button */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <View style={{ backgroundColor: "rgba(71,254,183,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(71,254,183,0.25)" }}>
                  <Text style={{ color: "#47feb7", fontSize: 9, fontWeight: "900" }}>{selectedOnIcePlayers.length}/{selectedStrengthSkaters} ON ICE</Text>
                </View>
                {penaltyBoxPlayers.length > 0 && (
                  <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" }}>
                    <Text style={{ color: "#f87171", fontSize: 9, fontWeight: "900" }}>{penaltyBoxPlayers.length} IN BOX</Text>
                  </View>
                )}
                <View style={{ backgroundColor: "rgba(96,165,250,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(96,165,250,0.25)" }}>
                  <Text style={{ color: "#60a5fa", fontSize: 9, fontWeight: "900" }}>{selectedBenchPlayers.length} BENCH</Text>
                </View>
              </View>
              {(selOutgoingPlayer || selIncomingPlayer) && (
                <TouchableOpacity
                  onPress={() => { setSelOutgoingPlayer(null); setSelIncomingPlayer(null); }}
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                >
                  <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "700" }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Swap preview banner */}
            {(selOutgoingPlayer || selIncomingPlayer) && (
              <View style={{ backgroundColor: "rgba(71,254,183,0.07)", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(71,254,183,0.20)", marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#6B7280", fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>GOING OFF</Text>
                  <Text style={{ color: selOutgoingPlayer ? "#f87171" : "#374151", fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
                    {selOutgoingPlayer ? resolvePlayerName(selOutgoingPlayer) || "—" : "— Not chosen —"}
                  </Text>
                </View>
                <Ionicons name="swap-horizontal-outline" size={20} color="#47feb7" />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ color: "#6B7280", fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>COMING ON</Text>
                  <Text style={{ color: selIncomingPlayer ? "#47feb7" : "#374151", fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
                    {selIncomingPlayer ? resolvePlayerName(selIncomingPlayer) || "—" : "— Not chosen —"}
                  </Text>
                </View>
              </View>
            )}

            {/* ─ Goalie ─ */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ color: "#fbbf24", fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2 }}>Goalie</Text>
                {!selGoaliePlayer && <Text style={{ color: "#fbbf24", fontSize: 9 }}>Tap to assign</Text>}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
                {selectedTeamPlayers.map(player => {
                  const pid = String(toPlayerId(player));
                  const isActive = String(selGoaliePlayer) === pid;
                  const isPen = teamPenaltyPlayerIds.has(pid);
                  return (
                    <TouchableOpacity key={`g-${pid}`} onPress={() => setSelGoaliePlayer(isActive ? null : pid)} style={{ width: "25%", paddingHorizontal: 3, marginBottom: 5 }}>
                      <View style={{ borderRadius: 10, paddingHorizontal: 6, paddingVertical: 7, minHeight: 56, backgroundColor: isActive ? "rgba(251,191,36,0.18)" : "#171a2c", borderWidth: 1, borderColor: isActive ? "#fbbf24" : "rgba(255,255,255,0.06)", justifyContent: "space-between" }}>
                        {isPen && <View style={{ position: "absolute", top: 3, right: 3, backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 }}><Text style={{ color: "#fff", fontSize: 6, fontWeight: "900" }}>PEN</Text></View>}
                        <Text style={{ color: isActive ? "#fbbf24" : "#dfe1f9", fontSize: 11, fontWeight: "800" }} numberOfLines={2}>{getPlayerShortName(player)}</Text>
                        <Text style={{ color: isActive ? "#fbbf24" : "#6B7280", fontSize: 8, fontWeight: "700", textTransform: "uppercase", marginTop: 3 }}>{isActive ? "GOALIE ✓" : "Set"}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ─ ON ICE ─ */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#47feb7" }} />
                <Text style={{ color: "#47feb7", fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2 }}>
                  ON ICE — tap to sub OUT
                </Text>
              </View>
              {selectedOnIcePlayers.length === 0 ? (
                <View style={{ backgroundColor: "#171a2c", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: "#6B7280", fontSize: 11, textAlign: "center" }}>No skaters tracked on ice</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
                  {selectedOnIcePlayers.map(player => {
                    const pid = String(toPlayerId(player));
                    const isOut = pid === String(selOutgoingPlayer);
                    return (
                      <TouchableOpacity key={`ice-${pid}`} onPress={() => setSelOutgoingPlayer(isOut ? null : pid)} style={{ width: "25%", paddingHorizontal: 3, marginBottom: 5 }}>
                        <View style={{ borderRadius: 10, paddingHorizontal: 6, paddingVertical: 7, minHeight: 56, backgroundColor: isOut ? "rgba(248,113,113,0.18)" : "rgba(71,254,183,0.06)", borderWidth: isOut ? 2 : 1, borderColor: isOut ? "#f87171" : "rgba(71,254,183,0.2)", justifyContent: "space-between" }}>
                          <Text style={{ color: isOut ? "#f87171" : "#dfe1f9", fontSize: 11, fontWeight: "800" }} numberOfLines={2}>{getPlayerShortName(player)}</Text>
                          <Text style={{ color: isOut ? "#f87171" : "#47feb7", fontSize: 8, fontWeight: "700", textTransform: "uppercase", marginTop: 3 }}>{isOut ? "⬆ GOING OFF" : "⬆ Bench"}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ─ PENALTY BOX ─ */}
            {penaltyBoxPlayers.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#f87171" }} />
                  <Text style={{ color: "#f87171", fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2 }}>PENALTY BOX — serving time</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
                  {penaltyBoxPlayers.map(player => {
                    const pid = String(toPlayerId(player));
                    const pen = activePenaltiesDisplay.find(p => String(p.playerId) === pid);
                    const remaining = pen ? Math.max(0, pen.remainingSeconds) : 0;
                    return (
                      <View key={`pen-${pid}`} style={{ width: "25%", paddingHorizontal: 3, marginBottom: 5 }}>
                        <View style={{ borderRadius: 10, paddingHorizontal: 6, paddingVertical: 7, minHeight: 56, backgroundColor: "rgba(239,68,68,0.07)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)", justifyContent: "space-between", opacity: 0.75 }}>
                          <Text style={{ color: "#f87171", fontSize: 11, fontWeight: "800" }} numberOfLines={2}>{getPlayerShortName(player)}</Text>
                          <Text style={{ color: "#f87171", fontSize: 8, fontWeight: "700", textTransform: "uppercase", marginTop: 3 }}>
                            {remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "SERVING"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─ BENCH ─ */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#60a5fa" }} />
                <Text style={{ color: "#60a5fa", fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2 }}>
                  BENCH — tap to sub IN
                </Text>
              </View>
              {selectedBenchPlayers.length === 0 ? (
                <View style={{ backgroundColor: "#171a2c", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: "#6B7280", fontSize: 11, textAlign: "center" }}>No bench players available</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
                  {selectedBenchPlayers.map(player => {
                    const pid = String(toPlayerId(player));
                    const isIn = pid === String(selIncomingPlayer);
                    return (
                      <TouchableOpacity key={`bench-${pid}`} onPress={() => setSelIncomingPlayer(isIn ? null : pid)} style={{ width: "25%", paddingHorizontal: 3, marginBottom: 5 }}>
                        <View style={{ borderRadius: 10, paddingHorizontal: 6, paddingVertical: 7, minHeight: 56, backgroundColor: isIn ? "rgba(71,254,183,0.18)" : "#171a2c", borderWidth: isIn ? 2 : 1, borderColor: isIn ? "#47feb7" : "rgba(96,165,250,0.18)", justifyContent: "space-between" }}>
                          <Text style={{ color: isIn ? "#47feb7" : "#dfe1f9", fontSize: 11, fontWeight: "800" }} numberOfLines={2}>{getPlayerShortName(player)}</Text>
                          <Text style={{ color: isIn ? "#47feb7" : "#60a5fa", fontSize: 8, fontWeight: "700", textTransform: "uppercase", marginTop: 3 }}>{isIn ? "⬇ COMING ON" : "⬇ Ice"}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {!selGoaliePlayer && (
              <Text style={{ color: "#fbbf24", fontSize: 10, marginBottom: 10, textAlign: "center" }}>
                Assign a goalie above to save the lineup correctly
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={closeOverlay}
                style={{ flex: 1, backgroundColor: "#171a2c", paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                disabled={isConfirmDisabled}
                style={{ flex: 2, backgroundColor: isConfirmDisabled ? "#374151" : "#47feb7", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: isConfirmDisabled ? "#6B7280" : "#003824", fontWeight: "900", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {selOutgoingPlayer && selIncomingPlayer ? "Apply Swap" : selIncomingPlayer ? "Add to Ice" : selOutgoingPlayer ? "Remove from Ice" : "Apply Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === "goalie_return" && selectedOnIceSide && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
              Return Goalie
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 10 }}>
              {(selectedOnIceSide.skaterIds?.length || 0) > selectedStrengthSkaters
                ? "Select the extra attacker to leave before the goalie returns."
                : "Goalie can return immediately."}
            </Text>
            {(selectedOnIceSide.skaterIds?.length || 0) > selectedStrengthSkaters && (
              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {selectedOnIcePlayers.map((player) => {
                  const playerId = toPlayerId(player);
                  const isSelected = String(selOutgoingPlayer) === String(playerId);
                  return (
                    <TouchableOpacity
                      key={playerId}
                      onPress={() => setSelOutgoingPlayer(isSelected ? null : playerId)}
                      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, marginBottom: 4, backgroundColor: isSelected ? "rgba(248,113,113,0.18)" : "transparent", borderWidth: 1, borderColor: isSelected ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.05)" }}
                    >
                      <Text style={{ color: isSelected ? "#f87171" : "#dfe1f9", fontSize: 12, fontWeight: "700" }}>
                        {player.firstName} {player.lastName}
                      </Text>
                      <Text style={{ color: "#6B7280", fontSize: 11 }}>OUT</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={closeOverlay}
                style={{ flex: 1, backgroundColor: "#171a2c", paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                disabled={isConfirmDisabled}
                style={{ flex: 2, backgroundColor: isConfirmDisabled ? "#374151" : "#47feb7", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: isConfirmDisabled ? "#6B7280" : "#003824", fontWeight: "900", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
                  Return Goalie
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP: player ── */}
        {step === "player" && (
          <View>
            <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
              Select On-Ice Player
            </Text>

            {/* Penalty type selector (shown inline for penalty) */}
            {pendingEvent === "penalty" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {PENALTY_OPTIONS.map(po => (
                  <TouchableOpacity
                    key={po.label}
                    onPress={() => { setSelPenaltyDuration(po.duration); setSelPenaltyLabel(po.label); }}
                    style={{ flex: 1, minWidth: "40%", backgroundColor: selPenaltyDuration === po.duration ? `${po.color}22` : "#171a2c", borderWidth: 1, borderColor: selPenaltyDuration === po.duration ? po.color : "rgba(255,255,255,0.08)", borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 2 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "900", color: po.color }}>{po.label}</Text>
                    <Text style={{ fontSize: 9, color: "#9CA3AF" }}>{po.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {renderPlayerGridSection({
              title: pendingEvent === "goal" ? "Goal Scorer" : "On-Ice Player",
              accentColor: "#47feb7",
              players: selectedOnIcePlayers,
              selectedId: selPlayer,
              emptyText: "No on-ice players available.",
              penalizedPlayerIds: teamPenaltyPlayerIds,
              onPress: (playerId, isSelected) => {
                setSelPlayer(isSelected ? null : playerId);
                setSelAssist1(null);
                setSelAssist2(null);
              },
            })}

            {/* For goal: up to two assists after scorer */}
            {pendingEvent === "goal" && selPlayer && (
              <View style={{ marginTop: 12 }}>
                {renderPlayerGridSection({
                  title: "Primary Assist (Optional)",
                  accentColor: "#47feb7",
                  players: selectedOnIcePlayers.filter(pl => String(pl._id || pl.id) !== String(selPlayer) && String(pl._id || pl.id) !== String(selAssist2)),
                  selectedId: selAssist1,
                  emptyText: "No assist options available.",
                  onPress: (playerId, isSelected) => setSelAssist1(isSelected ? null : playerId),
                })}
                {renderPlayerGridSection({
                  title: "Secondary Assist (Optional)",
                  accentColor: "#b8c3ff",
                  players: selectedOnIcePlayers.filter(pl => String(pl._id || pl.id) !== String(selPlayer) && String(pl._id || pl.id) !== String(selAssist1)),
                  selectedId: selAssist2,
                  emptyText: "No secondary assist options available.",
                  onPress: (playerId, isSelected) => setSelAssist2(isSelected ? null : playerId),
                })}
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setStep(pendingEvent === "goal" ? "goal_type" : "team")}
                style={{ flex: 1, backgroundColor: "#171a2c", paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "700" }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                disabled={isConfirmDisabled}
                style={{ flex: 2, backgroundColor: isConfirmDisabled ? "#374151" : "#47feb7", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: isConfirmDisabled ? "#6B7280" : "#003824", fontWeight: "900", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
                  {pendingEvent === "goal" ? "⬤  Record Goal" : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PANEL
  // ═══════════════════════════════════════════════════════════════
  const periodLabel = getPeriodLabel(currentPeriod, isOvertime, isShootout);

  return (
    <View style={{ width: "100%" }} {...panResponder.panHandlers}>
      {/* Syncing badge */}
      {eventQueue.length > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", top: 8, right: 8, zIndex: 20, backgroundColor: "rgba(13,16,31,0.86)", borderWidth: 1, borderColor: "rgba(71,254,183,0.28)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
          <Text style={{ color: "#47feb7", fontWeight: "900", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>
            Syncing {eventQueue.length}
          </Text>
        </View>
      )}

      {/* ══ SCOREBOARD ══ */}
      <View style={{ display: hideScoreboard ? "none" : "flex", backgroundColor: "#1a1d2e", borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(71,254,183,0.15)", overflow: "hidden" }}>
        {/* accent lines */}
        <View style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", backgroundColor: "#47feb7" }} />
        <View style={{ position: "absolute", top: 0, right: 0, width: 3, height: "100%", backgroundColor: "#b8c3ff" }} />

        {/* Team names + period */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#47feb7", maxWidth: "30%" }} numberOfLines={1}>
            {teamNames.home}
          </Text>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 4, color: "#9CA3AF", textTransform: "uppercase" }}>
              {periodLabel} PERIOD
            </Text>
          </View>
          <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#b8c3ff", maxWidth: "30%", textAlign: "right" }} numberOfLines={1}>
            {teamNames.away}
          </Text>
        </View>

        {/* Scores + clock */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 42, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 50, minWidth: 56, textAlign: "center" }}>
            {String(homeScore).padStart(2, "0")}
          </Text>

          <View style={{ alignItems: "center", gap: 6 }}>
            <View style={{ backgroundColor: "#0d101f", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
              <Text style={{ fontSize: 22, fontWeight: "900", fontFamily: "monospace", letterSpacing: 4, color: "#47feb7" }}>
                {fmtTime(gameTime?.minutes ?? 20, gameTime?.seconds ?? 0)}
              </Text>
            </View>
            {isScheduled && isOwner && (
              <TouchableOpacity
                onPress={onStartGame}
                disabled={isUpdating}
                style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, opacity: isUpdating ? 0.5 : 1 }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>▶ Start Game</Text>
              </TouchableOpacity>
            )}
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
            {isScheduled && !isOwner && (
              <Text style={{ color: "#6B7280", fontSize: 10 }}>⏳ Waiting for coach</Text>
            )}
          </View>

          <Text style={{ fontSize: 42, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 50, minWidth: 56, textAlign: "center" }}>
            {String(awayScore).padStart(2, "0")}
          </Text>
        </View>

        {/* Stat bar: Shots · PP · PIM */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          {[
            { label: "SOG", home: homeShots, away: awayShots },
            { label: "PP",  home: `${homePP.goals}/${homePP.opportunities}`, away: `${awayPP.goals}/${awayPP.opportunities}` },
            { label: "PIM", home: homePIM, away: awayPIM },
            { label: "STR", home: strength.home, away: strength.away },
          ].map(stat => (
            <View key={stat.label} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#dfe1f9" }}>
                <Text style={{ color: "#47feb7" }}>{stat.home}</Text>
                <Text style={{ color: "#6B7280" }}> – </Text>
                <Text style={{ color: "#b8c3ff" }}>{stat.away}</Text>
              </Text>
            </View>
          ))}
        </View>
        {renderIceHockeyPenaltyStrip({
          penalties: activePenaltiesDisplay,
          teamNames,
          resolvePlayerName,
        })}
      </View>

      {!displayOnly && !gameOver && (
        <>
          <View style={{ backgroundColor: "#171a2c", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#6B7280", marginBottom: 10 }}>
              On-Ice Tracking
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {manageableSides.map((side) => {
                const sideOnIce = onIceSnapshot?.[side] || { skaterIds: [], goalieId: null, goaliePulled: false, tooManyPlayers: false };
                const sidePlayers = filteredPlayers?.[side] || [];
                const goalieName = resolvePlayerName(sideOnIce.goalieId) || "Goalie not set";
                const allowedSkaters = (Number(sport?.strength?.[side]?.skaters) || FULL_STRENGTH_SKATERS) + (sideOnIce.goaliePulled ? 1 : 0);
                const benchCount = getBenchPlayers(sidePlayers, sideOnIce).length;
                return (
                  <View key={side} style={{ flex: 1, backgroundColor: side === "home" ? "rgba(71,254,183,0.08)" : "rgba(184,195,255,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: side === "home" ? "rgba(71,254,183,0.18)" : "rgba(184,195,255,0.18)" }}>
                    <Text style={{ color: teamAccent(side), fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
                      {side === "home" ? teamNames.home : teamNames.away}
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 10, marginBottom: 8 }}>
                      {sideOnIce.skaterIds.length}/{allowedSkaters} skaters · bench {benchCount}
                    </Text>
                    <Text style={{ color: sideOnIce.goaliePulled ? "#fbbf24" : "#9CA3AF", fontSize: 10, fontWeight: "700", marginBottom: 8 }}>
                      {sideOnIce.goaliePulled ? "Goalie Pulled" : `Goalie: ${goalieName}`}
                    </Text>
                    {!sideOnIce.goalieId && (
                      <Text style={{ color: "#fbbf24", fontSize: 10, fontWeight: "700", marginBottom: 8 }}>
                        Select a goalie before using pull goalie.
                      </Text>
                    )}
                    {sideOnIce.tooManyPlayers && (
                      <Text style={{ color: "#f87171", fontSize: 10, fontWeight: "700", marginBottom: 8 }}>
                        Too many skaters on ice
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => openLineChange(side)}
                        disabled={disabled}
                        style={{ flex: 1, backgroundColor: chipBg, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: chipBorder, opacity: disabled ? 0.4 : 1, ...raised3d(darkChipDeep) }}
                      >
                        <Text style={{ color: UI.isDark ? "#dfe1f9" : "#111827", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>Lineup</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleGoalieToggle(side)}
                        disabled={disabled || sidePlayers.length === 0}
                        style={{ flex: 1, backgroundColor: chipBg, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: chipBorder, opacity: (disabled || sidePlayers.length === 0) ? 0.4 : 1, ...raised3d(darkChipDeep) }}
                      >
                        <Text style={{ color: !sideOnIce.goalieId ? "#fbbf24" : sideOnIce.goaliePulled ? "#47feb7" : "#fbbf24", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                          {!sideOnIce.goalieId ? "Set Goalie" : sideOnIce.goaliePulled ? "Goalie In" : "Pull Goalie"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── TIER 1: GOAL BUTTONS ── */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
            {manageableSides.map(side => (
              <TouchableOpacity
                key={side}
                onPress={() => handleGoalTap(side)}
                onLongPress={() => {
                  if (disabled || displayOnly) return;
                  handleGoalTap(side);
                }}
                disabled={disabled}
                style={{
                  flex: 1,
                  backgroundColor: teamBg(side),
                  borderRadius: 14,
                  paddingVertical: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: teamBorder(side),
                  opacity: disabled ? 0.4 : 1,
                  ...raised3d(teamDeep(side)),
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: teamLabelColor(side), marginBottom: 3 }}>
                  {side === "home" ? teamNames.home : teamNames.away}
                </Text>
                <Text style={{ fontSize: 30, fontWeight: "900", color: teamColor(side), letterSpacing: -1 }}>
                  GOAL
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── TIER 2: PENALTY ── */}
          <Text style={{ textAlign: "center", color: UI.isDark ? "#374151" : "#9CA3AF", fontSize: 8, marginBottom: 14, letterSpacing: 1 }}>
            GOALS REQUIRE SCORER, ASSISTS USE CURRENT ON-ICE PLAYERS
          </Text>
          <TouchableOpacity
            onPress={() => startEvent("penalty")}
            disabled={disabled || manageableSides.length === 0}
            style={{
              backgroundColor: penaltyBg,
              borderWidth: 2,
              borderColor: penaltyBorder,
              borderRadius: 14,
              paddingVertical: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 16,
              opacity: (disabled || manageableSides.length === 0) ? 0.4 : 1,
              ...raised3d(penaltyDeep),
            }}
          >
            <Ionicons name="alert-circle" size={22} color={penaltyText} />
            <View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: penaltyText, letterSpacing: 2, textTransform: "uppercase" }}>Penalty</Text>
              <Text style={{ fontSize: 9, color: penaltyCaption, marginTop: 2, letterSpacing: 1 }}>2 · 4 · 5 · 10 min</Text>
            </View>
          </TouchableOpacity>

          {/* ── TIER 3: COMPACT STAT GRID ── */}
          <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: UI.isDark ? "#374151" : "#9CA3AF", marginBottom: 8, textAlign: "center" }}>
            QUICK STATS
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {manageableSides.map(side => (
              <View key={side} style={{ flex: 1 }}>
                <Text style={{ textAlign: "center", fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: teamAccent(side), marginBottom: 6 }}>
                  {side === "home" ? teamNames.home : teamNames.away}
                </Text>
                {[
                  [
                    { type: "shot_on_goal", icon: "radio-button-on-outline", label: "Shot",  lightBg: "#3B82F6", lightBorder: "#2563EB", lightDeep: "#1D4ED8" },
                    { type: "hit",          icon: "flash-outline",           label: "Hit",   lightBg: "#F59E0B", lightBorder: "#D97706", lightDeep: "#B45309" },
                    { type: "blocked_shot", icon: "shield-outline",          label: "Block", lightBg: "#14B8A6", lightBorder: "#0D9488", lightDeep: "#0F766E" },
                  ],
                  [
                    { type: "takeaway",    icon: "arrow-forward-circle-outline", label: "Take", lightBg: "#22C55E", lightBorder: "#16A34A", lightDeep: "#15803D" },
                    { type: "giveaway",    icon: "arrow-back-circle-outline",    label: "Give", lightBg: "#F43F5E", lightBorder: "#E11D48", lightDeep: "#BE123C" },
                    { type: "faceoff_won", icon: "ellipse-outline",              label: "Face", lightBg: "#6366F1", lightBorder: "#4F46E5", lightDeep: "#4338CA" },
                  ],
                ].map((row, ri) => (
                  <View key={ri} style={{ flexDirection: "row", gap: 5, marginBottom: ri === 0 ? 5 : 0 }}>
                    {row.map(btn => {
                      const bg = UI.isDark ? chipBg : btn.lightBg;
                      const border = UI.isDark ? chipBorder : btn.lightBorder;
                      const deep = UI.isDark ? darkChipDeep : btn.lightDeep;
                      const iconColor = UI.isDark ? teamAccent(side) : "#FFFFFF";
                      const labelColor = UI.isDark ? chipLabel : "#FFFFFF";
                      return (
                        <TouchableOpacity
                          key={btn.type}
                          onPress={() => openPlayerEventForTeam(btn.type, side)}
                          disabled={disabled}
                          style={{ flex: 1, backgroundColor: bg, paddingVertical: 10, borderRadius: 8, alignItems: "center", gap: 3, borderWidth: 1, borderColor: border, opacity: disabled ? 0.4 : 1, ...raised3d(deep) }}
                        >
                          <Ionicons name={btn.icon} size={15} color={iconColor} />
                          <Text style={{ fontSize: 9, fontWeight: "700", color: labelColor }}>{btn.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* ── TIER 4: ICING + OFFSIDE (minimal) ── */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {[
              { type: "icing",   label: "Icing",   icon: "snow-outline", color: "#60a5fa" },
              { type: "offside", label: "Offside", icon: "flag-outline",  color: "#fb923c" },
            ].map(ev => (
              <View key={ev.type} style={{ flex: 1, backgroundColor: chipBg, borderRadius: 10, borderWidth: 1, borderColor: chipBorder, padding: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <Ionicons name={ev.icon} size={11} color={ev.color} />
                  <Text style={{ fontSize: 9, fontWeight: "900", color: ev.color, textTransform: "uppercase", letterSpacing: 2 }}>{ev.label}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 5 }}>
                  {manageableSides.map(side => (
                    <TouchableOpacity
                      key={side}
                      onPress={() => quickDispatch(ev.type, side)}
                      disabled={disabled}
                      style={{ flex: 1, backgroundColor: teamBg(side), borderWidth: 1, borderColor: teamBorder(side), borderRadius: 6, paddingVertical: 6, alignItems: "center", opacity: disabled ? 0.4 : 1, ...raised3d(teamDeep(side)) }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: "900", color: teamColor(side) }}>
                        {manageableSides.length === 1 ? `Record ${singleManagedTeamName || getIceHockeyTeamName(teamNames, side)}` : getIceHockeyTeamName(teamNames, side)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <Text style={{ textAlign: "center", color: UI.isDark ? "#374151" : "#9CA3AF", fontSize: 8, marginBottom: 20, letterSpacing: 1 }}>
            Team-only calls stay team-level. Player stats now use current on-ice players only.
          </Text>
        </>
      )}

      {/* ══ PERIOD SCORE TABLE ══ */}
      {(sport?.periodScores?.length > 0) && (
        <View style={{ backgroundColor: "#171a2c", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#6B7280", marginBottom: 10 }}>Period Breakdown</Text>
          {/* Header */}
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            <Text style={{ flex: 2, fontSize: 9, color: "#4B5563", fontWeight: "700" }}>TEAM</Text>
            {sport.periodScores.map(ps => (
              <Text key={ps.period} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#4B5563", fontWeight: "700" }}>
                {PERIOD_LABEL[ps.period] || `P${ps.period}`}
              </Text>
            ))}
            <Text style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#6B7280", fontWeight: "900" }}>T</Text>
          </View>
          {["home", "away"].map(side => (
            <View key={side} style={{ flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" }}>
              <Text style={{ flex: 2, fontSize: 11, fontWeight: "700", color: side === "home" ? "#47feb7" : "#b8c3ff" }} numberOfLines={1}>
                {getIceHockeyTeamName(teamNames, side)}
              </Text>
              {sport.periodScores.map(ps => (
                <Text key={ps.period} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "900", color: "#dfe1f9" }}>
                  {ps[side] ?? 0}
                </Text>
              ))}
              <Text style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: "900", color: side === "home" ? "#47feb7" : "#b8c3ff" }}>
                {side === "home" ? homeScore : awayScore}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ══ LIVE TIMELINE ══ */}
      <View
        style={{
          marginTop: 4,
          backgroundColor: UI.isDark ? "transparent" : UI.card,
          borderRadius: UI.isDark ? 0 : 16,
          padding: UI.isDark ? 0 : 14,
          borderWidth: UI.isDark ? 0 : 1,
          borderColor: UI.isDark ? "transparent" : UI.border,
          borderTopWidth: UI.isDark ? 1 : 1,
          borderTopColor: UI.isDark ? "rgba(255,255,255,0.06)" : UI.border,
          paddingTop: UI.isDark ? 14 : 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
            <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: UI.isDark ? "#6B7280" : UI.muted }}>
              Live Play-by-Play
            </Text>
          </View>
          {liveEvents?.length > 0 && (
            <Text style={{ fontSize: 10, fontWeight: "700", color: UI.isDark ? "#4B5563" : UI.textMuted }}>
              {Math.min(liveEvents.length, 5)} recent
            </Text>
          )}
        </View>
        {liveEvents?.length > 0 ? (
          liveEvents.slice(0, 5).map((ev, i) => {
            const visual = getIceHockeyEventVisual(ev.eventType, UI.isDark);
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
                      {(ev.eventType || "").replace(/_/g, " ")}
                      {ev.goalType ? ` · ${String(ev.goalType).replace(/_/g, " ").toUpperCase()}` : ""}
                    </Text>
                    {ev.playerName && ev.playerName !== "Team" && (
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
              backgroundColor: UI.isDark ? "transparent" : UI.cardElevated || "#F3F4F6",
              borderWidth: UI.isDark ? 0 : 1,
              borderColor: UI.isDark ? "transparent" : UI.border,
            }}
          >
            <Text style={{ color: UI.isDark ? "#4B5563" : UI.textDim, fontSize: 12, fontStyle: "italic" }}>
              Waiting for puck drop…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
