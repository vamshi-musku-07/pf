import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSelector, shallowEqual } from "react-redux";
import { createDerivedGameSelector } from "@/features/liveGame/selectors";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { checkTeamOwnerAPI } from "@/services/TeamApi";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { sanitizeGameEvents } from "@/lib/gameModel";
import { normalizeTeamId, isHomeTeamForViewer } from "@/lib/playerRoster";
import {
  reconcileCricketTotalsFromEvents,
  getCricketMatchFormatLabel,
  getCricketMatchResult,
} from "./game/hooks/cricketState";
import { fonts } from "@/constants/typography";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { formatChessResultLabel, getChessLivestreamLabel } from "@/lib/chessUtils";
import CurvedBottomTabBar from "./game/CurvedBottomTabBar";


// ── Custom hooks ──
import { useGameData } from "./game/hooks/useGameData";
import { useOfflineQueue } from "./game/hooks/useOfflineQueue";
import { useGameTimer } from "./game/hooks/useGameTimer";
import { useCommentary } from "./game/hooks/useCommentary";
import { useGameSocket } from "./game/hooks/useGameSocket";
import { useSportHandlers } from "./game/hooks/useSportHandlers";

// ── Sport scoring panels ──
import HockeyScoringPanel, { HockeyScoreboardCard } from "./game/HockeyScoringPanel";
import IceHockeyScoringPanel, { IceHockeyScoreboardCard } from "./game/IceHockeyScoringPanel";
import LiveFootballScoringPanel from "./game/LiveFootballScoringPanel";
import { FootballScoreboardCard } from "./game/FootballScoringPanel";
import FootballLineupPitch from "./game/FootballLineupPitch";
import FootballPlayerDetailSheet from "./game/FootballPlayerDetailSheet";
// CricketScoringPanelMobile replaced by LiveCricketScoringPanel.
import { CricketScorecardMobile } from "./game/CricketScorecard";
import { CricketEventTimelineMobile } from "./game/CricketEventTimeline";
import LiveBasketballScoringPanel from "./game/LiveBasketballScoringPanel";
import { BasketballScoreboardCard } from "./game/BasketballScoringPanel";
import BasketballMatchStats from "./game/BasketballMatchStats";
// VolleyballScoringPanelMobile replaced by LiveVolleyballScoringPanel.
// TennisScoringPanelMobile replaced by LiveTennisScoringPanel.
// BadmintonScoringPanelMobile replaced by LiveBadmintonScoringPanel.
// TableTennisScoringPanelMobile replaced by LiveTableTennisScoringPanel.
import { TableTennisScoreboardCard } from "./game/TableTennisScoringPanel";
// BaseballScoringPanelMobile replaced by LiveBaseballScoringPanel.
// RugbyScoringPanelMobile replaced by LiveRugbyScoringPanel.
import { RugbyScoreboardCard, RugbyPossessionBar } from "./game/RugbyScoringPanel";
// PickleballScoringPanelMobile replaced by LivePickleballScoringPanel.
import { PickleballScoreboardCard } from "./game/PickleballScoringPanel";
import ChessScoringPanelMobile from "./game/ChessScoringPanel";

// ── Live (event-sourced) wrappers ──
// These wrap the panels above and feed them `derivedGame = serverState +
// pendingEvents` from the local-first queue. Scoring taps dispatch into
// the queue instead of hitting the legacy single-event endpoint, so they
// can't race the polling/socket paths that still read `currentGame` via
// useGameData. After first hydration, the wrappers ignore `currentGame`
// entirely (hydration lock) — preventing stale-server-state flicker.
import LiveTennisScoringPanel from "./game/LiveTennisScoringPanel";
import LiveVolleyballScoringPanel from "./game/LiveVolleyballScoringPanel";
import { VolleyballScoreboardCard } from "./game/VolleyballScoringPanel";
import { VolleyballScorecardMobile } from "./game/VolleyballScorecard";
import { TennisScoreboardCard } from "./game/TennisScoringPanel";
import { TennisScorecardMobile } from "./game/TennisScorecard";
import LiveBadmintonScoringPanel from "./game/LiveBadmintonScoringPanel";
import { BadmintonScoreboardCard } from "./game/BadmintonScoringPanel";
import { BadmintonScorecardMobile, BadmintonStatsMobile } from "./game/BadmintonScorecard";
import LiveTableTennisScoringPanel from "./game/LiveTableTennisScoringPanel";
import LiveCricketScoringPanel from "./game/LiveCricketScoringPanel";
import { CricketMatchComparisonStatsPanel, FootballMatchComparisonStatsPanel } from "./game/MatchComparisonStats";
import LivePickleballScoringPanel from "./game/LivePickleballScoringPanel";
import LiveRugbyScoringPanel from "./game/LiveRugbyScoringPanel";
import LiveBaseballScoringPanel from "./game/LiveBaseballScoringPanel";
import { BaseballScoreboardCard } from "./game/BaseballScoringPanel";
import { BaseballScorecardMobile } from "./game/BaseballScorecard";
import { useLiveGame } from "@/features/liveGame/hooks/useLiveGame";
import { useSyncExternalSnapshot } from "@/features/liveGame/hooks/useSyncExternalSnapshot";

const pickFresherGame = (a, b) => {
  if (!a?.base) return b || a;
  if (!b?.base) return a;
  const eventsA = Array.isArray(a.sport?.events) ? a.sport.events.length : 0;
  const eventsB = Array.isArray(b.sport?.events) ? b.sport.events.length : 0;
  if (eventsA !== eventsB) return eventsB > eventsA ? b : a;
  const versionA = Number(a.base?.version || 0);
  const versionB = Number(b.base?.version || 0);
  if (versionA > 0 && versionB > 0 && versionA !== versionB) {
    return versionB > versionA ? b : a;
  }
  return b;
};

export const formatName = (player) => {
  if (!player) return "";
  const first = (player.firstName || "").trim();
  const last = (player.lastName || "").trim();
  return last ? `${first} ${last}` : first || "Player";
};

const parseClockValue = (value) => {
  if (typeof value !== "string") return null;
  const [minutesText, secondsText] = value.split(":");
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
};

// ══════════════════════════════════════════
// MAIN GAME SCREEN
// ══════════════════════════════════════════
export default function GameScreen({ gameId, teamId, team, isOwner: isTeamCoach = false, isSelfOwnedOpponent = false, onBack, viewOnly = false, forceTournamentScorer = false, rosterByTeamId = null, hideEmbeddedScoreboard = false }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scoringT = useGameScoringTheme();
  const isOnline = useNetworkStatus();
  const incomingGameReconcilerRef = useRef(null);

  // ── Core game data ──
  const {
    currentGame, setCurrentGame,
    loading,
    teamNames,
    players,
    gameOver, setGameOver,
    fetchGame,
    isMountedRef,
    fetchGameRef,
    currentGameRef,
  } = useGameData(gameId, incomingGameReconcilerRef, { pollMs: viewOnly ? 3000 : 10000, rosterByTeamId });

  const { syncExternalSnapshot } = useLiveGame(gameId);

  const canScore = useMemo(() => {
    if (viewOnly) return false;
    const isTournamentMatch = !!(currentGame?.permissions?.isTournamentMatch || currentGame?.base?.tournamentId);
    if (isTournamentMatch) {
      if (currentGame?.permissions?.canScore === false) return false;
      if (currentGame?.permissions?.canScore === true || forceTournamentScorer) return true;
      return false;
    }
    return isTeamCoach;
  }, [viewOnly, currentGame, isTeamCoach, forceTournamentScorer]);

  // ── Offline queue ──
  const { offlineQueue, offlineQueueRef, syncingLabel, queueOrFire } = useOfflineQueue(isOnline, fetchGame, isMountedRef);

  // ── Timer ──
  const sport = currentGame?.base?.sport;
  const serverTimerState = currentGame?.base?.timerState ?? null;
  const { gameTime, setGameTime, handlePauseResume: _pauseResume, syncTimerNow } = useGameTimer(
    sport,
    currentGame?.base?.status,
    gameId,
    canScore,
    serverTimerState,
    teamNames,
    String(teamId || ""),
    team?.teamName || "",
  );

  // ── Commentary / ElevenLabs audio ──
  const {
    voiceEnabled,
    setVoiceEnabled,
    voiceEnabledRef,
    commentaryMode,
    setCommentaryMode,
    commentaryLanguage,
    setCommentaryLanguage,
    commentarySoundRef,
    playCommentaryAudio,
    stopCommentary,
  } = useCommentary(gameId);

  // ── UI-only state ──
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [activeTab, setActiveTab] = useState("scoring");
  const [visitedTabs, setVisitedTabs] = useState({ scoring: true });

  const handleTabChange = useCallback((key) => {
    if (!key || key === activeTab) return;
    setVisitedTabs((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    setActiveTab(key);
  }, [activeTab]);

  useSyncExternalSnapshot(currentGame, syncExternalSnapshot, { paused: isUpdating });

  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState(null);
  const [lineupPlayerDetail, setLineupPlayerDetail] = useState(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [eventsPageSize, setEventsPageSize] = useState(30);
  const [ownsBothGameTeams, setOwnsBothGameTeams] = useState(false);
  const stableCricketGameRef = useRef(null);
  const stableGameRef = useRef(null);
  const tableTennisTimeoutKeyRef = useRef(null);
  const tableTennisTimeoutResumeTimerRef = useRef(null);
  const finishedClockRef = useRef(null);
  const wasFinishedRef = useRef(false);
  // Rugby undo via Redux live architecture (set by LiveRugbyScoringPanel via undoRef prop)
  const rugbyLiveUndoRef = useRef(null);
  // Badminton undo via Redux live architecture (set by LiveBadmintonScoringPanel via undoRef prop)
  const badmintonUndoRef = useRef(null);
  const footballUndoRef = useRef(null);
  // Table Tennis undo via Redux live architecture (set by LiveTableTennisScoringPanel via undoRef prop)
  const tableTennisUndoRef = useRef(null);
  const tennisUndoRef = useRef(null);
  const normalizedTeamId = normalizeTeamId(teamId) || "";
  const currentGameOpponentTeamId = useMemo(() => {
    const homeTeamId = normalizeTeamId(currentGame?.base?.teamId);
    const awayTeamId = normalizeTeamId(currentGame?.base?.opponentTeamId);
    if (!homeTeamId || !awayTeamId || !normalizedTeamId) return "";
    if (homeTeamId === normalizedTeamId) return awayTeamId;
    if (awayTeamId === normalizedTeamId) return homeTeamId;
    return "";
  }, [currentGame?.base?.teamId, currentGame?.base?.opponentTeamId, normalizedTeamId]);
  const currentGameOpponentRelationship = useMemo(() => {
    if (!currentGameOpponentTeamId) return null;
    return (team?.opponents || []).find((entry) => {
      const opponentId = String(entry?.opponentTeamId?._id || entry?.opponentTeamId || "");
      return opponentId === currentGameOpponentTeamId;
    }) || null;
  }, [currentGameOpponentTeamId, team?.opponents]);
  const isTournamentMatchGame = !!(currentGame?.permissions?.isTournamentMatch || currentGame?.base?.tournamentId);
  const effectiveIsSelfOwnedOpponent =
    forceTournamentScorer
    || (currentGame?.permissions?.canScore === true && isTournamentMatchGame)
    || (ownsBothGameTeams && currentGameOpponentRelationship?.isSelfOwned === true);
  const currentUserSide = isHomeTeamForViewer(currentGame?.base, normalizedTeamId) ? "home" : "away";

  useEffect(() => {
    let isCancelled = false;

    if (!normalizedTeamId || !currentGameOpponentTeamId) {
      setOwnsBothGameTeams(false);
      return () => {
        isCancelled = true;
      };
    }

    const verifySharedOwnership = async () => {
      try {
        const [currentTeamOwnership, opponentTeamOwnership] = await Promise.all([
          checkTeamOwnerAPI(normalizedTeamId),
          checkTeamOwnerAPI(currentGameOpponentTeamId),
        ]);

        if (isCancelled) return;
        setOwnsBothGameTeams(
          currentTeamOwnership?.isTeamOwner === true
            && opponentTeamOwnership?.isTeamOwner === true,
        );
      } catch {
        if (!isCancelled) setOwnsBothGameTeams(false);
      }
    };

    verifySharedOwnership();

    return () => {
      isCancelled = true;
    };
  }, [currentGameOpponentTeamId, normalizedTeamId]);

  // ── Socket ──
  const {
    alertPause,
    alertResume,
    alertBasketballPause,
    alertBasketballResume,
    skipNextTimerToastRef,
  } = useGameSocket({
    gameId, sport, isOwner: canScore, teamId,
    teamName: teamNames?.home || team?.teamName || "",
    playCommentaryAudio, voiceEnabledRef, commentarySoundRef,
    fetchGameRef, isMountedRef, currentGameRef,
    incomingGameReconcilerRef,
    setCurrentGame, setGameOver,
    setGameTime,
  });

  // Wrap pause/resume to fire alerts for the owner immediately
  const handlePauseResume = () => {
    if (!canScore) return;
    const wasRunning = gameTime?.isRunning;
    // Mark to skip the socket echo toast
    if (skipNextTimerToastRef) skipNextTimerToastRef.current = true;
    _pauseResume(canScore);
    const ownerLabel = currentUserSide === "away"
      ? (teamNames?.away || team?.teamName || "Away team")
      : (teamNames?.home || team?.teamName || "Home team");
    if (sport === "Basketball" && wasRunning) {
      alertBasketballPause();
    } else if (sport === "Basketball") {
      alertBasketballResume();
    } else if (wasRunning) {
      alertPause(ownerLabel);
    } else {
      alertResume(ownerLabel);
    }
  };

  // ── Sport event handlers (all sports) ──
  const handlers = useSportHandlers({
    currentGame, gameId, teamId, isOwner: canScore, gameOver,
    isUpdating, setIsUpdating,
    players, teamNames, gameTime, setGameTime,
    fetchGame, setCurrentGame, setGameOver, currentGameRef,
    incomingGameReconcilerRef,
    syncTimerNow, queueOrFire, isOnline,
    userSide: currentUserSide,
    isSelfOwnedOpponent: effectiveIsSelfOwnedOpponent,
  }) || {};

  const {
    handleStartGame, handleEndGame,
    handleHockeyEvent, handleHockeySetupLineup, handleIceHockeyEvent, handleFootballEvent, handleFootballUndo, handleFootballSubstitution, handleFootballSetupLineup, handleFootballMatchState, handleFootballTimerAdjust, handleBasketballEvent, handleBasketballUndo, handleBasketballSubstitution, handleBasketballSetupLineup,
    handleVolleyballRally, handleVolleyballSetupLineup, handleVolleyballSubstitution,
    handleVolleyballLiberoSwap, handleVolleyballTimeout, handleVolleyballChallenge, handleVolleyballUndo,
    handleRallyEvent, handlePickleballUndo, handleTableTennisUndo, handleBadmintonUndo, handleBaseballEvent, handleBaseballSetupLineup, handleBaseballSubstitution, handleBaseballUndo, handleRugbyEvent, handleRugbyKickoffLineup, handleRugbySubstitution,
    handleCricketScore, handleCricketWicket, handleSwapStrike,
    handleChangeBowler, handleSetBattingOrder, handleTossSelection, handleOversConfirm, handleStartSecondInnings, handleStartSuperOver, handleCricketUndo,
    handleChessEvent,
    oversSelection, setOversSelection,
    tossSelection, setTossSelection,
    isCricketSyncing,
    liveEvents,
  } = handlers;

  // Wrap handleEndGame so callers get a visual "ending game" overlay
  // without needing to know about the async operation.
  const doEndGame = useCallback(async () => {
    setIsEndingGame(true);
    // Ending a game can emit a final timer pause event; suppress its echo toast.
    if (skipNextTimerToastRef) skipNextTimerToastRef.current = true;
    try {
      await handleEndGame();
    } finally {
      setIsEndingGame(false);
    }
  }, [handleEndGame]);

  // ── Share scorecard ──
  const handleShareScorecard = async () => {
    if (!currentGame) return;
    const g = currentGame;
    const s1 = g.base?.score?.team1 ?? g.base?.score?.home ?? "-";
    const s2 = g.base?.score?.team2 ?? g.base?.score?.away ?? "-";
    const status = g.base?.status === "finished" ? "Final" : "Live";
    const date = g.base?.startTime
      ? new Date(g.base.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";
    const lines = [
      `🏆 PlayFlash Scorecard`,
      `${sport} · ${status}${date ? ` · ${date}` : ""}`,
      ``,
      `${teamNames.home.padEnd(20)} ${String(s1).padStart(3)}`,
      `${teamNames.away.padEnd(20)} ${String(s2).padStart(3)}`,
    ];
    if (sport === "Cricket" && Array.isArray(g.sport?.innings) && g.sport.innings.length > 0) {
      lines.push(``, getCricketMatchFormatLabel(g.sport?.totalOvers));
      g.sport.innings.forEach((inn, i) => {
        const oversCompleted = inn.overs_completed || 0;
        const ballsInOver = (inn.balls_completed || 0) % 6;
        const oversDisplay = ballsInOver > 0 ? `${oversCompleted}.${ballsInOver}` : `${oversCompleted}`;
        lines.push(`  Innings ${i + 1}: ${inn.total_runs || 0}/${inn.wickets || 0} (${oversDisplay} ov)${inn.isSuperOver || i >= 2 ? " · Super Over" : ""}`);
      });
      const cricketResult = getCricketMatchResult(g);
      if (cricketResult?.finished && cricketResult.resultText) {
        const winnerName = cricketResult.tie
          ? ""
          : cricketResult.winnerSide === "home"
            ? teamNames.home
            : teamNames.away;
        lines.push(``, cricketResult.tie ? cricketResult.resultText : `${winnerName} ${cricketResult.resultText}`);
      } else if (cricketResult?.superOver && cricketResult.resultText) {
        const winnerName = cricketResult.winnerSide === "home" ? teamNames.home : teamNames.away;
        lines.push(``, `${winnerName} ${cricketResult.resultText}`);
      }
    }
    lines.push(``, `Shared via PlayFlash`);
    try {
      await Share.share({ message: lines.join("\n"), title: `${teamNames.home} vs ${teamNames.away} Scorecard` });
    } catch { }
  };

  // ── Cricket score animation state ──
  const CRICKET_ANIM_EVENTS = { boundary_4: "four", boundary_6: "six", bowled: "wicket", caught: "wicket", lbw: "wicket", run_out: "wicket", stumped: "wicket", hit_wicket: "wicket" };
  const [cricketAnim, setCricketAnim] = useState(null); // { side: "user"|"opp", type: "four"|"six"|"wicket" } | null
  const prevEventsLenRef = useRef(0);

  useEffect(() => {
    const events = currentGame?.sport?.events;
    if (!Array.isArray(events) || events.length === 0) {
      prevEventsLenRef.current = 0;
      return;
    }
    if (events.length > prevEventsLenRef.current && prevEventsLenRef.current > 0) {
      const lastEvent = events[events.length - 1];
      const animType = CRICKET_ANIM_EVENTS[lastEvent?.eventType];
      if (animType && sport === "Cricket") {
        const homeTeamId = String(currentGame?.base?.teamId || "");
        const isHome = isHomeTeamForViewer(currentGame?.base, normalizedTeamId);
        const eventTeamId = String(lastEvent?.teamId || "");
        const isUserTeam = isHome ? eventTeamId === homeTeamId : eventTeamId !== homeTeamId;
        // For wickets, the event teamId is the bowling team — animation shows on batting (opposite) side
        const side = animType === "wicket"
          ? (isUserTeam ? "opp" : "user")
          : (isUserTeam ? "user" : "opp");
        setCricketAnim({ side, type: animType });
        if (Platform.OS !== "web") {
          try {
            if (animType === "wicket") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else if (animType === "six") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          } catch {}
        }
        setTimeout(() => setCricketAnim(null), 2000);
      }
    }
    prevEventsLenRef.current = events.length;
  }, [currentGame?.sport?.events?.length, sport, currentGame?.base?.teamId, teamId]);

  useEffect(() => {
    if (sport !== "Cricket" || !currentGame?.sport || !currentGame?.base) return;

    const cricket = currentGame.sport;
    const homeTeamId = String(currentGame.base.teamId || "");
    const currentInningsIdx = (cricket.currentInnings || 1) - 1;
    const inningsData = cricket.innings?.[currentInningsIdx];
    const battingTeamId = String(
      inningsData?.battingTeamId || cricket.battingTeamId || currentGame.base.teamId || "",
    );
    const battingTeamSide = battingTeamId === homeTeamId ? "home" : "away";
    const battingPlayerIds = new Set(
      (players?.[battingTeamSide] || [])
        .filter((player) => player && player.role !== "manager" && player.role !== "spectator")
        .map((player) => String(player._id || player.id)),
    );

    let validBatsmen = (cricket.currentBatsmen || []).filter(Boolean);
    if ((cricket.currentInnings || 1) >= 2 && validBatsmen.length > 0) {
      validBatsmen = validBatsmen.filter(
        (batter) => batter?.playerId && battingPlayerIds.has(String(batter.playerId)),
      );
    }

    const striker = validBatsmen.find((batter) => batter?.striker);
    const nonStriker = validBatsmen.find((batter) => batter && !batter.striker);
    const hasBowler = !!cricket.currentBowler?.playerId;

    if (striker && nonStriker && hasBowler) {
      stableCricketGameRef.current = currentGame;
    }
  }, [sport, currentGame, players]);

  // Keep a stable snapshot of the last complete game state for any sport
  useEffect(() => {
    if (currentGame?.base && currentGame?.sport) {
      stableGameRef.current = currentGame;
    }
  }, [currentGame]);

  const cricketDisplayGame =
    sport === "Cricket" && isUpdating && stableCricketGameRef.current
      ? stableCricketGameRef.current
      : currentGame;

  // ── Live derived game (Redux): serverState + replayed pendingEvents.
  // Used so the scoreboard, period display, and game-over banner reflect
  // optimistic updates instantly — no waiting for REST poll cycles.
  const selectLiveDerived = useMemo(createDerivedGameSelector, []);
  const liveDerivedGame = useSelector(
    (state) => selectLiveDerived(state, gameId),
    shallowEqual
  );

  const rawRenderGame =
    isUpdating && stableCricketGameRef.current?.base?.sport === "Cricket" &&
    (!currentGame?.base?.sport || currentGame.base.sport !== "Cricket" || !currentGame?.sport)
      ? stableCricketGameRef.current
      : (!currentGame?.sport && stableGameRef.current?.sport)
        ? stableGameRef.current
        : currentGame;
  // Prefer the live derived game once hydrated, but never show stale Redux state
  // when REST/socket polling has moved ahead (e.g. spectators on Stats tab).
  const renderCurrentGame = useMemo(() => {
    const live =
      liveDerivedGame?.sport && liveDerivedGame?.base ? liveDerivedGame : null;
    if (!live) return rawRenderGame;
    return pickFresherGame(live, rawRenderGame);
  }, [liveDerivedGame, rawRenderGame]);
  const renderSport = renderCurrentGame?.base?.sport;

  useEffect(() => {
    if (
      renderSport !== "Cricket" &&
      renderSport !== "Baseball" &&
      renderSport !== "Volleyball" &&
      renderSport !== "Tennis" &&
      renderSport !== "Badminton" &&
      activeTab === "scorecard"
    ) {
      setActiveTab("scoring");
    }
    if (renderSport !== "Football" && activeTab === "lineups") {
      setActiveTab("scoring");
    }
    if (renderSport !== "Tennis" && activeTab === "draw") {
      setActiveTab("scoring");
    }
  }, [activeTab, renderSport]);

  useEffect(() => {
    return () => {
      if (tableTennisTimeoutResumeTimerRef.current) {
        clearTimeout(tableTennisTimeoutResumeTimerRef.current);
        tableTennisTimeoutResumeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!canScore || currentGame?.base?.sport !== "TableTennis") return undefined;

    const activeTimeout = currentGame?.sport?.activeTimeout;
    const endsAtMs = activeTimeout?.endsAt ? new Date(activeTimeout.endsAt).getTime() : 0;
    const isTimeoutActive = !!(activeTimeout?.isActive && endsAtMs > Date.now());
    const timeoutKey = isTimeoutActive ? String(activeTimeout.startedAt || activeTimeout.endsAt) : null;

    if (tableTennisTimeoutResumeTimerRef.current) {
      clearTimeout(tableTennisTimeoutResumeTimerRef.current);
      tableTennisTimeoutResumeTimerRef.current = null;
    }

    if (!isTimeoutActive) {
      tableTennisTimeoutKeyRef.current = null;
      return undefined;
    }

    if (tableTennisTimeoutKeyRef.current !== timeoutKey) {
      tableTennisTimeoutKeyRef.current = timeoutKey;
      setGameTime((prev) => {
        if (!prev.isRunning) return prev;
        const next = { ...prev, isRunning: false };
        syncTimerNow(next);
        return next;
      });
    }

    if (activeTimeout?.wasTimerRunning) {
      tableTennisTimeoutResumeTimerRef.current = setTimeout(() => {
        setGameTime((prev) => {
          if (prev.isRunning) return prev;
          const next = { ...prev, isRunning: true };
          syncTimerNow(next);
          return next;
        });
      }, Math.max(0, endsAtMs - Date.now()));
    }

    return () => {
      if (tableTennisTimeoutResumeTimerRef.current) {
        clearTimeout(tableTennisTimeoutResumeTimerRef.current);
        tableTennisTimeoutResumeTimerRef.current = null;
      }
    };
  }, [
    canScore,
    currentGame?.base?.sport,
    currentGame?.sport?.activeTimeout?.isActive,
    currentGame?.sport?.activeTimeout?.startedAt,
    currentGame?.sport?.activeTimeout?.endsAt,
    currentGame?.sport?.activeTimeout?.wasTimerRunning,
    setGameTime,
    syncTimerNow,
  ]);

  // ── Derived state ──
  const allGameEvents = useMemo(() => sanitizeGameEvents(renderCurrentGame?.sport?.events), [renderCurrentGame?.sport?.events]);
  const status = renderCurrentGame?.base?.status;
  const isLive = status === "live";
  const isScheduled = status === "scheduled";
  const isFinished = gameOver || status === "finished";

  // Freeze and stop top timer as soon as game is finished.
  useEffect(() => {
    if (isFinished && !wasFinishedRef.current) {
      finishedClockRef.current = {
        minutes: Number(gameTime?.minutes) || 0,
        seconds: Number(gameTime?.seconds) || 0,
      };
      setGameTime((prev) => (prev?.isRunning ? { ...prev, isRunning: false } : prev));
    } else if (!isFinished && wasFinishedRef.current) {
      finishedClockRef.current = null;
    }
    wasFinishedRef.current = isFinished;
  }, [isFinished, gameTime?.minutes, gameTime?.seconds, setGameTime]);

  // ── Score helpers ──
  const getIsHomeTeam = () => isHomeTeamForViewer(renderCurrentGame?.base, normalizedTeamId);
  const getUserTeamName = () => getIsHomeTeam() ? teamNames.home : teamNames.away;
  const getOpponentTeamName = () => getIsHomeTeam() ? teamNames.away : teamNames.home;
  const getBadmintonGamesWon = (sportState, isHome) => {
    if (!sportState) return 0;
    if (isHome) return sportState.result?.homeGamesWon ?? sportState.score?.home ?? 0;
    return sportState.result?.awayGamesWon ?? sportState.score?.away ?? 0;
  };
  const getVolleyballCurrentSetScore = (s, isHome) => {
    if (!s) return 0;
    const setNumber = Math.max(1, Number(s.currentSet || 1));
    const setEntry = (s.sets || [])[setNumber - 1] || {};
    return isHome
      ? Number(setEntry.homeScore ?? 0)
      : Number(setEntry.awayScore ?? 0);
  };
  const getUserTeamScore = () => {
    const s = renderCurrentGame?.sport;
    if (!s) return 0;
    if (renderSport === "Volleyball") {
      return getVolleyballCurrentSetScore(s, getIsHomeTeam());
    }
    if (s.score) return getIsHomeTeam() ? s.score.home || 0 : s.score.away || 0;
    if (s.homeScore !== undefined) return getIsHomeTeam() ? s.homeScore : s.awayScore;
    return 0;
  };
  const getOpponentTeamScore = () => {
    const s = renderCurrentGame?.sport;
    if (!s) return 0;
    if (renderSport === "Volleyball") {
      return getVolleyballCurrentSetScore(s, !getIsHomeTeam());
    }
    if (s.score) return getIsHomeTeam() ? s.score.away || 0 : s.score.home || 0;
    if (s.homeScore !== undefined) return getIsHomeTeam() ? s.awayScore : s.homeScore;
    return 0;
  };
  const getPlayerShortName = (playerId) => {
    if (!playerId) return "—";
    const all = [...(players?.home || []), ...(players?.away || [])];
    const p = all.find((pl) => String(pl._id || pl.id) === String(playerId));
      return p
        ? [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown"
        : "Unknown";
  };

  const getSportDetailLine = (side) => {
    const s = renderCurrentGame?.sport;
    if (!s) return null;
    const isHome = side === "user" ? getIsHomeTeam() : !getIsHomeTeam();
    const sideKey = isHome ? "home" : "away";
    if (renderSport === "Volleyball") {
      const wins = (s.sets || []).filter((st) => st.winner).filter(
        (st) => (isHome ? st.homeScore : st.awayScore) > (isHome ? st.awayScore : st.homeScore)
      ).length;
      return `Sets: ${wins}`;
    }
    if (renderSport === "Cricket") return `${s.currentOver || 0}.${s.currentBall || 0} overs`;
    if (renderSport === "Tennis") {
      const setsWon = isHome ? (s.score?.home || 0) : (s.score?.away || 0);
      return `Sets: ${setsWon}`;
    }
    if (renderSport === "Badminton") {
      const gamesWon = getBadmintonGamesWon(s, isHome);
      return `Games: ${gamesWon}`;
    }
    if (renderSport === "TableTennis" || renderSport === "Table Tennis") {
      const gamesWon = (s.gameScores || []).filter((g) => g.winner === (isHome ? "player1" : "player2")).length;
      return `Games: ${gamesWon}`;
    }
    if (renderSport === "Rugby") return `Tries: ${s.detailedScore?.[sideKey]?.tries || 0}`;
    if (renderSport === "Baseball") {
      const half = s.inningHalf || "top";
      const inn = s.currentInning || 1;
      const ord = inn === 1 ? "st" : inn === 2 ? "nd" : inn === 3 ? "rd" : "th";
      return `${half === "top" ? "▲" : "▼"} ${inn}${ord}`;
    }
    return null;
  };

  const getPeriodDisplay = () => {
    const s = renderCurrentGame?.sport;
    if (!s) return "";
    if (renderSport === "Cricket") return `Innings ${s.currentInnings || 1}`;
    if (renderSport === "Volleyball") return `Set ${s.currentSet || 1}`;
    if (renderSport === "Rugby") return `Half ${s.currentHalf || 1}`;
    if (renderSport === "Tennis") return `Set ${s.currentSetNumber || 1}`;
    if (renderSport === "Badminton") return `Game ${s.currentGameNumber || ((s.games || []).length + 1) || 1}`;
    if (renderSport === "TableTennis" || renderSport === "Table Tennis")
      return `Game ${(s.gameScores || []).length + 1}`;
    if (renderSport === "Basketball") { const q = s.currentQuarter || 1; return q > 4 ? `OT${q - 4}` : `Q${q}`; }
    if (renderSport === "Football") {
      const period = s.currentHalf || s.currentPeriod || 1;
      if (period === 1) return "1st Half";
      if (period === 2) return "2nd Half";
      if (period === 3) return "ET 1st";
      if (period === 4 && s.matchStatus === "penalties") return "Penalties";
      if (period === 4) return "ET 2nd";
      return "Football";
    }
    if (renderSport === "Hockey") {
      const currentPeriod = s.currentQuarter || s.currentPeriod || 1;
      const structureType = s.matchFormat?.structureType === "halves" ? "halves" : "quarters";
      return structureType === "halves" ? `H${currentPeriod}` : `Q${currentPeriod}`;
    }
    if (renderSport === "IceHockey") { const cp = s.currentPeriod || 1; return s.isShootout ? "SO" : s.isOvertime ? "OT" : `P${cp}`; }
    if (renderSport === "Baseball") { const half = s.inningHalf || "top"; return `${half === "top" ? "▲" : "▼"} Inning ${s.currentInning || 1}`; }
    return "";
  };

  const getLiveClockDisplay = () => {
    const frozenClock = isFinished ? finishedClockRef.current : null;
    const displayMinutes = frozenClock ? frozenClock.minutes : Number(gameTime?.minutes) || 0;
    const displaySeconds = frozenClock ? frozenClock.seconds : Number(gameTime?.seconds) || 0;

    if (renderSport !== "Football") {
      return `${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;
    }

    const sportData = renderCurrentGame?.sport || {};
    const currentPeriod = sportData.currentHalf || sportData.currentPeriod || 1;
    const liveMinute = displayMinutes ?? sportData.currentMinute ?? 0;
    const liveSecond = displaySeconds ?? sportData.currentSecond ?? 0;
    const announcedAddedTime = sportData.addedTime || 0;
    const baseMinuteMap = { 1: 45, 2: 90, 3: 105, 4: 120 };
    const baseMinute = baseMinuteMap[currentPeriod] || liveMinute;
    const currentAddedTime = Math.max(0, liveMinute - baseMinute);
    const clockValue = `${currentAddedTime > 0 ? `${baseMinute}+${currentAddedTime}` : String(liveMinute)}:${String(liveSecond || 0).padStart(2, "0")}`;

    return announcedAddedTime > 0 ? `${clockValue} | Added: +${announcedAddedTime}` : clockValue;
  };

  const basketballCurrentGameClock = `${String(gameTime.minutes || 0).padStart(2, "0")}:${String(gameTime.seconds || 0).padStart(2, "0")}`;

  const basketballPossessionLabel = useMemo(() => {
    if (renderSport !== "Basketball") return null;
    const possessionSide = renderCurrentGame?.sport?.possession === "away" ? "away" : "home";
    return possessionSide === "home" ? teamNames.home : teamNames.away;
  }, [renderCurrentGame?.sport?.possession, renderSport, teamNames.away, teamNames.home]);

  // ══════════════ RENDER HELPERS ══════════════

  const renderGameHeader = (emoji, rightContent) => (
    <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: scoringT.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
            backgroundColor: isLive ? "rgba(34,197,94,0.15)" : gameOver ? "rgba(168,85,247,0.15)" : scoringT.warningBg,
            borderWidth: 1,
            borderColor: isLive ? "rgba(34,197,94,0.3)" : gameOver ? "rgba(168,85,247,0.3)" : scoringT.warningBorder,
          }}>
            <Text style={{ fontSize: 9, fontWeight: "700", color: isLive ? "#16A34A" : gameOver ? "#7E22CE" : scoringT.warning }}>
              {isLive ? "🔴 LIVE" : gameOver ? "🏁 FINISHED" : "⏳ SCHEDULED"}
            </Text>
          </View>
          {sport !== "Chess" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: scoringT.cardElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Ionicons name="time-outline" size={12} color={scoringT.textMuted} />
            <Text style={{ color: scoringT.text, fontSize: 11, fontVariant: ["tabular-nums"] }}>
              {getLiveClockDisplay()}
            </Text>
          </View>
          )}
          <TouchableOpacity
            onPress={() => {
              setVoiceEnabled((v) => {
                const next = !v;
                if (!next) stopCommentary();
                return next;
              });
            }}
            style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: voiceEnabled ? "rgba(250,204,21,0.15)" : scoringT.cardElevated }}
          >
            <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={14} color={voiceEnabled ? "#CA8A04" : scoringT.textMuted} />
          </TouchableOpacity>
          {voiceEnabled && canScore ? (
            <>
              <TouchableOpacity
                onPress={() => setCommentaryMode((m) => (m === "broadcast" ? "simple" : "broadcast"))}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: commentaryMode === "simple" ? "rgba(52,211,153,0.15)" : scoringT.cardElevated,
                  borderWidth: 1,
                  borderColor: commentaryMode === "simple" ? "rgba(52,211,153,0.35)" : scoringT.border,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: commentaryMode === "simple" ? "#059669" : scoringT.textDim }}>
                  {commentaryMode === "simple" ? "Simple" : "Pro"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setCommentaryLanguage((lang) => {
                    if (lang === "en") return "hi";
                    if (lang === "hi") return "hinglish";
                    return "en";
                  });
                }}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: commentaryLanguage !== "en" ? "rgba(167,139,250,0.15)" : scoringT.cardElevated,
                  borderWidth: 1,
                  borderColor: commentaryLanguage !== "en" ? "rgba(167,139,250,0.35)" : scoringT.border,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: commentaryLanguage !== "en" ? "#7C3AED" : scoringT.textDim }}>
                  {commentaryLanguage === "hi" ? "हिं" : commentaryLanguage === "hinglish" ? "Hing" : "EN"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
        {rightContent || null}
      </View>
    </View>
  );

  const renderCricketScoreboard = () => {
    const cricketGame =
      renderSport === "Cricket" && renderCurrentGame
        ? reconcileCricketTotalsFromEvents(renderCurrentGame)
        : renderCurrentGame;
    const s = cricketGame?.sport;
    if (!s) return null;
    const homeTeamId = String(renderCurrentGame?.base?.teamId || "");
    const isHome = String(renderCurrentGame?.base?.teamId || "") === normalizedTeamId;
    const userTeamName = isHome ? teamNames.home : teamNames.away;
    const oppTeamName = isHome ? teamNames.away : teamNames.home;
    const innings = s.innings || [];
    const currentInnings = s.currentInnings || 1;
    const totalOvers = s.totalOvers || 20;
    let userRuns = 0, userWickets = 0, userOvers = "0";
    let oppRuns = 0, oppWickets = 0, oppOvers = "0";
    innings.forEach((inn) => {
      const isBattingUser = isHome ? String(inn.battingTeamId) === homeTeamId : String(inn.battingTeamId) !== homeTeamId;
      const ref = isBattingUser ? { r: "userRuns", w: "userWickets", o: "userOvers" } : { r: "oppRuns", w: "oppWickets", o: "oppOvers" };
      if (isBattingUser) {
        userRuns += inn.total_runs || 0;
        userWickets += inn.wickets || 0;
        const oc = inn.overs_completed || 0, bc = (inn.balls_completed || 0) % 6;
        userOvers = bc > 0 ? `${oc}.${bc}` : `${oc}`;
      } else {
        oppRuns += inn.total_runs || 0;
        oppWickets += inn.wickets || 0;
        const oc = inn.overs_completed || 0, bc = (inn.balls_completed || 0) % 6;
        oppOvers = bc > 0 ? `${oc}.${bc}` : `${oc}`;
      }
    });
    const isSecondInnings = currentInnings >= 2;
    const target = isSecondInnings && innings[0] ? (innings[0].total_runs || 0) + 1 : null;
    const formatLabel = getCricketMatchFormatLabel(totalOvers);
    const cricketResult = getCricketMatchResult(cricketGame);
    const cricketScore3DStyle = {
      color: scoringT.text,
      fontWeight: "900",
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -1,
    };
    const renderCricket3DScore = (score) => (
      <View style={{ width: "100%", height: 44, justifyContent: "center", alignItems: "center" }}>
        <Text
          style={{
            ...cricketScore3DStyle,
            textAlign: "center",
            textShadowColor: scoringT.isDark
              ? "#475569"
              : "#94A3B8",
            textShadowOffset: { width: 0, height: 4 },
            textShadowRadius: 0,
          }}
        >
          {score}
        </Text>
      </View>
    );
    return (
      <View
        style={{
          backgroundColor: scoringT.card,
          borderRadius: 18,
          marginHorizontal: 10,
          marginVertical: 10,
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: scoringT.isDark ? scoringT.border : "#CBD5E1",
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: scoringT.isDark ? 0.22 : 0.1,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: scoringT.isDark ? "transparent" : "#F8FAFC",
              borderWidth: scoringT.isDark ? 0 : 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>{userTeamName}</Text>
            <View style={{ height: 44, justifyContent: "center", alignItems: "center" }}>
              {cricketAnim?.side === "user" ? (
                <LottieView
                  source={
                    cricketAnim.type === "six" ? require("../app/animations/cricket-six.json")
                    : cricketAnim.type === "wicket" ? require("../app/animations/cricket-out.json")
                    : require("../app/animations/cricket-four.json")
                  }
                  autoPlay
                  loop={false}
                  style={{ width: 80, height: 44 }}
                />
              ) : (
                renderCricket3DScore(`${userRuns}/${userWickets}`)
              )}
            </View>
            <Text style={{ color: scoringT.warning, fontSize: 11, fontWeight: "700", marginTop: 4 }}>({userOvers}/{totalOvers} ov)</Text>
          </View>
          <View style={{ alignItems: "center", paddingHorizontal: 10 }}>
            <Image
              source={require("../assets/images/cricket.png")}
              style={{ width: 54, height: 54, marginBottom: 4 }}
              resizeMode="contain"
            />
            <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Cricket</Text>
            <Text style={{ color: scoringT.textMuted, fontSize: 10, marginBottom: 8 }}>{formatLabel} · Innings {currentInnings}</Text>
            {isScheduled && canScore && (
              <TouchableOpacity onPress={handleStartGame} disabled={isUpdating} style={{ backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isUpdating ? 0.5 : 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>▶ Start Match</Text>
              </TouchableOpacity>
            )}
            {isLive && canScore && !gameOver && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity onPress={handlePauseResume} style={{ backgroundColor: "#eab308", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={14} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("End Game", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "End Game", style: "destructive", onPress: doEndGame }])} disabled={isEndingGame} style={{ backgroundColor: "rgba(239,68,68,0.8)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, opacity: isEndingGame ? 0.6 : 1 }}>
                  {isEndingGame ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>■ End</Text>}
                </TouchableOpacity>
              </View>
            )}
            {!canScore && isScheduled && (
              <Text style={{ color: scoringT.textMuted, fontSize: 10 }}>
                {viewOnly ? "👀 View only" : currentGame?.base?.tournamentId ? "⏳ Waiting for tournament official" : "⏳ Waiting for coach"}
              </Text>
            )}
          </View>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: scoringT.isDark ? "transparent" : "#F8FAFC",
              borderWidth: scoringT.isDark ? 0 : 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>{oppTeamName}</Text>
            <View style={{ height: 44, justifyContent: "center", alignItems: "center" }}>
              {cricketAnim?.side === "opp" ? (
                <LottieView
                  source={
                    cricketAnim.type === "six" ? require("../app/animations/cricket-six.json")
                    : cricketAnim.type === "wicket" ? require("../app/animations/cricket-out.json")
                    : require("../app/animations/cricket-four.json")
                  }
                  autoPlay
                  loop={false}
                  style={{ width: 80, height: 44 }}
                />
              ) : (
                renderCricket3DScore(`${oppRuns}/${oppWickets}`)
              )}
            </View>
            <Text style={{ color: scoringT.warning, fontSize: 11, fontWeight: "700", marginTop: 4 }}>({oppOvers}/{totalOvers} ov)</Text>
          </View>
        </View>
        {cricketResult?.finished && cricketResult.resultText ? (
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(71,254,183,0.14)", borderWidth: 1, borderColor: "rgba(71,254,183,0.4)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: scoringT.accent, fontWeight: "900", fontSize: 12, textAlign: "center" }}>
                {cricketResult.tie
                  ? cricketResult.resultText
                  : `${cricketResult.winnerSide === "home" ? teamNames.home : teamNames.away} ${cricketResult.resultText}`}
              </Text>
            </View>
          </View>
        ) : (
          isSecondInnings && target ? <Text style={{ textAlign: "center", color: scoringT.warning, fontSize: 12, fontWeight: "800", marginTop: 10 }}>Target: {target}</Text> : null
        )}
      </View>
    );
  };

  const renderScoreboard = (emoji) => {
    if (renderSport === "Cricket") return renderCricketScoreboard();
    if (renderSport === "Hockey" || renderSport === "IceHockey" || renderSport === "Rugby" || renderSport === "TableTennis" || renderSport === "Pickleball" || renderSport === "Football") return null;
    if (renderSport === "Basketball") {
      return (
        <BasketballScoreboardCard
          sport={renderCurrentGame?.sport}
          teamNames={teamNames}
          userSide={userSide}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={canScore}
          isUpdating={isUpdating}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          onEndGame={endGameAlert}
          periodLabel={getPeriodDisplay()}
        />
      );
    }
    if (renderSport === "Baseball") {
      return (
        <BaseballScoreboardCard
          sport={renderCurrentGame?.sport}
          teamNames={teamNames}
          userSide={userSide}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={canScore}
          isUpdating={isUpdating}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          onEndGame={endGameAlert}
          periodLabel={getPeriodDisplay()}
        />
      );
    }
    if (renderSport === "Volleyball") {
      return (
        <VolleyballScoreboardCard
          sport={renderCurrentGame?.sport}
          teamNames={teamNames}
          userSide={userSide}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={canScore}
          isUpdating={isUpdating}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          onEndGame={endGameAlert}
          periodLabel={getPeriodDisplay()}
        />
      );
    }
    if (renderSport === "Tennis") {
      return (
        <TennisScoreboardCard
          sport={renderCurrentGame?.sport}
          teamNames={teamNames}
          userSide={userSide}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={canScore}
          isUpdating={isUpdating}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          onEndGame={endGameAlert}
          periodLabel={getPeriodDisplay()}
        />
      );
    }
    if (renderSport === "Badminton") {
      return (
        <BadmintonScoreboardCard
          sport={renderCurrentGame?.sport}
          teamNames={teamNames}
          userSide={userSide}
          gameTime={gameTime}
          isLive={isLive}
          isScheduled={isScheduled}
          gameOver={gameOver}
          isOwner={canScore}
          isUpdating={isUpdating}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          onEndGame={endGameAlert}
          periodLabel={getPeriodDisplay()}
        />
      );
    }
    const userScore = getUserTeamScore();
    const oppScore = getOpponentTeamScore();
    const userDetail = getSportDetailLine("user");
    const oppDetail = getSportDetailLine("opponent");
    const periodText = getPeriodDisplay();
    const scoreTextStyle =
      renderSport === "Baseball" || renderSport === "Volleyball"
        ? {
            fontFamily: fonts.scoreDisplay,
            color: scoringT.text,
            fontSize: 58,
            lineHeight: 58,
            letterSpacing: 1.5,
            fontVariant: ["tabular-nums"],
          }
        : {
            color: scoringT.text,
            fontWeight: "900",
            fontSize: renderSport === "Basketball" ? 56 : 68,
            lineHeight: renderSport === "Basketball" ? 56 : 52,
            textShadowColor: scoringT.isDark ? "#475569" : "#94A3B8",
            textShadowOffset: { width: 0, height: 3 },
            textShadowRadius: 0,
          };
    return (
      <View style={{
        backgroundColor: scoringT.card,
        borderRadius: 16,
        marginHorizontal: 8,
        marginVertical: 8,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: scoringT.isDark ? scoringT.border : "#CBD5E1",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: scoringT.isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{
            flex: 1,
            alignItems: "center",
            gap: 5,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: scoringT.isDark ? "transparent" : "#F8FAFC",
            borderWidth: scoringT.isDark ? 0 : 1,
            borderColor: "#E2E8F0",
          }}>
            <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>{getUserTeamName()}</Text>
            <Text style={scoreTextStyle}>{userScore}</Text>
            {userDetail && <Text style={{ color: scoringT.muted, fontSize: 11, marginTop: 2 }}>{userDetail}</Text>}
          </View>
          <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</Text>
            <Text style={{ color: scoringT.muted, fontSize: 10, marginBottom: 8, fontWeight: "700" }}>{periodText}</Text>

            {isScheduled && canScore && (
              <TouchableOpacity onPress={handleStartGame} disabled={isUpdating} style={{ backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: isUpdating ? 0.5 : 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>▶ Start</Text>
              </TouchableOpacity>
            )}
            {isLive && canScore && !gameOver && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity onPress={handlePauseResume} style={{ backgroundColor: scoringT.warningBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: scoringT.warningBorder }}>
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={14} color={scoringT.warningStrong} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("End Game", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "End Game", style: "destructive", onPress: doEndGame }])} disabled={isEndingGame} style={{ backgroundColor: scoringT.isDark ? "rgba(239,68,68,0.8)" : scoringT.dangerBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, opacity: isEndingGame ? 0.6 : 1, borderWidth: 1, borderColor: scoringT.isDark ? "transparent" : "#FECACA" }}>
                  {isEndingGame ? <ActivityIndicator size="small" color={scoringT.dangerText} /> : <Text style={{ color: scoringT.isDark ? "#fff" : scoringT.dangerText, fontWeight: "700", fontSize: 11 }}>■ End</Text>}
                </TouchableOpacity>
              </View>
            )}
            {!canScore && isScheduled && <Text style={{ color: scoringT.muted, fontSize: 10 }}>⏳ Waiting</Text>}
          </View>
          <View style={{
            flex: 1,
            alignItems: "center",
            gap: 5,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: scoringT.isDark ? "transparent" : "#F8FAFC",
            borderWidth: scoringT.isDark ? 0 : 1,
            borderColor: "#E2E8F0",
          }}>
            <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>{getOpponentTeamName()}</Text>
            <Text style={scoreTextStyle}>{oppScore}</Text>
            {oppDetail && <Text style={{ color: scoringT.muted, fontSize: 11, marginTop: 2 }}>{oppDetail}</Text>}
          </View>
        </View>
      </View>
    );
  };

  const renderGameOverBanner = () => {
    if (!gameOver) return null;

    if (sport === "Chess") {
      const gr = currentGame?.sport?.gameResult;
      const resultText = formatChessResultLabel(gr, teamNames.home, teamNames.away)
        || (() => {
          const w = currentGame?.base?.result?.winner;
          if (w === "home" || String(w) === String(currentGame?.base?.teamId)) return `${teamNames.home} wins`;
          if (w === "away" || String(w) === String(currentGame?.base?.opponentTeamId)) return `${teamNames.away} wins`;
          return "Draw";
        })();
      return (
        <View style={{ marginHorizontal: 8, marginTop: 4, gap: 8 }}>
          <View style={{ backgroundColor: scoringT.isDark ? "rgba(239,68,68,0.08)" : "#FEE2E2", borderWidth: 1, borderColor: scoringT.isDark ? "rgba(239,68,68,0.25)" : "#FCA5A5", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Text style={{ fontSize: 20 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: scoringT.text, fontWeight: "800", fontSize: 14 }}>Game Ended</Text>
              <Text style={{ color: scoringT.muted, fontSize: 11, marginTop: 2 }}>{resultText}</Text>
            </View>
          </View>
        </View>
      );
    }

    let uScore, oScore;
    if (sport === "Pickleball") {
      const s = currentGame?.sport;
      const isHome = getIsHomeTeam();
      const gScores = s?.gameScores || [];
      if (gScores.length > 0) {
        uScore = isHome ? (s?.score?.home || 0) : (s?.score?.away || 0);
        oScore = isHome ? (s?.score?.away || 0) : (s?.score?.home || 0);
      } else {
        const p1 = s?.currentPointScore?.player1 || 0;
        const p2 = s?.currentPointScore?.player2 || 0;
        uScore = isHome ? p1 : p2;
        oScore = isHome ? p2 : p1;
      }
    } else {
      uScore = getUserTeamScore();
      oScore = getOpponentTeamScore();
    }
    const winnerName = uScore > oScore ? getUserTeamName() : oScore > uScore ? getOpponentTeamName() : null;
    return (
      <View style={{ marginHorizontal: 8, marginTop: 4, gap: 8 }}>
        <View style={{ backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Text style={{ fontSize: 20 }}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Game Ended</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>
              {winnerName ? `${getUserTeamName()} ${uScore} - ${oScore} ${getOpponentTeamName()} | ${winnerName} won!` : `Draw: ${uScore} - ${oScore}`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderOfflineBadge = () => {
    // Syncing: connection restored, drain in progress
    if (isOnline && syncingLabel) {
      return (
        <View style={{ position: "absolute", top: 8, right: 12, backgroundColor: "#16a34a", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5, zIndex: 100 }}>
          <Ionicons name="sync-outline" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
            Syncing: {syncingLabel}
          </Text>
        </View>
      );
    }
    // Offline with queued items waiting
    if (!isOnline && offlineQueue.length > 0) {
      return (
        <View style={{ position: "absolute", top: 8, right: 12, backgroundColor: "#EF4444", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5, zIndex: 100 }}>
          <Ionicons name="cloud-offline-outline" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{offlineQueue.length} queued</Text>
        </View>
      );
    }
    // Online but items still waiting to retry (re-queued after failures)
    if (isOnline && offlineQueue.length > 0 && !syncingLabel) {
      return (
        <View style={{ position: "absolute", top: 8, right: 12, backgroundColor: "#f97316", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5, zIndex: 100 }}>
          <Ionicons name="warning-outline" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{offlineQueue.length} pending retry</Text>
        </View>
      );
    }
    return null;
  };

  const renderTabBar = () => {
    const isCricket = sport === "Cricket";
    const isBaseball = sport === "Baseball";
    const isVolleyball = sport === "Volleyball";
    const isTennis = sport === "Tennis";
    const isBadminton = sport === "Badminton";
    const isFootball = sport === "Football";
    const tennisTournamentId = currentGame?.base?.tournamentId;

    const tabs = isTennis
      ? [
          { key: "scoring", icon: "flash", label: "Scoring" },
          { key: "scorecard", icon: "list", label: "Scorecard" },
          ...(tennisTournamentId
            ? [{ key: "draw", icon: "git-network-outline", label: "Draw" }]
            : []),
          { key: "events", icon: "pulse", label: "Events" },
          { key: "replay", icon: "time-outline", label: "Replay" },
          { key: "players", icon: "people", label: "Players" },
        ]
      : isBadminton
        ? [
            { key: "scoring", icon: "flash", label: "Scoring" },
            { key: "scorecard", icon: "list", label: "Scorecard" },
            { key: "stats", icon: "bar-chart", label: "Stats" },
            { key: "events", icon: "pulse", label: "Events" },
            { key: "replay", icon: "time-outline", label: "Replay" },
            { key: "players", icon: "people", label: "Players" },
          ]
      : [
          { key: "scoring", icon: "flash", label: "Scoring" },
          ...(isCricket || isBaseball || isVolleyball
            ? [{ key: "scorecard", icon: "list", label: "Scorecard" }]
            : []),
          ...(isFootball ? [{ key: "lineups", icon: "football", label: "Lineups" }] : []),
          { key: "stats", icon: "bar-chart", label: "Stats" },
          { key: "events", icon: "pulse", label: "Events" },
          { key: "replay", icon: "time-outline", label: "Replay" },
          { key: "players", icon: "people", label: "Players" },
        ];

    return (
      <CurvedBottomTabBar
        tabs={tabs}
        activeKey={activeTab}
        onChange={handleTabChange}
        isDark={scoringT.isDark}
        panelColor={scoringT.panel}
      />
    );
  };

  const renderEventsTab = () => {
    const homeId = String(currentGame?.base?.teamId || "");
    const isHome = isHomeTeamForViewer(currentGame?.base, normalizedTeamId);
    const allEvents = allGameEvents.slice().reverse();
    const visible = allEvents.slice(0, eventsPageSize);
    return (
      <FlatList
        data={visible}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        style={{ flex: 1, backgroundColor: scoringT.panel }}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={15}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
        windowSize={5}
        ListHeaderComponent={<Text style={{ color: scoringT.muted, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Game Events ({allEvents.length})</Text>}
        ListEmptyComponent={<View style={{ alignItems: "center", paddingVertical: 40 }}><Ionicons name="document-text-outline" size={40} color={scoringT.textMuted} /><Text style={{ color: scoringT.muted, marginTop: 8, fontSize: 13 }}>No events yet</Text></View>}
        ListFooterComponent={allEvents.length > eventsPageSize ? (
          <TouchableOpacity onPress={() => setEventsPageSize((p) => p + 30)} style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: scoringT.accent, fontWeight: "700", fontSize: 13 }}>Load more ({allEvents.length - eventsPageSize} remaining)</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: e }) => {
          if (!e) return null;
          const eIsHome = String(e.teamId) === homeId;
          const eIsUser = isHome ? eIsHome : !eIsHome;
          return (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              marginBottom: 6,
              backgroundColor: eIsUser
                ? (scoringT.isDark ? "rgba(34,197,94,0.06)" : "#F0FDF4")
                : (scoringT.isDark ? "rgba(239,68,68,0.06)" : scoringT.dangerBg),
              borderWidth: 1,
              borderColor: eIsUser
                ? (scoringT.isDark ? "rgba(34,197,94,0.15)" : "#BBF7D0")
                : (scoringT.isDark ? "rgba(239,68,68,0.15)" : "#FECACA"),
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: eIsUser ? (scoringT.isDark ? "#4ade80" : "#16A34A") : scoringT.dangerText }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: scoringT.text, fontWeight: "700", fontSize: 12, textTransform: "capitalize" }}>{(e.eventType || "event").replace(/_/g, " ")}</Text>
                <Text style={{ color: scoringT.muted, fontSize: 10, marginTop: 2 }}>{(() => { const pid = String(e?.playerId || ""); const tn = e.teamName || (eIsUser ? teamNames.home : teamNames.away); if (!pid || pid.startsWith("team_")) return tn; const name = getPlayerShortName(pid); return name === "Unknown" ? tn : `${name} · ${tn}`; })()}</Text>
              </View>
              {e.gameTime && <Text style={{ color: scoringT.textMuted, fontSize: 10, fontVariant: ["tabular-nums"] }}>{e.gameTime}</Text>}
            </View>
          );
        }}
      />
    );
  };

  const renderStatsTab = () => {
    const currentGame = renderCurrentGame;
    const homeId = String(currentGame?.base?.teamId || "");
    const isHome = isHomeTeamForViewer(currentGame?.base, normalizedTeamId);
    const userTeamName = isHome ? teamNames.home : teamNames.away;
    const opponentTeamName = isHome ? teamNames.away : teamNames.home;
    const userSide = isHome ? "home" : "away";
    const opponentSide = isHome ? "away" : "home";
    if (sport === "Cricket") {
      return (
        <CricketMatchComparisonStatsPanel
          sport={currentGame?.sport}
          homeTeamId={currentGame?.base?.teamId}
          awayTeamId={currentGame?.base?.opponentTeamId}
        />
      );
    }
    if (sport === "Football") {
      return (
        <FootballMatchComparisonStatsPanel
          sport={currentGame?.sport}
          homeTeamId={currentGame?.base?.teamId}
        />
      );
    }
    if (sport === "Basketball") {
      return (
        <BasketballMatchStats
          events={allGameEvents}
          homeTeamId={currentGame?.base?.teamId}
          teamNames={teamNames}
          userSide={userSide}
          currentQuarter={currentGame?.sport?.currentQuarter || 1}
        />
      );
    }
    if (sport === "Pickleball") {
      const sp = currentGame?.sport || {};
      const playerStats = sp.playerStats || [];
      const homeTeamId = String(currentGame?.base?.teamId || "");
      const sumStat = (side, key) => playerStats
        .filter(ps => ps && (side === "home" ? String(ps.teamId) === homeTeamId : String(ps.teamId) !== homeTeamId))
        .reduce((acc, ps) => acc + (ps[key] || 0), 0);
      const gameScores = sp.gameScores || [];
      const uSide = isHome ? "home" : "away";
      const oSide = isHome ? "away" : "home";
      const p1Pts = sp.currentPointScore?.player1 || 0;
      const p2Pts = sp.currentPointScore?.player2 || 0;
      const uCurrentPts = isHome ? p1Pts : p2Pts;
      const oCurrentPts = isHome ? p2Pts : p1Pts;
      const userAccent = scoringT.isDark ? "#47feb7" : "#059669";
      const oppAccent = scoringT.isDark ? "#f87171" : "#DC2626";
      const rowCardBg = scoringT.isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF";
      const rowCardBorder = scoringT.isDark ? "rgba(255,255,255,0.07)" : "#E5E7EB";
      const barTrack = scoringT.isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
      const liveCardBg = scoringT.isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";
      const liveCardBorder = scoringT.isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1";
      const liveScoreColor = scoringT.isDark ? "#dfe1f9" : scoringT.text;
      const rows = [
        { label: "Points Won", u: sumStat(uSide, "totalPointsWon"), o: sumStat(oSide, "totalPointsWon"), icon: "trophy-outline", color: scoringT.isDark ? "#47feb7" : "#059669" },
        { label: "Points Lost", u: sumStat(uSide, "totalPointsLost"), o: sumStat(oSide, "totalPointsLost"), icon: "close-circle-outline", color: scoringT.isDark ? "#f87171" : "#DC2626" },
        { label: "Winners", u: sumStat(uSide, "winners"), o: sumStat(oSide, "winners"), icon: "ribbon-outline", color: scoringT.isDark ? "#a78bfa" : "#6D28D9" },
        { label: "Unforced Err", u: sumStat(uSide, "unforcedErrors"), o: sumStat(oSide, "unforcedErrors"), icon: "warning-outline", color: scoringT.isDark ? "#fb923c" : "#C2410C" },
        { label: "Forced Err", u: sumStat(uSide, "forcedErrors"), o: sumStat(oSide, "forcedErrors"), icon: "flash-outline", color: scoringT.isDark ? "#fbbf24" : "#B45309" },
        { label: "Serve Errors", u: sumStat(uSide, "serveErrors"), o: sumStat(oSide, "serveErrors"), icon: "alert-circle-outline", color: scoringT.isDark ? "#f43f5e" : "#BE123C" },
        { label: "Volleys", u: sumStat(uSide, "volleys"), o: sumStat(oSide, "volleys"), icon: "swap-horizontal-outline", color: scoringT.isDark ? "#38bdf8" : "#0369A1" },
        { label: "Dinks", u: sumStat(uSide, "dinks"), o: sumStat(oSide, "dinks"), icon: "radio-button-on-outline", color: scoringT.isDark ? "#34d399" : "#047857" },
        { label: "Smashes", u: sumStat(uSide, "smashes"), o: sumStat(oSide, "smashes"), icon: "arrow-down-outline", color: scoringT.isDark ? "#c084fc" : "#7C3AED" },
        { label: "Lobs", u: sumStat(uSide, "lobs"), o: sumStat(oSide, "lobs"), icon: "arrow-up-outline", color: scoringT.isDark ? "#60a5fa" : "#1D4ED8" },
      ].filter(r => r.u + r.o > 0);
      const StatBar = ({ u, o, color }) => {
        const total = u + o || 1;
        return (
          <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: barTrack, marginTop: 6 }}>
            <View style={{ width: `${(u / total) * 100}%`, backgroundColor: color, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
            <View style={{ width: `${(o / total) * 100}%`, backgroundColor: oppAccent, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
          </View>
        );
      };
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: scoringT.muted, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Match Stats</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14, paddingHorizontal: 2 }}>
            <Text style={{ color: userAccent, fontWeight: "900", fontSize: 13, maxWidth: "40%" }} numberOfLines={1}>{userTeamName}</Text>
            <Text style={{ color: scoringT.textMuted, fontWeight: "700", fontSize: 11 }}>VS</Text>
            <Text style={{ color: oppAccent, fontWeight: "900", fontSize: 13, maxWidth: "40%", textAlign: "right" }} numberOfLines={1}>{opponentTeamName}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {gameScores.map((g, i) => {
              const uPts = isHome ? g.player1Points : g.player2Points;
              const oPts = isHome ? g.player2Points : g.player1Points;
              const won = uPts > oPts;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: won
                      ? (scoringT.isDark ? "rgba(71,254,183,0.1)" : "#DCFCE7")
                      : (scoringT.isDark ? "rgba(239,68,68,0.08)" : "#FEE2E2"),
                    borderRadius: 10,
                    padding: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: won
                      ? (scoringT.isDark ? "rgba(71,254,183,0.25)" : "#86EFAC")
                      : (scoringT.isDark ? "rgba(239,68,68,0.2)" : "#FCA5A5"),
                  }}
                >
                  <Text style={{ fontSize: 9, color: scoringT.textMuted, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>G{i + 1}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: won ? userAccent : oppAccent, marginTop: 2 }}>{uPts}–{oPts}</Text>
                  <Text style={{ fontSize: 8, color: won ? userAccent : oppAccent, fontWeight: "700" }}>{won ? "WIN" : "LOSS"}</Text>
                </View>
              );
            })}
            <View
              style={{
                flex: 1,
                backgroundColor: liveCardBg,
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
                borderWidth: 1,
                borderColor: liveCardBorder,
              }}
            >
              <Text style={{ fontSize: 9, color: scoringT.textMuted, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>Live</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: liveScoreColor, marginTop: 2 }}>{uCurrentPts}–{oCurrentPts}</Text>
              <Text style={{ fontSize: 8, color: scoringT.textMuted, fontWeight: "700" }}>G{sp.currentGame || 1}</Text>
            </View>
          </View>
          {rows.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 40,
                borderRadius: 14,
                backgroundColor: scoringT.isDark ? "transparent" : scoringT.card,
                borderWidth: scoringT.isDark ? 0 : 1,
                borderColor: scoringT.border,
              }}
            >
              <Ionicons name="stats-chart-outline" size={40} color={scoringT.textMuted} />
              <Text style={{ color: scoringT.muted, marginTop: 8, fontSize: 13 }}>No stats yet — start scoring</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map(({ label, u, o, icon, color }) => (
                <View
                  key={label}
                  style={{
                    backgroundColor: rowCardBg,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: rowCardBorder,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: scoringT.isDark ? 0 : 0.06,
                    shadowRadius: 3,
                    elevation: scoringT.isDark ? 0 : 2,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: u >= o ? color : scoringT.text, fontWeight: "900", fontSize: 16, minWidth: 36 }}>{u}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name={icon} size={12} color={color} />
                      <Text style={{ color: scoringT.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
                    </View>
                    <Text style={{ color: o > u ? oppAccent : scoringT.text, fontWeight: "900", fontSize: 16, minWidth: 36, textAlign: "right" }}>{o}</Text>
                  </View>
                  <StatBar u={u} o={o} color={color} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      );
    }
    if (sport === "Badminton") {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <BadmintonStatsMobile
            currentGame={renderCurrentGame}
            teamNames={teamNames}
            userSide={userSide}
          />
        </ScrollView>
      );
    }
    const statMap = {};
    allGameEvents.forEach((e) => {
      if (!e?.eventType) return;
      const side = String(e.teamId) === homeId ? "home" : "away";
      if (!statMap[e.eventType]) statMap[e.eventType] = { home: 0, away: 0 };
      statMap[e.eventType][side]++;
    });
    const entries = Object.entries(statMap).sort((a, b) => b[1].home + b[1].away - (a[1].home + a[1].away));
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#9CA3AF", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Team Stats Comparison</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 12 }}>{userTeamName}</Text>
          <Text style={{ color: "#f87171", fontWeight: "800", fontSize: 12 }}>{opponentTeamName}</Text>
        </View>
        {entries.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}><Ionicons name="stats-chart-outline" size={40} color="#4B5563" /><Text style={{ color: "#6B7280", marginTop: 8, fontSize: 13 }}>No stats yet</Text></View>
        ) : (
          <View style={{ gap: 10 }}>
            {entries.map(([type, vals]) => {
              const uVal = vals[userSide] || 0, oVal = vals[opponentSide] || 0, total = uVal + oVal || 1;
              return (
                <View key={type}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 13 }}>{uVal}</Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</Text>
                    <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 13 }}>{oVal}</Text>
                  </View>
                  <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <View style={{ width: `${(uVal / total) * 100}%`, backgroundColor: "rgba(34,197,94,0.6)", borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
                    <View style={{ width: `${(oVal / total) * 100}%`, backgroundColor: "rgba(239,68,68,0.6)", borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const computePlayerBasketballStats = (pid) => {
    const events = allGameEvents.filter((e) => e && String(e.playerId) === pid);
    const count = (type) => events.filter((e) => e.eventType === type).length;
    const fg2m = count("point_2"), fg3m = count("point_3"), ftm = count("free_throw");
    return {
      points: fg2m * 2 + fg3m * 3 + ftm,
      fg2m, fg2a: fg2m + count("point_2_miss"),
      fg3m, fg3a: fg3m + count("point_3_miss"),
      ftm, fta: ftm + count("free_throw_miss"),
      rebounds: count("rebound"), assists: count("assist"),
      steals: count("steal"), blocks: count("block"),
      turnovers: count("turnover"), fouls: count("foul"),
      total: events.length,
    };
  };

  const computePlayerGenericStats = (pid) => {
    const events = allGameEvents.filter((e) => e && String(e.playerId) === pid);
    const byType = {};
    events.forEach((e) => { const t = e.eventType || "event"; byType[t] = (byType[t] || 0) + 1; });
    return { total: events.length, byType };
  };

  const renderPlayerStatsModal = () => {
    if (!selectedPlayerForStats) return null;
    const { player, teamLabel, teamColor } = selectedPlayerForStats;
    const pid = String(player._id || player.id);
    const isBasketball = sport === "Basketball";
    const stats = isBasketball ? computePlayerBasketballStats(pid) : computePlayerGenericStats(pid);
    const pct = (m, a) => (a > 0 ? Math.round((m / a) * 100) + "%" : "—");
    const initials = [(player.firstName || "")[0], (player.lastName || "")[0]].filter(Boolean).join("").toUpperCase() || "?";
    const StatCard = ({ value, label, accent }) => (
      <View style={{ flex: 1, backgroundColor: scoringT.card, borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: scoringT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: scoringT.isDark ? 0.2 : 0.08, shadowRadius: 6, elevation: 3 }}>
        <Text style={{ color: accent, fontSize: 24, fontWeight: "900" }}>{value}</Text>
        <Text style={{ color: scoringT.textDim, fontSize: 10, fontWeight: "700", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      </View>
    );
    const ShootingCol = ({ made, att, label }) => (
      <View style={{ alignItems: "center", flex: 1, paddingVertical: 8 }}>
        <Text style={{ color: scoringT.text, fontSize: 16, fontWeight: "800" }}>{made}/{att}</Text>
        <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "700", marginTop: 2 }}>{pct(made, att)}</Text>
        <Text style={{ color: scoringT.textDim, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      </View>
    );
    return (
      <Modal visible animationType="slide" transparent onRequestClose={() => setSelectedPlayerForStats(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: scoringT.panel, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "90%", shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 }}>
            <View style={{ alignItems: "center", paddingTop: 14 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: scoringT.border }} /></View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
              <Text style={{ color: scoringT.textDim, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2 }}>Player Stats</Text>
              <TouchableOpacity onPress={() => setSelectedPlayerForStats(null)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: scoringT.cardElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: scoringT.border }}>
                <Ionicons name="close" size={17} color={scoringT.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 44 }}>
              <View style={{ backgroundColor: scoringT.card, borderRadius: 20, padding: 20, marginBottom: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: scoringT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: scoringT.isDark ? 0.2 : 0.08, shadowRadius: 10, elevation: 4 }}>
                {(player.profilePicture || player.playerimage) ? (
                  <ExpoImage source={{ uri: player.profilePicture || player.playerimage, width: 72, height: 72 }} style={{ width: 72, height: 72, borderRadius: 36, marginRight: 16 }} contentFit="cover" cachePolicy="memory-disk" decodeFormat="rgb" />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: teamColor + "20", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                    <Text style={{ color: teamColor, fontSize: 24, fontWeight: "900" }}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: scoringT.text, fontSize: 20, fontWeight: "800", lineHeight: 25 }}>{[player.firstName, player.lastName].filter(Boolean).join(" ")}</Text>
                  {player.jerseyNumber && <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}><View style={{ backgroundColor: teamColor + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}><Text style={{ color: teamColor, fontSize: 11, fontWeight: "800" }}>#{player.jerseyNumber}</Text></View>{player.position && <Text style={{ color: scoringT.textDim, fontSize: 12 }}>{player.position}</Text>}</View>}
                  <Text style={{ color: scoringT.textMuted, fontSize: 11, marginTop: 4, fontWeight: "600" }}>{teamLabel}</Text>
                </View>
              </View>
              {isBasketball ? (
                <>
                  <View style={{ backgroundColor: scoringT.card, borderRadius: 20, padding: 20, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: scoringT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: scoringT.isDark ? 0.2 : 0.08, shadowRadius: 10, elevation: 4 }}>
                    <Text style={{ color: scoringT.warning, fontSize: 60, fontWeight: "900", lineHeight: 64 }}>{stats.points}</Text>
                    <Text style={{ color: scoringT.textDim, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Points</Text>
                    <View style={{ flexDirection: "row", width: "100%", backgroundColor: scoringT.cardElevated, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: scoringT.border }}>
                      <ShootingCol made={stats.fg2m} att={stats.fg2a} label="2PT" />
                      <View style={{ width: 1, backgroundColor: scoringT.border }} />
                      <ShootingCol made={stats.fg3m} att={stats.fg3a} label="3PT" />
                      <View style={{ width: 1, backgroundColor: scoringT.border }} />
                      <ShootingCol made={stats.ftm} att={stats.fta} label="FT" />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <StatCard value={stats.rebounds} label="Reb" accent="#3b82f6" />
                    <StatCard value={stats.assists} label="Ast" accent="#10b981" />
                    <StatCard value={stats.steals} label="Stl" accent="#8b5cf6" />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <StatCard value={stats.blocks} label="Blk" accent="#f97316" />
                    <StatCard value={stats.turnovers} label="TO" accent="#ef4444" />
                    <StatCard value={stats.fouls} label="Foul" accent="#eab308" />
                  </View>
                </>
              ) : (
                <>
                  <View style={{ backgroundColor: scoringT.card, borderRadius: 20, padding: 20, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: scoringT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: scoringT.isDark ? 0.2 : 0.08, shadowRadius: 10, elevation: 4 }}>
                    <Text style={{ color: teamColor, fontSize: 56, fontWeight: "900", lineHeight: 60 }}>{stats.total}</Text>
                    <Text style={{ color: scoringT.textDim, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Total Events</Text>
                  </View>
                  {Object.keys(stats.byType).length > 0 && (
                    <View style={{ gap: 8 }}>
                      {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, cnt]) => (
                        <View key={type} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: scoringT.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: scoringT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: scoringT.isDark ? 0.18 : 0.06, shadowRadius: 6, elevation: 2 }}>
                          <Text style={{ color: scoringT.text, fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</Text>
                          <View style={{ backgroundColor: teamColor + "20", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}><Text style={{ color: teamColor, fontSize: 14, fontWeight: "800" }}>{cnt}</Text></View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPlayerStatsInline = (player, teamLabel, teamColor) => {
    const pid = String(player._id || player.id);
    const isBasketball = sport === "Basketball";
    const stats = isBasketball ? computePlayerBasketballStats(pid) : computePlayerGenericStats(pid);
    const pct = (m, a) => (a > 0 ? Math.round((m / a) * 100) + "%" : "—");
    return (
      <View style={{ backgroundColor: scoringT.cardElevated, borderRadius: 10, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 12, marginBottom: 4, borderWidth: 1, borderTopWidth: 0, borderColor: scoringT.border }}>
        {isBasketball ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginBottom: 10, gap: 4 }}>
              <Text style={{ color: scoringT.warning, fontSize: 34, fontWeight: "900", lineHeight: 38 }}>{stats.points}</Text>
              <Text style={{ color: scoringT.warningStrong, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>PTS</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: scoringT.card, borderRadius: 10, overflow: "hidden", marginBottom: 10, borderWidth: 1, borderColor: scoringT.border }}>
              {[["2PT", stats.fg2m, stats.fg2a], ["3PT", stats.fg3m, stats.fg3a], ["FT", stats.ftm, stats.fta]].map(([label, made, att], i) => (
                <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: scoringT.border }}>
                  <Text style={{ color: scoringT.text, fontSize: 13, fontWeight: "800" }}>{made}/{att}</Text>
                  <Text style={{ color: "#f59e0b", fontSize: 11, fontWeight: "700" }}>{pct(made, att)}</Text>
                  <Text style={{ color: scoringT.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {[["Reb", stats.rebounds, "#3b82f6"], ["Ast", stats.assists, "#10b981"], ["Stl", stats.steals, "#8b5cf6"], ["Blk", stats.blocks, "#f97316"], ["TO", stats.turnovers, "#ef4444"], ["Foul", stats.fouls, "#eab308"]].map(([label, value, accent]) => (
                <View key={label} style={{ flex: 1, backgroundColor: scoringT.card, borderRadius: 8, paddingVertical: 7, alignItems: "center", borderWidth: 1, borderColor: scoringT.border }}>
                  <Text style={{ color: accent, fontSize: 15, fontWeight: "900" }}>{value}</Text>
                  <Text style={{ color: scoringT.textDim, fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : stats.total > 0 ? (
          <>
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: teamColor, fontSize: 30, fontWeight: "900" }}>{stats.total}</Text>
              <Text style={{ color: scoringT.textDim, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>Total Events</Text>
            </View>
            <View style={{ gap: 5 }}>
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, cnt]) => (
                <View key={type} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: scoringT.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: scoringT.border }}>
                  <Text style={{ color: scoringT.text, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</Text>
                  <View style={{ backgroundColor: teamColor + "25", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 7 }}><Text style={{ color: teamColor, fontSize: 12, fontWeight: "800" }}>{cnt}</Text></View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: scoringT.textDim, fontSize: 12, textAlign: "center", paddingVertical: 6 }}>No events recorded</Text>
        )}
      </View>
    );
  };

  const renderPlayersTab = () => {
    const isHome = isHomeTeamForViewer(currentGame?.base, normalizedTeamId);
    const userPlayers = (isHome ? players.home : players.away) || [];
    const oppPlayers = (isHome ? players.away : players.home) || [];
    const userTeamName = isHome ? teamNames.home : teamNames.away;
    const oppTeamName = isHome ? teamNames.away : teamNames.home;
    const userColor = scoringT.isDark ? "#4ADE80" : "#15803D";
    const opponentColor = scoringT.isDark ? "#F87171" : "#DC2626";
    const renderList = (list, label, color) => (
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{label}</Text>
        {list.filter((p) => p && p.role !== "manager" && p.role !== "spectator").length === 0 ? (
          <View style={{ backgroundColor: scoringT.card, borderWidth: 1, borderColor: scoringT.border, borderRadius: 12, padding: 16 }}>
            <Text style={{ color: scoringT.textDim, fontSize: 12 }}>No players</Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {list.filter((p) => p && p.role !== "manager" && p.role !== "spectator").map((p) => {
              const pid = String(p._id || p.id);
              const isExpanded = expandedPlayerId === pid;
              const bStats = sport === "Basketball" ? computePlayerBasketballStats(pid) : null;
              const genericTotal = bStats ? null : computePlayerGenericStats(pid).total;
              return (
                <View key={pid}>
                  <TouchableOpacity onPress={() => setExpandedPlayerId(isExpanded ? null : pid)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: isExpanded ? scoringT.cardElevated : scoringT.card, borderRadius: 10, borderBottomLeftRadius: isExpanded ? 0 : 10, borderBottomRightRadius: isExpanded ? 0 : 10, borderWidth: 1, borderColor: isExpanded ? color + "66" : scoringT.border, borderBottomWidth: isExpanded ? 0 : 1 }}>
                    {(p.profilePicture || p.playerimage) ? (
                      <ExpoImage source={{ uri: p.profilePicture || p.playerimage, width: 36, height: 36 }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} contentFit="cover" cachePolicy="memory-disk" decodeFormat="rgb" />
                    ) : (
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + "18", borderWidth: 1.5, borderColor: color + "55", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        {p.jerseyNumber ? <Text style={{ color, fontSize: 11, fontWeight: "900" }}>#{p.jerseyNumber}</Text> : <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{(p.firstName || "?")[0]}{(p.lastName || "")[0]}</Text>}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: scoringT.text, fontWeight: "700", fontSize: 14 }}>{[p.firstName, p.lastName].filter(Boolean).join(" ")}</Text>
                      {p.position && <Text style={{ color: scoringT.textDim, fontSize: 11, marginTop: 1 }}>{p.position}</Text>}
                    </View>
                    {bStats ? (
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={{ color: scoringT.warning, fontSize: 15, fontWeight: "900" }}>{bStats.points} <Text style={{ color: scoringT.warningStrong, fontSize: 10, fontWeight: "700" }}>PTS</Text></Text>
                        <Text style={{ color: scoringT.textDim, fontSize: 10 }}>{bStats.rebounds}R · {bStats.assists}A · {bStats.steals}S</Text>
                      </View>
                    ) : genericTotal > 0 ? (
                      <View style={{ backgroundColor: color + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ color, fontSize: 10, fontWeight: "800" }}>{genericTotal} events</Text></View>
                    ) : null}
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={isExpanded ? color : scoringT.iconMuted} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                  {isExpanded && renderPlayerStatsInline(p, label, color)}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {renderList(userPlayers, userTeamName, userColor)}
        {renderList(oppPlayers, oppTeamName, opponentColor)}
      </ScrollView>
    );
  };

  const renderReplayTab = () => {
    const allEvents = allGameEvents.slice().reverse();
    if (allEvents.length === 0) return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, margin: 16, backgroundColor: scoringT.card, borderWidth: 1, borderColor: scoringT.border, borderRadius: 16 }}>
        <Ionicons name="time-outline" size={44} color={scoringT.iconMuted} />
        <Text style={{ color: scoringT.textDim, marginTop: 10, fontSize: 13 }}>No events to replay yet</Text>
      </View>
    );
    const homeId = String(renderCurrentGame?.base?.teamId || "");
    return (
      <FlatList
        data={allEvents}
        keyExtractor={(_, i) => `replay_${i}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={20}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: scoringT.textDim, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>Game Timeline ({allEvents.length} events)</Text>
          </View>
        }
        renderItem={({ item: e, index: i }) => {
          const isHome = String(e.teamId) === homeId;
          const isUserTeam = String(renderCurrentGame?.base?.teamId || "") === normalizedTeamId ? isHome : !isHome;
          return (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 0 }}>
              <View style={{ width: 32, alignItems: "center" }}>
                {i > 0 && <View style={{ width: 2, height: 12, backgroundColor: scoringT.border }} />}
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: isUserTeam ? (scoringT.isDark ? "#9AEA62" : "#16A34A") : "#EF4444", borderWidth: 2, borderColor: isUserTeam ? (scoringT.isDark ? "rgba(154,234,98,0.4)" : "#86EFAC") : (scoringT.isDark ? "rgba(239,68,68,0.4)" : "#FCA5A5") }} />
                {i < allEvents.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: scoringT.border }} />}
              </View>
              <View style={{ flex: 1, marginBottom: 10, backgroundColor: scoringT.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: isUserTeam ? (scoringT.isDark ? "rgba(154,234,98,0.18)" : "#BBF7D0") : (scoringT.isDark ? "rgba(239,68,68,0.18)" : "#FECACA") }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: scoringT.text, fontWeight: "700", fontSize: 12, textTransform: "capitalize" }}>{(e.eventType || "event").replace(/_/g, " ")}</Text>
                  {e.gameTime && <Text style={{ color: scoringT.textMuted, fontSize: 10, fontVariant: ["tabular-nums"] }}>{e.gameTime}</Text>}
                </View>
                <Text style={{ color: scoringT.textDim, fontSize: 11, marginTop: 3 }}>{(() => { const pid = String(e?.playerId || ""); const tn = e.teamName || (isHome ? teamNames.home : teamNames.away); if (!pid || pid.startsWith("team_")) return tn; const name = e.playerName || getPlayerShortName(pid); return (!name || name === "Unknown" || name === "—") ? tn : `${name} · ${tn}`; })()}</Text>
              </View>
            </View>
          );
        }}
      />
    );
  };

  const renderSpectatorCommentaryBar = () => (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.08)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {sport !== "Chess" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Ionicons name="time-outline" size={12} color="#6B7280" />
            <Text style={{ color: "#dfe1f9", fontSize: 11, fontVariant: ["tabular-nums"] }}>
              {getLiveClockDisplay()}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            setVoiceEnabled((v) => {
              const next = !v;
              if (!next) stopCommentary();
              return next;
            });
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: voiceEnabled ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: voiceEnabled ? "rgba(250,204,21,0.35)" : "rgba(255,255,255,0.08)",
          }}
        >
          <Ionicons name={voiceEnabled ? "mic" : "mic-off"} size={15} color={voiceEnabled ? "#facc15" : "#9CA3AF"} />
        </TouchableOpacity>
        {voiceEnabled ? (
          <>
            <TouchableOpacity
              onPress={() => setCommentaryMode((m) => (m === "broadcast" ? "simple" : "broadcast"))}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: commentaryMode === "simple" ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: commentaryMode === "simple" ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "700", color: commentaryMode === "simple" ? "#34D399" : "#9CA3AF" }}>
                {commentaryMode === "simple" ? "Simple" : "Pro"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setCommentaryLanguage((lang) => {
                  if (lang === "en") return "hi";
                  if (lang === "hi") return "hinglish";
                  return "en";
                });
              }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: commentaryLanguage !== "en" ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: commentaryLanguage !== "en" ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "700", color: commentaryLanguage !== "en" ? "#C4B5FD" : "#9CA3AF" }}>
                {commentaryLanguage === "hi" ? "हिं" : commentaryLanguage === "hinglish" ? "Hing" : "EN"}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
      <Text style={{ color: "#64748B", fontSize: 10, fontWeight: "700" }}>Commentary</Text>
    </View>
  );

  const renderGameWithTabs = (emoji, scoringContent, scorecardContent, options = {}) => {
    const safeOptions = options || {};
    const showStickyHeader = !!safeOptions.stickyScoringHeader && !hideEmbeddedScoreboard;
    return (
      <View style={{ flex: 1, backgroundColor: scoringT.panel }}>
        {renderOfflineBadge()}
        {!hideEmbeddedScoreboard ? renderGameHeader(emoji, safeOptions.headerRight) : renderSpectatorCommentaryBar()}
        {renderGameOverBanner()}
        {!hideEmbeddedScoreboard ? renderScoreboard(emoji) : null}
        <View style={{ flex: 1 }}>
          {visitedTabs.scoring ? (
            <View style={{ flex: 1, display: activeTab === "scoring" ? "flex" : "none" }}>
              {showStickyHeader ? (
                <>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    paddingBottom: 10,
                    backgroundColor: scoringT.panel,
                    zIndex: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: scoringT.border,
                    elevation: 12,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: scoringT.isDark ? 0.35 : 0.12,
                    shadowRadius: 10,
                  }}>
                    {safeOptions.stickyScoringHeader}
                  </View>
                  <ScrollView style={{ flex: 1, backgroundColor: scoringT.panel }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {scoringContent}
                  </ScrollView>
                </>
              ) : (
                <ScrollView style={{ flex: 1, backgroundColor: scoringT.panel }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                  {scoringContent}
                </ScrollView>
              )}
            </View>
          ) : null}
          {visitedTabs.scorecard ? (
            <View style={{ flex: 1, display: activeTab === "scorecard" ? "flex" : "none" }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>{scorecardContent || scoringContent}</ScrollView>
            </View>
          ) : null}
          {visitedTabs.draw && renderSport === "Tennis" ? (
            <View style={{ flex: 1, display: activeTab === "draw" ? "flex" : "none" }}>
              <ScrollView
                style={{ flex: 1, backgroundColor: scoringT.panel }}
                contentContainerStyle={{ padding: 20, paddingBottom: 40, alignItems: "center" }}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={{
                    width: "100%",
                    backgroundColor: scoringT.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: scoringT.border,
                    padding: 20,
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Ionicons name="git-network-outline" size={36} color={scoringT.accent} />
                  <Text style={{ color: scoringT.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
                    Tournament Draw
                  </Text>
                  <Text style={{ color: scoringT.muted, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
                    View the full bracket and other matches in the tournament.
                  </Text>
                  {currentGame?.base?.tournamentId ? (
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/tournament/${currentGame.base.tournamentId}`)
                      }
                      style={{
                        marginTop: 8,
                        backgroundColor: scoringT.isDark ? "#16A34A" : "#111827",
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderBottomWidth: 3,
                        borderBottomColor: scoringT.isDark ? "#166534" : "#000000",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>
                        Open Draw
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          ) : null}
          {visitedTabs.lineups && renderSport === "Football" ? (
            <View style={{ flex: 1, display: activeTab === "lineups" ? "flex" : "none" }}>
              <FootballLineupPitch
                sport={renderCurrentGame?.sport}
                players={players}
                teamNames={teamNames}
                teamLogos={{
                  home: renderCurrentGame?.base?.teamLogo || team?.teamlogo || team?.teamLogo,
                  away: renderCurrentGame?.base?.opponentTeamLogo,
                }}
                events={renderCurrentGame?.sport?.events}
                onPlayerPress={(player, meta) => {
                  setLineupPlayerDetail({
                    player,
                    side: meta?.side || "home",
                  });
                }}
              />
            </View>
          ) : null}
          {visitedTabs.stats ? (
            <View style={{ flex: 1, display: activeTab === "stats" ? "flex" : "none" }}>
              {renderStatsTab()}
            </View>
          ) : null}
          {visitedTabs.events ? (
            <View style={{ flex: 1, display: activeTab === "events" ? "flex" : "none" }}>
              {renderSport === "Cricket"
                ? <CricketEventTimelineMobile currentGame={renderCurrentGame} players={players} teamNames={teamNames} />
                : renderEventsTab()
              }
            </View>
          ) : null}
          {visitedTabs.replay ? (
            <View style={{ flex: 1, display: activeTab === "replay" ? "flex" : "none" }}>
              {renderReplayTab()}
            </View>
          ) : null}
          {visitedTabs.players ? (
            <View style={{ flex: 1, display: activeTab === "players" ? "flex" : "none" }}>
              {renderPlayersTab()}
            </View>
          ) : null}
        </View>
        {renderTabBar()}
        {renderPlayerStatsModal()}
        <FootballPlayerDetailSheet
          visible={!!lineupPlayerDetail?.player}
          onClose={() => setLineupPlayerDetail(null)}
          player={lineupPlayerDetail?.player}
          side={lineupPlayerDetail?.side || "home"}
          sport={renderCurrentGame?.sport}
          gameBase={renderCurrentGame?.base}
          teamNames={teamNames}
          teamLogos={{
            home: renderCurrentGame?.base?.teamLogo || team?.teamlogo || team?.teamLogo,
            away: renderCurrentGame?.base?.opponentTeamLogo,
          }}
          rosterPlayers={(
            lineupPlayerDetail?.side === "away" ? (players?.away || []) : (players?.home || [])
          ).filter((p) => p && p.role !== "manager" && p.role !== "spectator")}
          onSelectPlayer={(nextPlayer, nextSide) => {
            setLineupPlayerDetail({
              player: nextPlayer,
              side: nextSide || lineupPlayerDetail?.side || "home",
            });
          }}
        />
        {/* End-game loading overlay */}
        <Modal transparent animationType="fade" visible={isEndingGame}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" }}>
            <View style={{ backgroundColor: "#1e2235", borderRadius: 16, padding: 32, alignItems: "center", gap: 14, minWidth: 220 }}>
              <ActivityIndicator size="large" color="#47feb7" />
              <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 16 }}>Ending game…</Text>
              <Text style={{ color: "#6B7280", fontSize: 13, textAlign: "center" }}>Saving results, please wait</Text>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  // ══════════════ RENDER ══════════════
  if (loading) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: scoringT.panel }}>
      <ActivityIndicator size="large" color={scoringT.accent} />
      <Text style={{ color: scoringT.textDim, marginTop: 12, fontSize: 13 }}>Loading game...</Text>
    </View>
  );
  if (!renderCurrentGame) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: scoringT.panel, paddingHorizontal: 24 }}>
      <Ionicons name="alert-circle-outline" size={60} color={scoringT.textMuted} />
      <Text style={{ color: scoringT.textDim, fontSize: 16, marginTop: 16 }}>Game not found</Text>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginTop: 16, backgroundColor: scoringT.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}><Text style={{ color: scoringT.onAccent, fontWeight: "bold" }}>Go Back</Text></TouchableOpacity>}
    </View>
  );

  const endGameAlert = () => Alert.alert("End Game", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "End Game", style: "destructive", onPress: doEndGame }]);
  const userSide = isHomeTeamForViewer(renderCurrentGame?.base, normalizedTeamId) ? "home" : "away";

  // ── Football ──
  if (renderSport === "Football") {
    const footballEvents = renderCurrentGame?.sport?.events || [];
    let latestFootballEvent = null;
    for (let index = footballEvents.length - 1; index >= 0; index -= 1) {
      const event = footballEvents[index];
      if (event && event.eventType !== "undo") {
        latestFootballEvent = event;
        break;
      }
    }
    const footballScoringDisabled = isUpdating || gameOver || !isLive;
    const footballMyTeamId = userSide === "home"
      ? String(renderCurrentGame?.base?.teamId || "")
      : String(renderCurrentGame?.base?.opponentTeamId || "");
    const footballCanUndo = !footballScoringDisabled
      && !!latestFootballEvent
      && (effectiveIsSelfOwnedOpponent || String(latestFootballEvent.teamId) === footballMyTeamId);
    const footballUndoButton = canScore ? (
      <TouchableOpacity
        onPress={() => {
          if (!footballCanUndo) return;
          Alert.alert(
            "Undo Event",
            "Remove the last recorded event?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Undo", style: "destructive", onPress: () => footballUndoRef.current?.() },
            ],
          );
        }}
        disabled={!footballCanUndo}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: footballCanUndo ? (scoringT.isDark ? "rgba(239,68,68,0.12)" : scoringT.dangerBg) : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: footballCanUndo ? (scoringT.isDark ? "rgba(239,68,68,0.32)" : "#FECACA") : scoringT.border,
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          opacity: footballCanUndo ? 1 : 0.45,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={footballCanUndo ? scoringT.dangerText : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: footballCanUndo ? scoringT.dangerText : scoringT.textMuted }}>Undo</Text>
      </TouchableOpacity>
    ) : null;

    return renderGameWithTabs(
      "⚽",
      <LiveFootballScoringPanel
        gameId={gameId}
        undoRef={footballUndoRef}
        currentGame={currentGame}
        players={players}
        teamNames={teamNames}
        gameTime={gameTime}
        onSubstitution={handleFootballSubstitution}
        onSetupLineup={handleFootballSetupLineup}
        onMatchStateChange={handleFootballMatchState}
        onTimerAdjust={handleFootballTimerAdjust}
        gameOver={gameOver}
        displayOnly={!canScore}
        userSide={userSide}
        isOwner={canScore}
        isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent}
        onPauseResume={handlePauseResume}
        onStartGame={handleStartGame}
        onEndGame={endGameAlert}
        onEndShootout={() => handleFootballMatchState({ matchStatus: "finished" })}
        hideScoreboard
      />,
      undefined,
      {
        headerRight: footballUndoButton,
        stickyScoringHeader: (
          <FootballScoreboardCard
            compact
            sport={renderCurrentGame?.sport}
            teamNames={teamNames}
            gameTime={gameTime}
            isLive={isLive}
            isScheduled={isScheduled}
            gameOver={gameOver}
            isOwner={canScore}
            isUpdating={isUpdating}
            onPauseResume={handlePauseResume}
            onStartGame={handleStartGame}
            onEndGame={endGameAlert}
          />
        ),
      },
    );
  }

  // ── Cricket ──
  if (renderSport === "Cricket") {
    const homeTeamId = String(renderCurrentGame?.base?.teamId || "");
    const awayTeamId = String(renderCurrentGame?.base?.opponentTeamId || "");
    if (oversSelection.showModal && canScore) return (
      <View style={{ flex: 1, backgroundColor: scoringT.panel, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: scoringT.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: scoringT.border }}>
          <Text style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}> </Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: scoringT.text, textAlign: "center", marginBottom: 4 }}>Match Format</Text>
          <Text style={{ fontSize: 12, color: scoringT.textDim, textAlign: "center", marginBottom: 24 }}>{getCricketMatchFormatLabel(parseInt(oversSelection.overs, 10))} · {oversSelection.overs} overs per side</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 24 }}>
            {["5", "10", "15", "20", "50"].map((ov) => (
              <TouchableOpacity key={ov} onPress={() => setOversSelection((prev) => ({ ...prev, overs: ov }))} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 2, alignItems: "center", borderColor: oversSelection.overs === ov ? scoringT.accent : scoringT.border, backgroundColor: oversSelection.overs === ov ? scoringT.activeTint : scoringT.cardElevated }}>
                <Text style={{ color: oversSelection.overs === ov ? scoringT.accent : scoringT.text, fontWeight: "800", fontSize: 16 }}>{ov}</Text>
                <Text style={{ color: oversSelection.overs === ov ? scoringT.accent : scoringT.textMuted, fontWeight: "700", fontSize: 9, marginTop: 2 }}>{getCricketMatchFormatLabel(parseInt(ov, 10))}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ textAlign: "center", color: scoringT.textDim, fontSize: 11, marginBottom: 16 }}>Or enter custom overs:</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 }}>
            <TouchableOpacity onPress={() => setOversSelection((prev) => ({ ...prev, overs: String(Math.max(1, parseInt(prev.overs, 10) - 1)) }))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: scoringT.cardElevated, alignItems: "center", justifyContent: "center" }}><Text style={{ color: scoringT.text, fontSize: 20, fontWeight: "bold" }}>−</Text></TouchableOpacity>
            <Text style={{ color: scoringT.accent, fontSize: 32, fontWeight: "900", minWidth: 60, textAlign: "center" }}>{oversSelection.overs}</Text>
            <TouchableOpacity onPress={() => setOversSelection((prev) => ({ ...prev, overs: String(parseInt(prev.overs, 10) + 1) }))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: scoringT.cardElevated, alignItems: "center", justifyContent: "center" }}><Text style={{ color: scoringT.text, fontSize: 20, fontWeight: "bold" }}>+</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleOversConfirm} style={{ backgroundColor: "#16a34a", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirm {oversSelection.overs} Overs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
    if (tossSelection.showSelection && canScore) return (
      <View style={{ flex: 1, backgroundColor: scoringT.panel, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: scoringT.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: scoringT.border }}>
          <Text style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🪙</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: scoringT.text, textAlign: "center", marginBottom: 4 }}>Toss</Text>
          <Text style={{ fontSize: 12, color: scoringT.textDim, textAlign: "center", marginBottom: 24 }}>Who won the toss?</Text>
          {!tossSelection.tossWinner ? (
            <View style={{ gap: 12 }}>
              <TouchableOpacity onPress={() => setTossSelection((prev) => ({ ...prev, tossWinner: homeTeamId }))} style={{ backgroundColor: "rgba(71,254,183,0.1)", borderWidth: 2, borderColor: "rgba(71,254,183,0.3)", borderRadius: 14, paddingVertical: 18, alignItems: "center" }}>
                <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 16 }}>{teamNames.home}</Text>
                <Text style={{ color: scoringT.textMuted, fontSize: 10, marginTop: 2 }}>Home Team</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTossSelection((prev) => ({ ...prev, tossWinner: awayTeamId }))} style={{ backgroundColor: "rgba(248,113,113,0.1)", borderWidth: 2, borderColor: "rgba(248,113,113,0.3)", borderRadius: 14, paddingVertical: 18, alignItems: "center" }}>
                <Text style={{ color: "#f87171", fontWeight: "800", fontSize: 16 }}>{teamNames.away}</Text>
                <Text style={{ color: scoringT.textMuted, fontSize: 10, marginTop: 2 }}>Away Team</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ textAlign: "center", color: scoringT.text, fontSize: 13, marginBottom: 16, fontWeight: "600" }}>{String(tossSelection.tossWinner) === homeTeamId ? teamNames.home : teamNames.away} won the toss!</Text>
              <Text style={{ textAlign: "center", color: scoringT.textDim, fontSize: 11, marginBottom: 16 }}>Elected to...</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => handleTossSelection(tossSelection.tossWinner, "bat")} style={{ flex: 1, backgroundColor: "rgba(71,254,183,0.15)", borderWidth: 2, borderColor: "rgba(71,254,183,0.3)", borderRadius: 14, paddingVertical: 20, alignItems: "center" }}>
                  {/* <Text style={{ fontSize: 28, marginBottom: 4 }}> </Text> */}
                  <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 16 }}>BAT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleTossSelection(tossSelection.tossWinner, "bowl")} style={{ flex: 1, backgroundColor: "rgba(96,165,250,0.15)", borderWidth: 2, borderColor: "rgba(96,165,250,0.3)", borderRadius: 14, paddingVertical: 20, alignItems: "center" }}>
                  {/* <Text style={{ fontSize: 28, marginBottom: 4 }}>⚾</Text> */}
                  <Text style={{ color: "#60a5fa", fontWeight: "800", fontSize: 16 }}>BOWL</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setTossSelection((prev) => ({ ...prev, tossWinner: null }))} style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: scoringT.textMuted, fontSize: 11 }}>← Change toss winner</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
    const cricketHasEvents = (renderCurrentGame?.sport?.events?.length || 0) > 0;
    const cricketCanUndo = canScore && isLive && !gameOver && !isUpdating && !isCricketSyncing && cricketHasEvents;
    const cricketUndoButton = canScore ? (
      <TouchableOpacity
        onPress={handleCricketUndo}
        disabled={!cricketCanUndo}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: cricketCanUndo ? "rgba(239,68,68,0.12)" : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: cricketCanUndo ? "rgba(239,68,68,0.32)" : scoringT.border,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
          opacity: cricketCanUndo ? 1 : 0.45,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={cricketCanUndo ? "#f87171" : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: cricketCanUndo ? "#f87171" : scoringT.textMuted }}>
          Undo
        </Text>
      </TouchableOpacity>
    ) : null;
    return renderGameWithTabs("",
      <LiveCricketScoringPanel gameId={gameId} syncGame={currentGame} currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} isCricketSyncing={isCricketSyncing} onScore={handleCricketScore} onWicket={handleCricketWicket} onSwapStrike={handleSwapStrike} onChangeBowler={handleChangeBowler} onSetBattingOrder={handleSetBattingOrder} gameOver={gameOver} displayOnly={!canScore || !isLive} userSide={userSide} onPauseResume={handlePauseResume} onEndGame={endGameAlert} onStartSecondInnings={handleStartSecondInnings} onStartSuperOver={handleStartSuperOver} />,
      <CricketScorecardMobile currentGame={renderCurrentGame} players={players} teamNames={teamNames} />,
      { headerRight: cricketUndoButton },
    );
  }

  // ── Basketball ──
  if (sport === "Basketball") {
    let content;
    const basketballPossession = currentGame?.sport?.possession === "away" ? "away" : "home";
    const basketballHasEvents = (currentGame?.sport?.events?.length || 0) > 0;
    const basketballPossessionSides = effectiveIsSelfOwnedOpponent ? ["home", "away"] : [userSide];
    const basketballStickyHeader = !canScore || !isLive ? null : (
      <View
        style={{
          backgroundColor: scoringT.card,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: scoringT.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: basketballPossessionSides.length > 1 ? "center" : "flex-start" }}>
            {basketballPossessionSides.map((side, index) => {
              const isHomeSide = side === "home";
              const isActive = basketballPossession === side;
              const sideColor = isHomeSide
                ? (scoringT.isDark ? "#4ade80" : "#15803D")
                : (scoringT.isDark ? "#f87171" : "#DC2626");
              const sideBg = isHomeSide
                ? (scoringT.isDark ? "rgba(74,222,128,0.18)" : "#DCFCE7")
                : (scoringT.isDark ? "rgba(248,113,113,0.18)" : "#FEE2E2");
              const sideBorder = isHomeSide
                ? (scoringT.isDark ? "#4ade80" : "#86EFAC")
                : (scoringT.isDark ? "#f87171" : "#FECACA");
              const sideLabel = isHomeSide ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
              const sideGameState = `${sideLabel} possession | 24s | new possession from possession arrow`;

              return (
                <View key={side} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {index > 0 && basketballPossessionSides.length > 1 && (
                    <View style={{ alignItems: "center" }}>
                      <Ionicons
                        name={basketballPossession === "home" ? "arrow-back" : "arrow-forward"}
                        size={16}
                        color={scoringT.warningStrong}
                      />
                      <Text style={{ fontSize: 8, color: scoringT.muted, fontWeight: "700" }}>POSS</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleBasketballEvent("possession_change", side, undefined, {
                      possession: side,
                      shotClock: 24,
                      gameState: sideGameState,
                    })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: isActive ? sideBg : scoringT.cardElevated,
                      borderWidth: 1,
                      borderColor: isActive ? sideBorder : scoringT.border,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    {isActive && isHomeSide && <Ionicons name="basketball" size={13} color={sideColor} />}
                    <Text style={{ fontSize: 10, fontWeight: "800", color: isActive ? sideColor : scoringT.muted }} numberOfLines={1}>
                      {sideLabel}
                    </Text>
                    {isActive && !isHomeSide && <Ionicons name="basketball" size={13} color={sideColor} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => {
              const lastEvent = currentGame?.sport?.events?.[currentGame.sport.events.length - 1];
              Alert.alert(
                "Undo Last Event",
                `Remove "${lastEvent?.eventType?.replace(/_/g, " ") || "last event"}"?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Undo", style: "destructive", onPress: () => handleBasketballUndo?.() },
                ],
              );
            }}
            disabled={isUpdating || !basketballHasEvents}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: basketballHasEvents
                ? (scoringT.isDark ? "rgba(239,68,68,0.12)" : scoringT.dangerBg)
                : scoringT.cardElevated,
              borderWidth: 1,
              borderColor: basketballHasEvents
                ? (scoringT.isDark ? "rgba(239,68,68,0.32)" : "#FECACA")
                : scoringT.border,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: isUpdating || !basketballHasEvents ? 0.45 : 1,
            }}
          >
            <Ionicons name="arrow-undo" size={13} color={basketballHasEvents ? scoringT.dangerText : scoringT.textMuted} />
            <Text style={{ fontSize: 10, fontWeight: "800", color: basketballHasEvents ? scoringT.dangerText : scoringT.textMuted }} numberOfLines={1}>
              Undo
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
    try {
      content = <LiveBasketballScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} onUndo={handleBasketballUndo} onSubstitution={handleBasketballSubstitution} onSetupLineup={handleBasketballSetupLineup} gameOver={gameOver} displayOnly={!canScore || !isLive} isOwner={canScore} userSide={userSide} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} onPauseResume={handlePauseResume} onEndGame={endGameAlert} />;
    } catch (err) {
      content = <View style={{ padding: 20, alignItems: "center" }}><Text style={{ color: "#f87171", fontWeight: "700" }}>Basketball panel error: {String(err?.message)}</Text></View>;
    }
    return renderGameWithTabs("🏀", content, undefined, { stickyScoringHeader: basketballStickyHeader });
  }

  // ── Volleyball ──
  if (renderSport === "Volleyball") {
    const volleyballLatestUndoable = [...(renderCurrentGame?.sport?.events || [])]
      .reverse()
      .find((event) => event && event.eventType !== "undo");
    const volleyballCanUndo = canScore && isLive && !gameOver && !isUpdating && Boolean(volleyballLatestUndoable);
    const volleyballUndoButton = canScore ? (
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            "Undo",
            "Remove the last rally (one point)?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Undo",
                style: "destructive",
                onPress: () => handleVolleyballUndo?.(),
              },
            ],
          );
        }}
        disabled={!volleyballCanUndo}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: volleyballCanUndo ? "#DC2626" : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: volleyballCanUndo ? "#B91C1C" : scoringT.border,
          borderBottomWidth: 3,
          borderBottomColor: volleyballCanUndo ? "#991B1B" : scoringT.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          opacity: volleyballCanUndo ? 1 : 0.45,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: volleyballCanUndo ? 0.25 : 0,
          shadowRadius: 3,
          elevation: volleyballCanUndo ? 4 : 0,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={volleyballCanUndo ? "#FFFFFF" : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: volleyballCanUndo ? "#FFFFFF" : scoringT.textMuted }}>
          Undo
        </Text>
      </TouchableOpacity>
    ) : null;
    const volleyballScoringContent = (
      <LiveVolleyballScoringPanel
        gameId={gameId}
        currentGame={currentGame}
        players={players}
        teamNames={teamNames}
        isUpdating={isUpdating}
        onScore={handleVolleyballRally}
        onSubstitution={handleVolleyballSubstitution}
        onLiberoSwap={handleVolleyballLiberoSwap}
        onSetupLineup={handleVolleyballSetupLineup}
        onTimeout={handleVolleyballTimeout}
        onChallenge={handleVolleyballChallenge}
        gameOver={gameOver}
        displayOnly={!canScore || !isLive}
        userSide={userSide}
        isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent}
        onEndGame={endGameAlert}
      />
    );
    return renderGameWithTabs(
      "🏐",
      volleyballScoringContent,
      <VolleyballScorecardMobile currentGame={renderCurrentGame} teamNames={teamNames} />,
      { headerRight: volleyballUndoButton },
    );
  }

  // ── Hockey (Field) ──
  if (sport === "Hockey") {
    const hockeyLastUndoableEvent = [...(currentGame?.sport?.events || [])].reverse().find((event) => event && event.eventType !== "undo");
    const hockeyLastUndoableEventSide = hockeyLastUndoableEvent?.teamSide === "home" || hockeyLastUndoableEvent?.teamSide === "away"
      ? hockeyLastUndoableEvent.teamSide
      : String(hockeyLastUndoableEvent?.teamId) === String(currentGame?.base?.teamId)
        ? "home"
        : String(hockeyLastUndoableEvent?.teamId) === String(currentGame?.base?.opponentTeamId)
          ? "away"
          : null;
    const hockeyCanUndoLatestEvent = !!hockeyLastUndoableEvent && (effectiveIsSelfOwnedOpponent || hockeyLastUndoableEventSide === userSide);
    const hockeyUndoTeamSide = effectiveIsSelfOwnedOpponent ? null : userSide;
    const hockeyLastEventLabel = hockeyLastUndoableEvent?.eventType
      ? String(hockeyLastUndoableEvent.eventType).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : null;
    const hockeyUndoButton = !canScore ? null : (
      <TouchableOpacity
        onPress={() => handleHockeyEvent?.("undo", hockeyUndoTeamSide)}
        disabled={isUpdating || !hockeyCanUndoLatestEvent || !isLive}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: hockeyCanUndoLatestEvent ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: hockeyCanUndoLatestEvent ? "rgba(239,68,68,0.32)" : "rgba(255,255,255,0.1)",
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          opacity: isUpdating || !hockeyCanUndoLatestEvent || !isLive ? 0.45 : 1,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={hockeyCanUndoLatestEvent ? "#f87171" : "#9CA3AF"} />
        <View>
          <Text style={{ fontSize: 10, fontWeight: "800", color: hockeyCanUndoLatestEvent ? "#f87171" : "#9CA3AF" }}>Undo</Text>
          {hockeyLastUndoableEventSide && !effectiveIsSelfOwnedOpponent && hockeyLastUndoableEventSide !== userSide ? (
            <Text style={{ fontSize: 8, color: "#9CA3AF" }} numberOfLines={1}>
              Waiting for opponent&apos;s last event
            </Text>
          ) : hockeyLastEventLabel && (
            <Text style={{ fontSize: 8, color: "#9CA3AF" }} numberOfLines={1}>
              {hockeyLastEventLabel}{hockeyLastUndoableEvent?.gameTime ? ` • ${hockeyLastUndoableEvent.gameTime}` : ""}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );

    return renderGameWithTabs(
      "🏑",
      <HockeyScoringPanel currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} onEvent={handleHockeyEvent} gameOver={gameOver} displayOnly={!canScore || !isLive} liveEvents={liveEvents} onPauseResume={handlePauseResume} onEndGame={endGameAlert} onStartGame={handleStartGame} onSaveLineup={handleHockeySetupLineup} isScheduled={isScheduled} isOwner={canScore} userSide={userSide} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} hideScoreboard />,
      <HockeyScoringPanel currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} onEvent={handleHockeyEvent} gameOver={gameOver} displayOnly={!canScore || !isLive} liveEvents={liveEvents} onPauseResume={handlePauseResume} onEndGame={endGameAlert} onSaveLineup={handleHockeySetupLineup} isScheduled={isScheduled} isOwner={canScore} userSide={userSide} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} />,
      {
        headerRight: hockeyUndoButton,
        stickyScoringHeader: (
          <HockeyScoreboardCard
            sport={currentGame?.sport}
            teamNames={teamNames}
            gameTime={gameTime}
            displayOnly={!canScore || !isLive}
            isUpdating={isUpdating}
            gameOver={gameOver}
            isScheduled={isScheduled}
            isOwner={canScore}
            players={players}
            userSide={userSide}
            isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent}
            onPauseResume={handlePauseResume}
            onEndGame={endGameAlert}
            onStartGame={handleStartGame}
            onSaveLineup={handleHockeySetupLineup}
          />
        ),
      }
    );
  }

  // ── Ice Hockey ──
  if (sport === "IceHockey") return renderGameWithTabs(
    "🏒",
    <IceHockeyScoringPanel currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} onEvent={handleIceHockeyEvent} gameOver={gameOver} displayOnly={!canScore || !isLive} liveEvents={liveEvents} onPauseResume={handlePauseResume} onEndGame={endGameAlert} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} userSide={userSide} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} hideScoreboard />,
    undefined,
    {
      stickyScoringHeader: (
        <IceHockeyScoreboardCard
          sport={currentGame?.sport}
          baseGame={currentGame?.base}
          teamNames={teamNames}
          gameTime={gameTime}
          displayOnly={!canScore || !isLive}
          isUpdating={isUpdating}
          gameOver={gameOver}
          isScheduled={isScheduled}
          isOwner={canScore}
          userSide={userSide}
          isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent}
          onPauseResume={handlePauseResume}
          onEndGame={endGameAlert}
          onStartGame={handleStartGame}
          onUndo={(undoTeamSide) => handleIceHockeyEvent?.("undo", undoTeamSide)}
          onEndPeriod={() => handleIceHockeyEvent?.("period_break", userSide || "home")}
        />
      ),
    }
  );

  // ── Tennis ──
  if (sport === "Tennis") {
    const tennisHasEvents = (renderCurrentGame?.sport?.events || []).filter(
      (event) => event && event.eventType !== "undo",
    ).length > 0;
    const tennisUndoButton = !canScore ? null : (
      <TouchableOpacity
        onPress={() => tennisUndoRef.current?.()}
        disabled={isUpdating || !tennisHasEvents}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: tennisHasEvents ? "#DC2626" : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: tennisHasEvents ? "#B91C1C" : scoringT.border,
          borderBottomWidth: 3,
          borderBottomColor: tennisHasEvents ? "#991B1B" : scoringT.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          opacity: isUpdating || !tennisHasEvents ? 0.45 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: tennisHasEvents ? 0.25 : 0,
          shadowRadius: 3,
          elevation: tennisHasEvents ? 4 : 0,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={tennisHasEvents ? "#FFFFFF" : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: tennisHasEvents ? "#FFFFFF" : scoringT.textMuted }}>
          Undo
        </Text>
      </TouchableOpacity>
    );

    return renderGameWithTabs(
      <Image
        source={require("../assets/images/tennis.png")}
        style={{ width: 54, height: 54 }}
      />,
      <LiveTennisScoringPanel
        gameId={gameId}
        currentGame={currentGame}
        teamNames={teamNames}
        isUpdating={isUpdating}
        onScore={handleRallyEvent}
        gameOver={gameOver}
        displayOnly={!canScore || !isLive}
        userSide={userSide}
        onEndGame={endGameAlert}
        undoRef={tennisUndoRef}
      />,
      <TennisScorecardMobile
        currentGame={renderCurrentGame}
        teamNames={teamNames}
        userSide={userSide}
      />,
      { headerRight: tennisUndoButton },
    );
  }

  // ── Badminton ──
  if (sport === "Badminton") {
    // Use renderCurrentGame (= liveDerivedGame when hydrated) so the undo button
    // reflects optimistic events scored via Redux before server ack.
    const badmintonHasEvents = Array.isArray(renderCurrentGame?.sport?.events) && renderCurrentGame.sport.events.length > 0;
    const badmintonUndoButton = !canScore ? null : (
      <TouchableOpacity
        onPress={() => badmintonUndoRef.current?.()}
        disabled={isUpdating || !badmintonHasEvents}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: badmintonHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.12)" : scoringT.dangerBg)
            : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: badmintonHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.32)" : "#FECACA")
            : scoringT.border,
          borderBottomWidth: 3,
          borderBottomColor: badmintonHasEvents
            ? (scoringT.isDark ? "rgba(185,28,28,0.55)" : "#FCA5A5")
            : scoringT.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          opacity: isUpdating || !badmintonHasEvents ? 0.45 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: badmintonHasEvents ? 0.18 : 0,
          shadowRadius: 2,
          elevation: badmintonHasEvents ? 3 : 0,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={badmintonHasEvents ? (scoringT.isDark ? "#f87171" : scoringT.dangerText) : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: badmintonHasEvents ? (scoringT.isDark ? "#f87171" : scoringT.dangerText) : scoringT.textMuted }}>Undo</Text>
      </TouchableOpacity>
    );

    return renderGameWithTabs(
      <Image
        source={require("../assets/images/badminton.png")}
        style={{ width: 54, height: 54 }}
      />,
      <LiveBadmintonScoringPanel
        gameId={gameId}
        currentGame={currentGame}
        teamNames={teamNames}
        players={players}
        isUpdating={isUpdating}
        onScore={handleRallyEvent}
        gameOver={gameOver}
        displayOnly={!canScore || !isLive}
        userSide={userSide}
        isScoringTab={true}
        onEndGame={endGameAlert}
        undoRef={badmintonUndoRef}
      />,
      <BadmintonScorecardMobile
        currentGame={renderCurrentGame}
        teamNames={teamNames}
        userSide={userSide}
      />,
      {
        headerRight: badmintonUndoButton,
      }
    );
  }

  // ── Table Tennis ──
  if (sport === "TableTennis" || sport === "Table Tennis") {
    const tableTennisHasEvents = (renderCurrentGame?.sport?.events || []).filter((event) => event && event.eventType !== "undo").length > 0;
    const tableTennisUndoButton = !canScore ? null : (
      <TouchableOpacity
        onPress={() => tableTennisUndoRef.current?.()}
        disabled={isUpdating || !tableTennisHasEvents}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: tableTennisHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.12)" : scoringT.dangerBg)
            : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: tableTennisHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.32)" : "#FECACA")
            : scoringT.border,
          borderBottomWidth: 3,
          borderBottomColor: tableTennisHasEvents
            ? (scoringT.isDark ? "rgba(185,28,28,0.55)" : "#FCA5A5")
            : scoringT.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          opacity: isUpdating || !tableTennisHasEvents ? 0.45 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: tableTennisHasEvents ? 0.18 : 0,
          shadowRadius: 2,
          elevation: tableTennisHasEvents ? 3 : 0,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={tableTennisHasEvents ? (scoringT.isDark ? "#f87171" : scoringT.dangerText) : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: tableTennisHasEvents ? (scoringT.isDark ? "#f87171" : scoringT.dangerText) : scoringT.textMuted }}>Undo</Text>
      </TouchableOpacity>
    );
    return renderGameWithTabs(<Image
      source={require("../assets/images/badminton.png")}
      style={{ width: 54, height: 54 }}
    />, <LiveTableTennisScoringPanel gameId={gameId} currentGame={currentGame} teamNames={teamNames} isUpdating={isUpdating} onScore={handleRallyEvent} gameOver={gameOver} displayOnly={!canScore || !isLive} userSide={userSide} onEndGame={endGameAlert} onPauseResume={handlePauseResume} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} gameTime={gameTime} hideScoreboard players={players} undoRef={tableTennisUndoRef} />,
    null,
    {
      headerRight: tableTennisUndoButton,
      stickyScoringHeader: (
        <TableTennisScoreboardCard
          currentGame={renderCurrentGame}
          teamNames={teamNames}
          isUpdating={isUpdating}
          gameOver={gameOver}
          displayOnly={!canScore || !isLive}
          userSide={userSide}
          onEndGame={endGameAlert}
          onPauseResume={handlePauseResume}
          onStartGame={handleStartGame}
          isScheduled={isScheduled}
          isOwner={canScore}
          gameTime={gameTime}
        />
      ),
    });
  }

  // ── Baseball ──
  if (sport === "Baseball") {
    const baseballHasEvents = (currentGame?.sport?.events?.length || 0) > 0;
    const baseballUndoButton = !canScore || !isLive ? null : (
      <TouchableOpacity
        onPress={() => {
          const lastEvent = currentGame?.sport?.events?.[currentGame.sport.events.length - 1];
          Alert.alert(
            "Undo Last Event",
            `Remove "${lastEvent?.eventType?.replace(/_/g, " ") || "last event"}"?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Undo", style: "destructive", onPress: () => handleBaseballUndo?.() },
            ],
          );
        }}
        disabled={isUpdating || !baseballHasEvents}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: baseballHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.12)" : scoringT.dangerBg)
            : scoringT.cardElevated,
          borderWidth: 1,
          borderColor: baseballHasEvents
            ? (scoringT.isDark ? "rgba(239,68,68,0.32)" : "#FECACA")
            : scoringT.border,
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          opacity: isUpdating || !baseballHasEvents ? 0.45 : 1,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={baseballHasEvents ? scoringT.dangerText : scoringT.textMuted} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: baseballHasEvents ? scoringT.dangerText : scoringT.textMuted }}>Undo</Text>
      </TouchableOpacity>
    );
    return renderGameWithTabs(
      "⚾",
      <LiveBaseballScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} isUpdating={isUpdating} onEvent={handleBaseballEvent} onSetupLineup={handleBaseballSetupLineup} onSubstitution={handleBaseballSubstitution} onStartGame={canScore ? handleStartGame : undefined} gameOver={gameOver} displayOnly={!canScore || !isLive} userSide={userSide} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} onEndGame={endGameAlert} />,
      <BaseballScorecardMobile currentGame={renderCurrentGame} players={players} teamNames={teamNames} />,
      { headerRight: baseballUndoButton },
    );
  }

  // ── Rugby ──
  if (sport === "Rugby") {
    const rugbyHasEvents = (currentGame?.sport?.events || []).filter(e => e && e.eventType !== "undo").length > 0;
    const rugbyUndoButton = (
      <TouchableOpacity
        onPress={() => {
          if (isUpdating || !canScore || !isLive) return;
          Alert.alert(
            "Undo Last Event",
            "Remove the last action? This cannot be reversed.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Undo", style: "destructive", onPress: () => rugbyLiveUndoRef.current?.() },
            ]
          );
        }}
        disabled={isUpdating || !rugbyHasEvents}
        style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: rugbyHasEvents ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: rugbyHasEvents ? "rgba(239,68,68,0.32)" : "rgba(255,255,255,0.1)",
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          opacity: isUpdating || !rugbyHasEvents ? 0.45 : 1,
        }}
      >
        <Ionicons name="arrow-undo" size={13} color={rugbyHasEvents ? "#f87171" : "#9CA3AF"} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: rugbyHasEvents ? "#f87171" : "#9CA3AF" }}>Undo</Text>
      </TouchableOpacity>
    );
    return renderGameWithTabs("🏉",
      <LiveRugbyScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} onEvent={handleRugbyEvent} onSubstitution={handleRugbySubstitution} gameOver={gameOver} displayOnly={!canScore || !isLive} userSide={userSide} isScoringTab={true} onEndGame={endGameAlert} onPauseResume={handlePauseResume} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} hideScoreboard isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} undoRef={rugbyLiveUndoRef} />,
      <LiveRugbyScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} gameTime={gameTime} isUpdating={isUpdating} onEvent={handleRugbyEvent} onSubstitution={handleRugbySubstitution} gameOver={gameOver} displayOnly={true} userSide={userSide} isScoringTab={false} onEndGame={endGameAlert} onPauseResume={handlePauseResume} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} isSelfOwnedOpponent={effectiveIsSelfOwnedOpponent} />,
      {
        headerRight: rugbyUndoButton,
        stickyScoringHeader: (
          <>
            <RugbyScoreboardCard
              sport={currentGame?.sport}
              teamNames={teamNames}
              gameTime={gameTime}
              displayOnly={!canScore || !isLive}
              isUpdating={isUpdating}
              gameOver={gameOver}
              isScheduled={isScheduled}
              isOwner={canScore}
              onPauseResume={handlePauseResume}
              onEndGame={endGameAlert}
              onStartGame={handleStartGame}
            />
            {canScore && isLive && (
              <View style={{ marginTop: 8 }}>
                <RugbyPossessionBar
                  currentGame={currentGame}
                  teamNames={teamNames}
                  players={players}
                  onEvent={handleRugbyEvent}
                  onLineupChange={handleRugbyKickoffLineup}
                  manageableSides={
                    effectiveIsSelfOwnedOpponent
                      ? ["home", "away"]
                      : userSide === "home" || userSide === "away"
                        ? [userSide]
                        : ["home"]
                  }
                  disabled={!canScore || !isLive}
                />
              </View>
            )}
          </>
        ),
      }
    );
  }

  // ── Pickleball ──
  if (sport === "Pickleball") return renderGameWithTabs("🏓",
    <LivePickleballScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} isUpdating={isUpdating} onScore={handleRallyEvent} onUndo={handlePickleballUndo} gameOver={gameOver} displayOnly={!canScore || !isLive} userSide={userSide} isScoringTab={true} onEndGame={endGameAlert} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} onPauseResume={handlePauseResume} />,
    <LivePickleballScoringPanel gameId={gameId} currentGame={currentGame} players={players} teamNames={teamNames} isUpdating={isUpdating} onScore={handleRallyEvent} onUndo={handlePickleballUndo} gameOver={gameOver} displayOnly={true} userSide={userSide} isScoringTab={false} onEndGame={endGameAlert} onStartGame={handleStartGame} isScheduled={isScheduled} isOwner={canScore} onPauseResume={handlePauseResume} />,
    {
      stickyScoringHeader: (
        <PickleballScoreboardCard
          currentGame={currentGame}
          teamNames={teamNames}
          gameTime={gameTime}
          displayOnly={!canScore || !isLive}
          isUpdating={isUpdating}
          gameOver={gameOver}
          isScheduled={isScheduled}
          isOwner={canScore}
          onPauseResume={handlePauseResume}
          onEndGame={endGameAlert}
          onStartGame={handleStartGame}
          userSide={userSide}
        />
      ),
    }
  );

  // ── Chess ──
  if (sport === "Chess") return (
    <View style={{ flex: 1, backgroundColor: scoringT.bg }}>
      {renderOfflineBadge()}
      {renderGameHeader("♟")}
      {renderGameOverBanner()}
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 16) }}>
        <ChessScoringPanelMobile currentGame={currentGame} players={players} teamNames={teamNames} isUpdating={isUpdating} onEvent={handleChessEvent} gameOver={gameOver} displayOnly={!canScore || !isLive} isOwner={canScore} isScheduled={isScheduled} onStartGame={handleStartGame} userSide={userSide} onEndGame={endGameAlert} />
      </View>
      <Modal transparent animationType="fade" visible={isEndingGame}>
        <View style={{ flex: 1, backgroundColor: scoringT.overlay, alignItems: "center", justifyContent: "center" }}>
          <View style={{ backgroundColor: scoringT.card, borderRadius: 16, padding: 32, alignItems: "center", gap: 14, minWidth: 220, borderWidth: 1, borderColor: scoringT.border }}>
            <ActivityIndicator size="large" color={scoringT.isDark ? "#47feb7" : "#059669"} />
            <Text style={{ color: scoringT.text, fontWeight: "700", fontSize: 16 }}>Ending game…</Text>
            <Text style={{ color: scoringT.muted, fontSize: 13, textAlign: "center" }}>Saving results, please wait</Text>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ── Fallback ──
  const fallbackSportLabel = renderSport || sport || "This sport";
  return renderGameWithTabs("🏅", <View style={{ alignItems: "center", justifyContent: "center", padding: 24, paddingVertical: 80 }}><Text style={{ color: "#bacbbf", fontSize: 15, textAlign: "center" }}>{fallbackSportLabel} scoring panel coming soon</Text></View>);
}