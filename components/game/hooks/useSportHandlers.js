import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Alert } from "react-native";
import {
  addGameEventAPI,
  removeLastEventAPI,
  startGameAPI,
  endGameAPI,
  updateFootballMatchStateAPI,
  updateFootballLineupAPI,
  updateBattingOrderAPI,
  updateCurrentBowlerAPI,
  updateRugbyMatchStateAPI,
  updateRugbyLineupAPI,
  updateTossAPI,
  updateCricketMatchStateAPI,
  updateBasketballLineupAPI,
  updateBaseballLineupAPI,
  updateHockeyLineupAPI,
  updateVolleyballLineupAPI,
  updateServingTeamAPI,
  makeSubstitutionAPI,
} from "@/services/GameApi";
import { showToast } from "@/context/ToastContext";
import { resolveChessOutcome } from "@/lib/chessUtils";
import { store } from "@/store";
import {
  enqueueEvent,
  forceResetFromServer,
  hydrateGame,
  nackBatch,
  rollbackOptimistic,
} from "@/features/liveGame/liveGameSlice";
import { createEvent } from "@/features/liveGame/events/createEvent";
import { LEGACY } from "@/features/liveGame/events/eventTypes";
import { fetchGameSnapshot } from "@/features/liveGame/transport/httpClient";
import { createDerivedGameSelector, selectPendingEvents } from "@/features/liveGame/selectors";
import { normalizeGameModel } from "@/lib/gameModel";
import { isGameFinished } from "./gameStatus";
import {
  applyOptimisticBadmintonEvent,
  applyOptimisticBadmintonUndo,
  applyOptimisticBadmintonUpdate,
  cloneGameSnapshot,
  getBadmintonScoringSide,
  replayPendingBadmintonActions,
} from "./badmintonState";
import {
  applyOptimisticVolleyballUndo,
  applyOptimisticVolleyballUpdate,
  countVolleyballRallyEvents,
  volleyballSetScoreSignature,
} from "./volleyballState";
import { cancelInflightSync } from "@/features/liveGame/sync/syncWorker";
import {
  applyFootballLineupSwap,
  applyOptimisticFootballUndo,
  applyOptimisticFootballUpdate,
} from "./footballState";
import { applyFormationPositionsToStarters } from "../footballFormations";
import {
  applyOptimisticBasketballUndo,
  applyOptimisticBasketballUpdate,
  resolveBasketballClockAction,
} from "./basketballState";
import {
  applyOptimisticHockeyUndo,
  applyOptimisticHockeyUpdate,
  deriveHockeyClientGame,
  getHockeyActiveCardSummary,
  getHockeyEventLooseFingerprint,
  getHockeyReplaySeedLineups,
  pruneCommittedHockeyPendingActions,
  replayPendingHockeyActions,
} from "./hockeyState";
import {
  addHockeyTombstone,
  loadHockeyTombstones,
  logHockeyCardDebug,
  pruneHockeyTombstonesFromStorage,
} from "@/lib/hockeyTombstones";
import {
  applyOptimisticIceHockeyUpdate,
  rollbackOptimisticIceHockeyUpdate,
} from "./iceHockeyState";
import {
  applyOptimisticRugbyUpdate,
  applyOptimisticRugbyUndo,
  replayPendingRugbyActions,
} from "./rugbyState";
import {
  applyOptimisticTennisUndo,
  applyOptimisticTennisUpdate,
  replayPendingTennisActions,
} from "./tennisState";
import {
  applyOptimisticTableTennisUndo,
  applyOptimisticTableTennisUpdate,
  replayPendingTableTennisActions,
} from "./tableTennisState";
import {
  applyOptimisticCricketChangeBowler,
  applyOptimisticCricketSwapStrike,
  applyOptimisticCricketUpdate,
  getCricketMatchResult,
  reconcileCricketTotalsFromEvents,
  replayPendingCricketActions,
} from "./cricketState";

const formatName = (player) => {
  if (!player) return "";
  const first = (player.firstName || "").trim();
  const last = (player.lastName || "").trim();
  return last ? `${first} ${last}` : first || "Player";
};

const getRunsForCricketStat = (eventType) => {
  switch (eventType) {
    case "dot_ball":
      return 0;
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "boundary_4":
      return 4;
    case "boundary_6":
      return 6;
    case "wide":
    case "no_ball":
    case "bye":
    case "leg_bye":
      return 1;
    default:
      return 0;
  }
};

const ICE_HOCKEY_PLAYER_REQUIRED_EVENTS = new Set(["goal", "penalty"]);

const isLikelyIceHockeyGoalie = (player) => {
  const text = `${player?.position || ""} ${player?.role || ""}`.toLowerCase();
  return (
    text.includes("goalie") ||
    text.includes("goaltender") ||
    text.includes("goalkeeper") ||
    text.split(/\s+/).includes("g")
  );
};

const findLikelyIceHockeyGoalie = (teamPlayers = []) =>
  (teamPlayers || []).filter(Boolean).find(isLikelyIceHockeyGoalie) || null;

const isEligibleIceHockeyPlayer = (player) => {
  if (!player) return false;
  const role = String(player.role || "player").trim().toLowerCase();
  return role === "player";
};

const filterIceHockeyPlayers = (teamPlayers = []) =>
  (teamPlayers || []).filter(isEligibleIceHockeyPlayer);

const uniqueIds = (values = []) => Array.from(new Set((values || []).filter(Boolean).map((value) => String(value))));

const playerIdOf = (player) => player?._id || player?.id || null;

const buildIceHockeyRosterSnapshot = (teamPlayersBySide = {}) => ({
  homePlayerIds: uniqueIds(filterIceHockeyPlayers(teamPlayersBySide.home || []).map(playerIdOf)),
  awayPlayerIds: uniqueIds(filterIceHockeyPlayers(teamPlayersBySide.away || []).map(playerIdOf)),
  homeGoalieId: playerIdOf(findLikelyIceHockeyGoalie(filterIceHockeyPlayers(teamPlayersBySide.home || []))),
  awayGoalieId: playerIdOf(findLikelyIceHockeyGoalie(filterIceHockeyPlayers(teamPlayersBySide.away || []))),
});

const normalizeIceHockeyOnIceSide = (teamPlayers = [], onIceSide = {}, strengthSkaters = 5) => {
  const eligiblePlayers = filterIceHockeyPlayers(teamPlayers);
  const rosterPlayerIds = uniqueIds(eligiblePlayers.map(playerIdOf));
  const fallbackGoalieId = playerIdOf(findLikelyIceHockeyGoalie(eligiblePlayers));
  const goalieId = uniqueIds([onIceSide?.goalieId, fallbackGoalieId]).find((playerId) => rosterPlayerIds.includes(playerId)) || null;
  let skaterIds = uniqueIds(onIceSide?.skaterIds || []).filter((playerId) => rosterPlayerIds.includes(playerId) && playerId !== goalieId);
  if (skaterIds.length === 0) {
    skaterIds = rosterPlayerIds.filter((playerId) => playerId !== goalieId).slice(0, Math.max(1, Number(strengthSkaters) || 5));
  }
  return {
    rosterPlayerIds,
    skaterIds,
    goalieId,
    goaliePulled: !!onIceSide?.goaliePulled,
  };
};

const buildIceHockeyOnIceSnapshot = (sportData = {}, teamPlayersBySide = {}) => ({
  home: normalizeIceHockeyOnIceSide(
    teamPlayersBySide.home || [],
    sportData?.onIce?.home || {},
    sportData?.strength?.home?.skaters || 5,
  ),
  away: normalizeIceHockeyOnIceSide(
    teamPlayersBySide.away || [],
    sportData?.onIce?.away || {},
    sportData?.strength?.away?.skaters || 5,
  ),
});

const formatClockPayload = (time = {}) =>
  `${String(time?.minutes ?? 20).padStart(2, "0")}:${String(time?.seconds ?? 0).padStart(2, "0")}`;

const getHockeyMatchFormat = (sportData) => {
  const raw = sportData?.matchFormat;
  if (!raw) {
    return { structureType: "quarters", periodCount: 4, periodDurationMinutes: 15 };
  }
  if (typeof raw === "string") {
    if (raw === "halves_35" || raw === "2_halves") {
      return { structureType: "halves", periodCount: 2, periodDurationMinutes: 35, label: "2 halves" };
    }
    return { structureType: "quarters", periodCount: 4, periodDurationMinutes: 15, label: raw };
  }
  return {
    structureType: raw.structureType === "halves" ? "halves" : "quarters",
    periodCount: Number(raw.periodCount) || (raw.structureType === "halves" ? 2 : 4),
    periodDurationMinutes: Number(raw.periodDurationMinutes) || 15,
    label: raw.label || null,
  };
};

// Event types that do NOT require the game clock to be running.
// Undo, substitutions, and meta-transitions are always allowed regardless of
// timer state.
const TIMER_EXEMPT_EVENTS = new Set([
  'undo', 'pause', 'resume', 'timeout', 'let',
  'substitution', 'possession_change',
  'quarter_break', 'quarter_transition',
  'period_end', 'period_break', 'half_time_break',
  'second_half', 'extra_time', 'extra_time_2',
  'lineup_change', 'match_start',
]);

export function useSportHandlers({
  currentGame,
  gameId,
  teamId,
  isOwner,
  gameOver,
  isUpdating,
  setIsUpdating,
  players,
  teamNames,
  gameTime,
  setGameTime,
  fetchGame,
  setCurrentGame,
  setGameOver,
  currentGameRef,
  incomingGameReconcilerRef,
  syncTimerNow,
  queueOrFire,
  isOnline,
  userSide = "home",
  isSelfOwnedOpponent = false,
}) {
  const sport = currentGame?.base?.sport;
  const tossModalShownRef = useRef(false);

  // ── Cricket state ──
  const [oversSelection, setOversSelection] = useState({ showModal: false, overs: "20", confirmed: false });
  const [tossSelection, setTossSelection] = useState({
    showSelection: false, tossWinner: null, decision: null,
    elected: null, isSelected: false, battingTeamId: null, bowlingTeamId: null,
  });

  // ── Hockey liveEvents ──
  const [liveEvents, setLiveEvents] = useState([]);
  const hockeyEventsHydratedRef = useRef(null);
  const hockeyPersistChainRef = useRef(Promise.resolve());
  const hockeyPendingSyncRef = useRef(0);
  const hockeyPendingActionsRef = useRef([]);
  const hockeyClientEventSeqRef = useRef(0);
  const hockeyServerSnapshotRef = useRef(null);
  const hockeyCancelledPersistIdsRef = useRef(new Set());
  const hockeyCancelledUndoTeamIdRef = useRef(new Map());
  const hockeySuppressedEventFingerprintsRef = useRef(new Set());

  const suppressHockeyEvent = useCallback((event) => {
    const fingerprint = getHockeyEventLooseFingerprint(event);
    if (!fingerprint) return;
    hockeySuppressedEventFingerprintsRef.current.add(fingerprint);
    addHockeyTombstone(gameId, fingerprint, hockeySuppressedEventFingerprintsRef.current);
    logHockeyCardDebug("tombstone.add", {
      fingerprint,
      tombstones: [...hockeySuppressedEventFingerprintsRef.current],
    });
  }, [gameId]);

  const pruneHockeySuppressedFingerprints = useCallback((serverEvents = []) => {
    const serverFingerprints = new Set(
      (serverEvents || []).map((event) => getHockeyEventLooseFingerprint(event)).filter(Boolean),
    );
    pruneHockeyTombstonesFromStorage(
      gameId,
      hockeySuppressedEventFingerprintsRef.current,
      serverFingerprints,
    );
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    loadHockeyTombstones(gameId).then((stored) => {
      if (cancelled) return;
      stored.forEach((fingerprint) => hockeySuppressedEventFingerprintsRef.current.add(fingerprint));
      logHockeyCardDebug("tombstone.hydrate", {
        gameId,
        count: stored.length,
        tombstones: stored,
      });
      if (stored.length > 0 && fetchGame) {
        fetchGame();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, fetchGame]);

  const getHockeyReplayOptions = useCallback((gameOrSport = null) => {
    const sport = gameOrSport?.sport || gameOrSport;
    const events = sport?.events || [];
    return {
      savedLineups: getHockeyReplaySeedLineups(sport || {}, events),
      suppressedFingerprints: hockeySuppressedEventFingerprintsRef.current,
      onSuppressEvent: suppressHockeyEvent,
    };
  }, [suppressHockeyEvent]);
  const iceHockeyPersistChainRef = useRef(Promise.resolve());
  const iceHockeyPendingSyncRef = useRef(0);
  const iceHockeyClientEventSeqRef = useRef(0);
  const volleyballPersistChainRef = useRef(Promise.resolve());
  const volleyballPendingSyncRef = useRef(0);
  const volleyballPendingActionsRef = useRef([]);
  const volleyballClientEventSeqRef = useRef(0);
  const volleyballServerSnapshotRef = useRef(null);
  const selectDerivedLiveGame = useMemo(() => createDerivedGameSelector(), []);
  const footballPersistChainRef = useRef(Promise.resolve());
  const footballPendingSyncRef = useRef(0);
  const footballPendingActionsRef = useRef([]);
  const footballClientEventSeqRef = useRef(0);
  const footballServerSnapshotRef = useRef(null);
  const basketballPersistChainRef = useRef(Promise.resolve());
  const basketballPendingSyncRef = useRef(0);
  const basketballPendingActionsRef = useRef([]);
  const basketballClientEventSeqRef = useRef(0);
  const basketballServerSnapshotRef = useRef(null);
  // Quarter clock bookkeeping for the auto end-of-quarter transition.
  // `armed` remembers that the clock was seen running inside a quarter, `ended`
  // remembers that we already closed it. Together they let us close a quarter
  // whenever the clock reads 00:00 instead of having to catch the single render
  // where it is both running and at zero. `floor` is the quarter we know we have
  // reached, so a lagging REST snapshot cannot make us re-read an old quarter and
  // mistake the next horn for one we already handled.
  const basketballQuarterArmedRef = useRef(0);
  const basketballAutoQuarterEndRef = useRef(0);
  const basketballQuarterFloorRef = useRef(0);
  const rugbyPersistChainRef = useRef(Promise.resolve());
  const rugbyPendingSyncRef = useRef(0);
  const rugbyPendingActionsRef = useRef([]);
  const rugbyClientEventSeqRef = useRef(0);
  const rugbyServerSnapshotRef = useRef(null);
  const badmintonPersistChainRef = useRef(Promise.resolve());
  const badmintonPendingSyncRef = useRef(0);
  const badmintonPendingActionsRef = useRef([]);
  const badmintonClientEventSeqRef = useRef(0);
  const badmintonServerSnapshotRef = useRef(null);
  const tableTennisPersistChainRef = useRef(Promise.resolve());
  const tableTennisPendingSyncRef = useRef(0);
  const tableTennisPendingActionsRef = useRef([]);
  const tableTennisClientEventSeqRef = useRef(0);
  const tableTennisServerSnapshotRef = useRef(null);
  const tennisPersistChainRef = useRef(Promise.resolve());
  const tennisPendingSyncRef = useRef(0);
  const tennisPendingActionsRef = useRef([]);
  const tennisClientEventSeqRef = useRef(0);
  const tennisServerSnapshotRef = useRef(null);
  const cricketPersistChainRef = useRef(Promise.resolve());
  const cricketPendingSyncRef = useRef(0);
  const cricketPendingActionsRef = useRef([]);
  const cricketClientEventSeqRef = useRef(0);
  const cricketServerSnapshotRef = useRef(null);
  const cricketLocalGameRef = useRef(null);
  const [cricketPendingSyncCount, setCricketPendingSyncCount] = useState(0);

  // Cricket optimistic actions (score, wicket, swap strike, change bowler) push
  // a locally computed game into `currentGame`. Track that exact snapshot so the
  // reconcile effect can tell it apart from a server snapshot and skip replaying
  // the pending actions a second time on top of it.
  const commitCricketLocalGame = useCallback((nextGame) => {
    if (!nextGame) return;
    cricketLocalGameRef.current = nextGame;
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);
  }, [currentGameRef, setCurrentGame]);

  const reconcileIncomingGame = useCallback((incomingGame) => {
    if (!incomingGame?.base || !incomingGame?.sport) return incomingGame;

    const incomingSport = incomingGame.base.sport;

    // ── Hockey reconciliation ──────────────────────────────────────────────
    // Replays pending optimistic actions (events + undos) on top of every
    // incoming server snapshot. Without this, a polling or websocket update
    // that arrives BEFORE the undo API call is confirmed would overwrite the
    // optimistic undo and resurrect the card for one polling cycle.
    if (incomingSport === "Hockey") {
      const hasOptimisticEvents = Array.isArray(incomingGame?.sport?.events)
        && incomingGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

      if (hasOptimisticEvents) return incomingGame;

      pruneHockeySuppressedFingerprints(incomingGame?.sport?.events || []);

      const tombstones = hockeySuppressedEventFingerprintsRef.current;

      const reconciledBase = deriveHockeyClientGame(
        cloneGameSnapshot(incomingGame),
        tombstones,
      );

      logHockeyCardDebug("reconcile.hydrate", {
        source: "fetch|poll|socket",
        tombstones: [...tombstones],
        server: getHockeyActiveCardSummary(incomingGame?.sport),
        derived: getHockeyActiveCardSummary(reconciledBase?.sport),
        pending: hockeyPendingActionsRef.current.map((action) => `${action.type}:${action.id}`),
        cardEventOrder: (incomingGame?.sport?.events || [])
          .filter((e) => ["green_card", "yellow_card", "red_card"].includes(e?.eventType))
          .map((e) => getHockeyEventLooseFingerprint(e)),
      });

      hockeyServerSnapshotRef.current = cloneGameSnapshot(reconciledBase);

      // Only drop pending once the server snapshot actually contains them.
      // Dropping on HTTP ACK alone causes 3→2→3: stale poll/socket can arrive
      // with empty pending and wipe the optimistic goal before it is visible.
      const beforePending = hockeyPendingActionsRef.current.length;
      hockeyPendingActionsRef.current = pruneCommittedHockeyPendingActions(
        hockeyPendingActionsRef.current,
        reconciledBase?.sport?.events || [],
      );
      if (
        typeof __DEV__ !== "undefined"
        && __DEV__
        && beforePending !== hockeyPendingActionsRef.current.length
      ) {
        console.log(
          `[HockeyACK] pruned committed pending ${beforePending} → ${hockeyPendingActionsRef.current.length}`,
        );
      }

      if (hockeyPendingActionsRef.current.length > 0) {
        const derived = replayPendingHockeyActions(
          cloneGameSnapshot(reconciledBase),
          hockeyPendingActionsRef.current,
          getHockeyReplayOptions(reconciledBase),
        );
        logHockeyCardDebug("reconcile.pending", {
          ...getHockeyActiveCardSummary(derived?.sport),
        });
        return derived;
      }

      return reconciledBase;
    }

    if (incomingSport === "Volleyball") {
      const live = store.getState().liveGame?.byGameId?.[gameId];
      const authoritySig = live?.localAuthorityScoreSig;
      if (authoritySig && volleyballSetScoreSignature(incomingGame) !== authoritySig) {
        return false;
      }
      return incomingGame;
    }

    if (incomingSport !== "TableTennis" && incomingSport !== "Table Tennis") {
      return incomingGame;
    }

    if (tableTennisPendingActionsRef.current.length === 0) {
      return incomingGame;
    }

    const hasOptimisticEvents = Array.isArray(incomingGame?.sport?.events)
      && incomingGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (hasOptimisticEvents) {
      return incomingGame;
    }

    tableTennisServerSnapshotRef.current = cloneGameSnapshot(incomingGame);
    return replayPendingTableTennisActions(
      cloneGameSnapshot(incomingGame),
      tableTennisPendingActionsRef.current,
    );
  }, [gameId, getHockeyReplayOptions, pruneHockeySuppressedFingerprints, store]);

  if (incomingGameReconcilerRef) {
    incomingGameReconcilerRef.current = reconcileIncomingGame;
  }

  const finishIceHockeyPersist = useCallback(async (shouldFetch) => {
    iceHockeyPendingSyncRef.current = Math.max(0, iceHockeyPendingSyncRef.current - 1);
    if (shouldFetch && iceHockeyPendingSyncRef.current === 0) {
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleIceHockeyPersist = useCallback((eventPayload) => {
    if (!gameId) return;

    iceHockeyPendingSyncRef.current += 1;
    const optimisticId = eventPayload._optimisticId;
    const label = `${String(eventPayload.eventType || "event").replace(/_/g, " ")} (${eventPayload.teamSide || "team"})`;
    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;
    delete persistPayload._previousOnIce;
    delete persistPayload._previousPeriodState;

    const persist = async () => {
      let shouldFetch = true;
      try {
        const apiCall = () => addGameEventAPI(gameId, persistPayload);
        const result = queueOrFire ? await queueOrFire(apiCall, label) : await apiCall();
        shouldFetch = result !== null;
        if (shouldFetch) {
          setLiveEvents((prev) =>
            prev.map((event) =>
              event?._optimisticId === optimisticId ? { ...event, pending: false } : event,
            ),
          );
        }
      } catch (error) {
        setCurrentGame?.((prev) => rollbackOptimisticIceHockeyUpdate(prev, eventPayload));
        setLiveEvents((prev) =>
          prev.filter((event) => event?._optimisticId !== optimisticId && event?._id !== optimisticId),
        );
        const message = error?.response?.data?.error || "Ice hockey event failed";
        showToast(`Sync failed: ${message}. Rolled back.`, "error", "top");
      } finally {
        await finishIceHockeyPersist(shouldFetch);
      }
    };

    iceHockeyPersistChainRef.current = iceHockeyPersistChainRef.current.then(persist, persist);
  }, [finishIceHockeyPersist, gameId, queueOrFire, setCurrentGame]);

  const replayPendingVolleyballActions = useCallback((game, actions = volleyballPendingActionsRef.current) => {
    return (actions || []).reduce((nextGame, action) => {
      if (!nextGame) return nextGame;
      if (action?.type === "undo") {
        return applyOptimisticVolleyballUndo(nextGame, { teamSide: action.teamSide || null }).nextGame;
      }
      if (action?.type === "event" && action.payload) {
        return applyOptimisticVolleyballUpdate(nextGame, action.payload);
      }
      return nextGame;
    }, game);
  }, []);

  useEffect(() => {
    if (sport !== "Volleyball" || !currentGame || !setCurrentGame) return;
    const hasOptimisticEvents = Array.isArray(currentGame?.sport?.events)
      && currentGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (!hasOptimisticEvents) {
      volleyballServerSnapshotRef.current = cloneGameSnapshot(currentGame);
    }
  }, [currentGame, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Football" || !currentGame || !setCurrentGame) return;
    if (footballPendingActionsRef.current.length > 0) return;
    footballServerSnapshotRef.current = cloneGameSnapshot(currentGame);
  }, [currentGame, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Basketball" || !currentGame || !setCurrentGame) return;
    if (basketballPendingActionsRef.current.length > 0) return;
    basketballServerSnapshotRef.current = cloneGameSnapshot(currentGame);
  }, [currentGame, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Hockey" || !currentGame || !setCurrentGame) return;
    if (hockeyPendingActionsRef.current.length > 0) return;
    hockeyServerSnapshotRef.current = cloneGameSnapshot(currentGame);
  }, [currentGame, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Rugby" || !currentGame || !setCurrentGame) return;
    if (rugbyPendingActionsRef.current.length > 0) return;
    rugbyServerSnapshotRef.current = cloneGameSnapshot(currentGame);
  }, [currentGame, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Badminton" || !currentGame || !setCurrentGame) return;

    const hasOptimisticEvents = Array.isArray(currentGame?.sport?.events)
      && currentGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (badmintonPendingActionsRef.current.length > 0) {
      if (hasOptimisticEvents) return;
      badmintonServerSnapshotRef.current = cloneGameSnapshot(currentGame);
      const replayedGame = replayPendingBadmintonActions(
        cloneGameSnapshot(currentGame),
        badmintonPendingActionsRef.current,
      );
      if (currentGameRef) {
        currentGameRef.current = replayedGame;
      }
      setCurrentGame(replayedGame);
      setGameOver?.(isGameFinished(replayedGame));
      return;
    }

    if (!hasOptimisticEvents) {
      badmintonServerSnapshotRef.current = cloneGameSnapshot(currentGame);
    }
  }, [currentGame, currentGameRef, setCurrentGame, setGameOver, sport]);

  useEffect(() => {
    if (sport !== "TableTennis" && sport !== "Table Tennis") return;
    if (!currentGame || !setCurrentGame) return;

    const hasOptimisticEvents = Array.isArray(currentGame?.sport?.events)
      && currentGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (tableTennisPendingActionsRef.current.length > 0) {
      if (hasOptimisticEvents) return;
      tableTennisServerSnapshotRef.current = cloneGameSnapshot(currentGame);
      const replayedGame = replayPendingTableTennisActions(
        cloneGameSnapshot(currentGame),
        tableTennisPendingActionsRef.current,
      );
      if (currentGameRef) {
        currentGameRef.current = replayedGame;
      }
      setCurrentGame(replayedGame);
      return;
    }

    if (!hasOptimisticEvents) {
      tableTennisServerSnapshotRef.current = cloneGameSnapshot(currentGame);
    }
  }, [currentGame, currentGameRef, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Tennis" || !currentGame || !setCurrentGame) return;

    const hasOptimisticEvents = Array.isArray(currentGame?.sport?.events)
      && currentGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (tennisPendingActionsRef.current.length > 0) {
      if (hasOptimisticEvents) return;
      tennisServerSnapshotRef.current = cloneGameSnapshot(currentGame);
      const replayedGame = replayPendingTennisActions(
        cloneGameSnapshot(currentGame),
        tennisPendingActionsRef.current,
      );
      if (currentGameRef) {
        currentGameRef.current = replayedGame;
      }
      setCurrentGame(replayedGame);
      return;
    }

    if (!hasOptimisticEvents) {
      tennisServerSnapshotRef.current = cloneGameSnapshot(currentGame);
    }
  }, [currentGame, currentGameRef, setCurrentGame, sport]);

  useEffect(() => {
    if (sport !== "Cricket" || !currentGame || !setCurrentGame) return;
    // Snapshot we produced ourselves — pending actions are already applied to it.
    if (currentGame === cricketLocalGameRef.current) return;

    const hasOptimisticEvents = Array.isArray(currentGame?.sport?.events)
      && currentGame.sport.events.some((event) => event?.optimistic || event?._optimisticId);

    if (cricketPendingActionsRef.current.length > 0) {
      if (hasOptimisticEvents) return;
      cricketServerSnapshotRef.current = cloneGameSnapshot(currentGame);
      const replayedGame = replayPendingCricketActions(
        cloneGameSnapshot(currentGame),
        cricketPendingActionsRef.current,
      );
      commitCricketLocalGame(replayedGame);
      return;
    }

    if (!hasOptimisticEvents) {
      cricketServerSnapshotRef.current = cloneGameSnapshot(currentGame);
    }
  }, [commitCricketLocalGame, currentGame, setCurrentGame, sport]);

  const finishVolleyballPersist = useCallback(async (shouldFetch) => {
    volleyballPendingSyncRef.current = Math.max(0, volleyballPendingSyncRef.current - 1);
    if (shouldFetch && volleyballPendingSyncRef.current === 0) {
      volleyballPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleVolleyballPersist = useCallback((action, persistFn, label) => {
    if (!gameId) return;

    volleyballPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        volleyballPendingActionsRef.current = volleyballPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = volleyballServerSnapshotRef.current
          ? cloneGameSnapshot(volleyballServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          setCurrentGame(replayPendingVolleyballActions(serverSnapshot, volleyballPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || "Volleyball event failed";
        showToast(`Sync failed: ${message}. Score refreshed from server.`, "error", "top");
      } finally {
        await finishVolleyballPersist(shouldFetch);
      }
    };

    volleyballPersistChainRef.current = volleyballPersistChainRef.current.then(persist, persist);
  }, [fetchGame, finishVolleyballPersist, gameId, replayPendingVolleyballActions, setCurrentGame]);

  const replayPendingFootballActions = useCallback((game, actions = footballPendingActionsRef.current) => {
    return (actions || []).reduce((nextGame, action) => {
      if (!nextGame) return nextGame;
      if (action?.type === "undo") {
        return applyOptimisticFootballUndo(nextGame, { teamSide: action.teamSide || null }).nextGame;
      }
      if (action?.type === "event" && action.payload) {
        return applyOptimisticFootballUpdate(nextGame, action.payload);
      }
      return nextGame;
    }, game);
  }, []);

  const finishFootballPersist = useCallback(async (shouldFetch) => {
    footballPendingSyncRef.current = Math.max(0, footballPendingSyncRef.current - 1);
    if (shouldFetch && footballPendingSyncRef.current === 0) {
      footballPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleFootballPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    footballPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        footballPendingActionsRef.current = footballPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = footballServerSnapshotRef.current
          ? cloneGameSnapshot(footballServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          setCurrentGame(replayPendingFootballActions(serverSnapshot, footballPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || "Football event failed";
        showToast(`Sync failed: ${message}. Score refreshed from server.`, "error", "top");
      } finally {
        await finishFootballPersist(shouldFetch);
      }
    };

    footballPersistChainRef.current = footballPersistChainRef.current.then(persist, persist);
  }, [fetchGame, finishFootballPersist, gameId, replayPendingFootballActions, setCurrentGame]);

  const replayPendingBasketballActions = useCallback((game, actions = basketballPendingActionsRef.current) => {
    return (actions || []).reduce((nextGame, action) => {
      if (!nextGame) return nextGame;
      if (action?.type === "undo") {
        return applyOptimisticBasketballUndo(nextGame, { teamSide: action.teamSide || null }).nextGame;
      }
      if (action?.type === "event" && action.payload) {
        return applyOptimisticBasketballUpdate(nextGame, action.payload);
      }
      return nextGame;
    }, game);
  }, []);

  const finishBasketballPersist = useCallback(async (shouldFetch) => {
    basketballPendingSyncRef.current = Math.max(0, basketballPendingSyncRef.current - 1);
    if (shouldFetch && basketballPendingSyncRef.current === 0) {
      basketballPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleBasketballPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    basketballPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        basketballPendingActionsRef.current = basketballPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = basketballServerSnapshotRef.current
          ? cloneGameSnapshot(basketballServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          setCurrentGame(replayPendingBasketballActions(serverSnapshot, basketballPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || "Basketball event failed";
        showToast(`Sync failed: ${message}. Score refreshed from server.`, "error", "top");
      } finally {
        await finishBasketballPersist(shouldFetch);
      }
    };

    basketballPersistChainRef.current = basketballPersistChainRef.current.then(persist, persist);
  }, [fetchGame, finishBasketballPersist, gameId, replayPendingBasketballActions, setCurrentGame]);

  const finishHockeyPersist = useCallback(async (shouldFetch, { blockUi = false } = {}) => {
    hockeyPendingSyncRef.current = Math.max(0, hockeyPendingSyncRef.current - 1);
    if (blockUi && hockeyPendingSyncRef.current === 0) {
      setIsUpdating(false);
    }
    if (shouldFetch && hockeyPendingSyncRef.current === 0) {
      // Background refresh — do not block scoring UI on this round-trip.
      void fetchGame();
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(
          `[HockeyACK] post-fetch pending remaining=${hockeyPendingActionsRef.current.length}:`,
          hockeyPendingActionsRef.current.map((a) => `${a.type}:${a.id}`).join(", "),
        );
      }
    }
  }, [fetchGame, setIsUpdating]);

  const scheduleHockeyPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    // Only block the scoring UI for undo. Event scoring must feel optimistic
    // (update UI first, sync API in background) like football/liveGame sports.
    const blockUi = action?.type === "undo";
    if (blockUi) setIsUpdating(true);
    hockeyPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;

      if (hockeyCancelledPersistIdsRef.current.has(action.id)) {
        hockeyCancelledPersistIdsRef.current.delete(action.id);
        hockeyCancelledUndoTeamIdRef.current.delete(action.id);
        shouldFetch = false;
      } else {
        try {
          await persistFn();

          if (hockeyCancelledPersistIdsRef.current.has(action.id)) {
            hockeyCancelledPersistIdsRef.current.delete(action.id);
            const undoTeamId = hockeyCancelledUndoTeamIdRef.current.get(action.id);
            hockeyCancelledUndoTeamIdRef.current.delete(action.id);
            hockeyPendingActionsRef.current = hockeyPendingActionsRef.current.filter(
              (pendingAction) => pendingAction.id !== action.id,
            );
            if (action.type === "event") {
              await removeLastEventAPI(gameId, undoTeamId ? { teamId: undoTeamId } : undefined);
            }
          }
        } catch (error) {
          shouldFetch = false;
          hockeyPendingActionsRef.current = hockeyPendingActionsRef.current.filter(
            (pendingAction) => pendingAction.id !== action.id,
          );

          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.log(
              `[HockeyACK] persist FAILED for action ${action.id} (${action.type}) — rolling back.`,
              `remainingPending=${hockeyPendingActionsRef.current.length}`,
              `serverSnapshotCards=${hockeyServerSnapshotRef.current?.sport?.activeSuspensions?.filter(s => s.isActive)?.length ?? "?"}`,
            );
          }

          const serverSnapshot = hockeyServerSnapshotRef.current
            ? cloneGameSnapshot(hockeyServerSnapshotRef.current)
            : null;
          if (serverSnapshot && setCurrentGame) {
            setCurrentGame(replayPendingHockeyActions(
              serverSnapshot,
              hockeyPendingActionsRef.current,
              getHockeyReplayOptions(serverSnapshot),
            ));
          } else {
            void fetchGame();
          }

          const message = error?.response?.data?.error || "Hockey event failed";
          showToast(`Sync failed: ${message}. Score refreshed from server.`, "error", "top");
        }
      }

      await finishHockeyPersist(shouldFetch, { blockUi });
    };

    hockeyPersistChainRef.current = hockeyPersistChainRef.current.then(persist, persist);
  }, [fetchGame, finishHockeyPersist, gameId, getHockeyReplayOptions, setCurrentGame, setIsUpdating]);

  const buildFootballEventPayload = useCallback((gameState, eventType, teamSide, selectedPlayerId, extraData = {}) => {
    const base = gameState?.base;
    const sportData = gameState?.sport || {};
    if (!base) return null;

    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const selectedPlayer = selectedPlayerId
      ? all.find((player) => String(player._id || player.id) === String(selectedPlayerId))
      : null;

    const payload = {
      eventType,
      playerId: selectedPlayerId || `team_${tId}`,
      teamId: tId,
      playerName: selectedPlayer ? formatName(selectedPlayer) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      minute: gameTime?.minutes ?? sportData?.currentMinute ?? 0,
      second: gameTime?.seconds ?? sportData?.currentSecond ?? 0,
      period: sportData?.currentHalf || sportData?.currentPeriod || 1,
      timestamp: extraData?.timestamp || new Date().toISOString(),
      ...extraData,
    };

    if (payload.relatedPlayerId === undefined && extraData.assistPlayerId) {
      payload.relatedPlayerId = extraData.assistPlayerId;
    }
    if (extraData.isShootoutPenalty !== undefined) {
      payload.isShootoutPenalty = !!extraData.isShootoutPenalty;
    }
    if (extraData.secondYellow !== undefined) {
      payload.isSecondYellow = !!extraData.secondYellow;
    }

    return payload;
  }, [gameTime, players, teamNames]);

  const buildBasketballEventPayload = useCallback((gameState, eventType, teamSide, selectedPlayerId, extraData = {}) => {
    const base = gameState?.base;
    const sportData = gameState?.sport || {};
    if (!base) return null;

    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const selectedPlayer = selectedPlayerId
      ? all.find((player) => String(player._id || player.id) === String(selectedPlayerId))
      : null;

    return {
      eventType,
      playerId: selectedPlayerId || `team_${tId}`,
      teamId: tId,
      playerName: selectedPlayer ? formatName(selectedPlayer) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      quarter: extraData?.quarter ?? sportData?.currentQuarter ?? 1,
      gameTime: extraData?.gameTime || `${String(gameTime?.minutes || 0).padStart(2, "0")}:${String(gameTime?.seconds || 0).padStart(2, "0")}`,
      timestamp: extraData?.timestamp || new Date().toISOString(),
      ...extraData,
    };
  }, [players, teamNames, gameTime]);

  const canManageVolleyballSide = useCallback(
    (side) => isOwner && (isSelfOwnedOpponent || side === userSide),
    [isOwner, isSelfOwnedOpponent, userSide],
  );

  const ensureVolleyballSideAccess = useCallback(
    (side) => {
      if (canManageVolleyballSide(side)) return true;
      Alert.alert("Not allowed", "You can only manage your own team in this shared match.");
      return false;
    },
    [canManageVolleyballSide],
  );

  const canManageHockeySide = useCallback(
    (side) => isOwner && (isSelfOwnedOpponent || side === userSide),
    [isOwner, isSelfOwnedOpponent, userSide],
  );

  const ensureHockeySideAccess = useCallback(
    (side) => {
      if (canManageHockeySide(side)) return true;
      Alert.alert("Not allowed", "You can only manage your own team in this shared match.");
      return false;
    },
    [canManageHockeySide],
  );

  const buildVolleyballEventPayload = useCallback((gameState, eventType, teamSide) => {
    const base = gameState?.base;
    const sportData = gameState?.sport || {};
    if (!base) return null;

    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const scoringEvents = ["point", "serve_ace", "attack_kill", "block_point"];
    const errorEvents = ["serve_error", "attack_error", "fault"];
    const servingTeamId = sportData?.servingTeam;
    const servingTeamSide = servingTeamId
      ? (String(servingTeamId) === String(base.teamId) ? "home" : "away")
      : "home";
    let scoringTeamSide = teamSide;
    if (errorEvents.includes(eventType)) {
      scoringTeamSide = teamSide === "home" ? "away" : "home";
    }
    const serveChanges = (scoringEvents.includes(eventType) || errorEvents.includes(eventType))
      ? scoringTeamSide !== servingTeamSide
      : false;

    let rep = null;
    const lineup = teamSide === "home" ? (sportData?.homeLineup || []) : (sportData?.awayLineup || []);
    const rotation = teamSide === "home" ? (sportData?.homeRotation || 1) : (sportData?.awayRotation || 1);
    if (lineup.length >= 6) {
      if (eventType === "serve_ace" || eventType === "service_ace") {
        rep = lineup.find((player) => Number(player?.rotation) === Number(rotation));
      } else if (eventType === "attack_kill" || eventType === "kill") {
        const attackRotation = ((rotation + 2) % 6) || 6;
        rep = lineup.find((player) => Number(player?.rotation) === Number(attackRotation));
      } else if (eventType === "block_point") {
        const blockRotation = ((rotation + 1) % 6) || 6;
        rep = lineup.find((player) => Number(player?.rotation) === Number(blockRotation));
      }
      if (!rep) {
        rep = lineup.find((player) => Number(player?.rotation) === Number(rotation));
      }
    }
    if (!rep) {
      rep = ((players?.[teamSide] || []).filter(Boolean))[0];
    }

    let playerName = "Team";
    if (rep) {
      if (rep.playerName) {
        playerName = rep.playerName;
      } else if (rep.playerId) {
        const rosterPlayer = (players?.[teamSide] || []).find(
          (player) => String(player?._id || player?.id) === String(rep.playerId),
        );
        playerName = rosterPlayer ? formatName(rosterPlayer) : "Team";
      } else {
        playerName = formatName(rep);
      }
    }

    return {
      eventType,
      playerId: rep?.playerId || rep?._id || rep?.id || `team_${tId}`,
      teamId: tId,
      playerName,
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      setNumber: sportData?.currentSet || 1,
      set: sportData?.currentSet || 1,
      homeScore: sportData?.homeScore || 0,
      awayScore: sportData?.awayScore || 0,
      isRallyPoint: scoringEvents.includes(eventType) || errorEvents.includes(eventType),
      serveChanges,
      scoringTeamId: scoringTeamSide === "home" ? base.teamId : base.opponentTeamId,
      servingTeam: servingTeamId,
      homeRotation: sportData?.homeRotation || 1,
      awayRotation: sportData?.awayRotation || 1,
      source: "mobile_scoring_panel",
      operatorTeamId: teamId,
      timestamp: new Date().toISOString(),
    };
  }, [players, teamId, teamNames]);

  // ── Hydrate Hockey live events from backend ──
  useEffect(() => {
    if ((sport !== "Hockey" && sport !== "IceHockey") || !currentGame?.sport?.events?.length) return;
    const eventsKey = currentGame.sport.events.length + "-" + gameId;
    if (hockeyEventsHydratedRef.current === eventsKey) return;
    hockeyEventsHydratedRef.current = eventsKey;

    const homeTeamId = currentGame.base?.teamId;
    const allPlayers = [...(players.home || []), ...(players.away || [])];
    const resolveName = (pid) => {
      if (!pid) return "";
      const p = allPlayers.find((pl) => String(pl._id) === String(pid) || String(pl.id) === String(pid));
      return p ? formatName(p) : "";
    };
    const mapped = currentGame.sport.events
      .filter((ev) => ev && !["undo", "possession_change"].includes(ev.eventType))
      .slice(-10).reverse()
      .map((ev) => ({
        _id: ev._id,
        eventType: ev.eventType,
        teamSide: String(ev.teamId) === String(homeTeamId) ? "home" : "away",
        playerName: resolveName(ev.playerId),
        goalType: ev.goalType || null,
        teamName: String(ev.teamId) === String(homeTeamId) ? teamNames.home : teamNames.away,
        gameTime: ev.gameTime || "",
        timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "",
      }));
    if (mapped.length > 0) {
      setLiveEvents((prev) => (prev.length === 0 || prev[0]?._id !== mapped[0]?._id ? mapped : prev));
    }
  }, [sport, currentGame?.sport?.events, gameId, players, teamNames]);

  // ── Show toss modal when Cricket game goes live ──
  useEffect(() => {
    if (sport === "Cricket" && currentGame?.sport && isOwner) {
      const sportData = currentGame.sport;
      if (!sportData.toss?.winner && !tossModalShownRef.current && currentGame?.base?.status === "live") {
        tossModalShownRef.current = true;
        if (!sportData.totalOvers || sportData.totalOvers === 20) {
          setOversSelection((prev) => ({ ...prev, showModal: true }));
        } else {
          setTossSelection((prev) => ({ ...prev, showSelection: true }));
        }
      }
    }
  }, [sport, isOwner, currentGame?.sport?.toss?.winner, currentGame?.base?.status]);

  // Close out a basketball quarter. This rides the same batch queue the scoring
  // panel uses rather than the one-off event endpoint: that queue is what the
  // panel reads back from, so the new quarter appears immediately, and it
  // retries on its own instead of silently dropping the transition.
  const advanceBasketballQuarter = useCallback((completedQuarter) => {
    const base = currentGame?.base;
    if (!base || !gameId) return;

    const side = userSide === "away" ? "away" : "home";
    const teamId = side === "away" ? base.opponentTeamId : base.teamId;
    const body = {
      eventType: "quarter_transition",
      teamSide: side,
      teamId,
      // Team-level basketball events use this placeholder rather than a real
      // player, matching how the scoring panel logs "TEAM" actions.
      playerId: `team_${teamId}`,
      quarter: completedQuarter,
      homeTeamName: teamNames?.home || "",
      awayTeamName: teamNames?.away || "",
      timestamp: new Date().toISOString(),
    };

    store.dispatch(
      enqueueEvent({ gameId, event: createEvent({ type: LEGACY.BASKETBALL, payload: { body } }) }),
    );
  }, [currentGame?.base, gameId, teamNames?.home, teamNames?.away, userSide]);

  // ── Auto quarter transition for Basketball at 00:00 ──
  // The clock stops itself the moment it reaches zero, so we cannot rely on
  // observing a render where it is both running and at 00:00 — that frame is
  // easily lost to a socket timer snapshot, an app backgrounding, or a resume
  // that immediately re-pauses at zero, and losing it used to strand the game
  // in the same quarter forever. Instead we arm the quarter while the clock is
  // ticking and close it as soon as it reads 00:00, running or not.
  useEffect(() => {
    if (sport !== "Basketball" || !isOwner) return;
    if (currentGame?.base?.status !== "live") return;

    const quarter = Math.max(
      1,
      Number(currentGame?.sport?.currentQuarter) || 1,
      basketballQuarterFloorRef.current,
    );
    const { action } = resolveBasketballClockAction({
      quarter,
      remainingSeconds: (Number(gameTime.minutes) || 0) * 60 + (Number(gameTime.seconds) || 0),
      isRunning: gameTime.isRunning,
      armedQuarter: basketballQuarterArmedRef.current,
      endedQuarter: basketballAutoQuarterEndRef.current,
    });

    if (action === "arm") {
      basketballQuarterArmedRef.current = quarter;
      return;
    }
    if (action !== "end") return;

    basketballAutoQuarterEndRef.current = quarter;
    basketballQuarterFloorRef.current = quarter + 1;

    const quarterMinutes = Math.max(
      1,
      Number(currentGame?.sport?.rules?.quarterMinutes) || 10,
    );

    setGameTime((p) => {
      const stopped = { ...p, isRunning: false };
      syncTimerNow?.(stopped, {
        timerReason: "basketball_quarter_end",
        periodNumber: quarter,
      });
      return stopped;
    });

    advanceBasketballQuarter(quarter);

    setTimeout(() => {
      const reset = { minutes: quarterMinutes, seconds: 0, isRunning: false };
      setGameTime(reset);
      syncTimerNow?.(reset);
    }, 3000);
  }, [
    sport,
    gameTime.minutes,
    gameTime.seconds,
    gameTime.isRunning,
    isOwner,
    currentGame?.base?.status,
    currentGame?.sport?.currentQuarter,
    currentGame?.sport?.rules?.quarterMinutes,
    advanceBasketballQuarter,
    setGameTime,
    syncTimerNow,
  ]);

  // ── Start / End Game ──
  const handleStartGame = async (startData = {}) => {
    if (!isOwner || !gameId) return;
    setIsUpdating(true);
    try {
      await startGameAPI(gameId, startData);
      await fetchGame();
      let newTimer;
      if (sport === "Hockey") {
        const hockeyFormat = getHockeyMatchFormat({ ...currentGame?.sport, matchFormat: startData?.hockeyMatchFormat || currentGame?.sport?.matchFormat });
        newTimer = { minutes: hockeyFormat.periodDurationMinutes, seconds: 0, isRunning: false };
      }
      else if (sport === "IceHockey") newTimer = { minutes: 20, seconds: 0, isRunning: false };
      else if (sport === "Basketball") {
        const quarterMinutes = Math.max(
          1,
          Number(currentGame?.sport?.rules?.quarterMinutes) || 10,
        );
        newTimer = { minutes: quarterMinutes, seconds: 0, isRunning: false };
      }
      else                        newTimer = { minutes: 0,  seconds: 0, isRunning: false };
      setGameTime(newTimer);
      syncTimerNow?.(newTimer); // broadcast paused state to all viewers immediately
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || "Failed to start");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleHockeySetupLineup = useCallback(async ({ hockeyLineups } = {}) => {
    if (!gameId || !isOwner || isUpdating) return;
    const submittedSides = ["home", "away"].filter((side) => hockeyLineups?.[side]);
    if (submittedSides.length === 0) return;
    if (!submittedSides.every((side) => ensureHockeySideAccess(side))) return;

    setIsUpdating(true);
    try {
      await updateHockeyLineupAPI(gameId, { hockeyLineups });
      await fetchGame();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.response?.data?.message || "Failed to save hockey lineup");
    } finally {
      setIsUpdating(false);
    }
  }, [ensureHockeySideAccess, fetchGame, gameId, isOwner, isUpdating, setIsUpdating]);

  const handleEndGame = async () => {
    if (!isOwner) return;
    let h, a;
    let winnerPayload = "draw";
    let resultType = "completed";

    if (sport === "Chess") {
      const outcome = resolveChessOutcome(currentGame?.sport || {});
      h = outcome.winner === "home" ? 1 : outcome.winner === "away" ? 0 : 0.5;
      a = outcome.winner === "away" ? 1 : outcome.winner === "home" ? 0 : 0.5;
      if (outcome.winner === "home") winnerPayload = currentGame.base.teamId;
      else if (outcome.winner === "away") winnerPayload = currentGame.base.opponentTeamId;
      else {
        winnerPayload = "draw";
        resultType = "tie";
      }
    } else if (sport === "Cricket") {
      const matchResult = getCricketMatchResult(currentGame);
      if (matchResult.needsSuperOver) {
        Alert.alert(
          "Super Over required",
          "Scores are tied. Start and complete the Super Over before ending the match.",
        );
        return;
      }
      h = currentGame?.sport?.score?.home || 0;
      a = currentGame?.sport?.score?.away || 0;
      if (matchResult.finished && matchResult.winnerTeamId) {
        winnerPayload = matchResult.winnerTeamId;
        resultType = "win";
      } else if (matchResult.finished && matchResult.tie) {
        winnerPayload = "draw";
        resultType = "tie";
      } else if (h > a) {
        winnerPayload = currentGame.base.teamId;
      } else if (a > h) {
        winnerPayload = currentGame.base.opponentTeamId;
      } else {
        winnerPayload = "draw";
        resultType = "tie";
      }
    } else if (sport === "Pickleball") {
      const s = currentGame?.sport;
      const gScores = s?.gameScores || [];
      if (gScores.length > 0) {
        h = s?.score?.home || 0;
        a = s?.score?.away || 0;
      } else {
        h = s?.currentPointScore?.player1 || 0;
        a = s?.currentPointScore?.player2 || 0;
      }
      if (h > a) winnerPayload = currentGame.base.teamId;
      else if (a > h) winnerPayload = currentGame.base.opponentTeamId;
      else {
        winnerPayload = "draw";
        resultType = "tie";
      }
    } else {
      h = currentGame?.sport?.score?.home || currentGame?.sport?.homeScore || 0;
      a = currentGame?.sport?.score?.away || currentGame?.sport?.awayScore || 0;
      if (h > a) winnerPayload = currentGame.base.teamId;
      else if (a > h) winnerPayload = currentGame.base.opponentTeamId;
      else {
        winnerPayload = "draw";
        resultType = "tie";
      }
    }
    setIsUpdating(true);
    try {
      await endGameAPI(gameId, {
        winner: winnerPayload === "draw" ? "draw" : winnerPayload,
        resultType,
        margin: Math.abs((h || 0) - (a || 0)),
        finalScore: { home: h, away: a },
      });
      setGameTime((p) => {
        const stopped = { ...p, isRunning: false };
        syncTimerNow?.(stopped);
        return stopped;
      });
      await fetchGame();
    } catch {
      Alert.alert("Error", "Failed to end game");
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Hockey ──
  const handleHockeyEvent = useCallback((eventType, teamSide, playerId, extraData = {}) => {
    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame || !gameId || !isOwner || gameOver) return;
    const isGameLevelEvent = eventType === "undo" || eventType === "period_end";
    if (!isSelfOwnedOpponent && !isGameLevelEvent && teamSide !== userSide) return;
    if (eventType === "period_end") {
      const hockeyFormat = getHockeyMatchFormat(latestGame?.sport);
      const t = { minutes: hockeyFormat.periodDurationMinutes, seconds: 0, isRunning: false };
      setGameTime(t);
      syncTimerNow?.(t);
    }

    if (eventType === "undo") {
      const base = latestGame.base;
      const effectiveSide = teamSide || (!isSelfOwnedOpponent ? userSide : null);
      const undoTeamId = effectiveSide
        ? (effectiveSide === "home" ? base.teamId : base.opponentTeamId)
        : undefined;

      const replayOptions = getHockeyReplayOptions(latestGame);
      const peek = applyOptimisticHockeyUndo(latestGame, { teamSide: effectiveSide, ...replayOptions });
      if (!peek.removedEvent) return;

      logHockeyCardDebug("undo.target", {
        fingerprint: getHockeyEventLooseFingerprint(peek.removedEvent),
        eventType: peek.removedEvent.eventType,
        playerId: peek.removedEvent.playerId,
        cardHistory: (latestGame?.sport?.events || [])
          .filter((e) => ["green_card", "yellow_card", "red_card"].includes(e?.eventType))
          .map((e) => e.eventType),
      });

      const matchesPendingEvent = (event, pendingAction) => {
        const payload = pendingAction?.payload;
        if (!event || !payload) return false;
        if (event._optimisticId && event._optimisticId === pendingAction.id) return true;
        return (
          event.eventType === payload.eventType
          && String(event.teamId || "") === String(payload.teamId || "")
          && String(event.playerId || "") === String(payload.playerId || "")
        );
      };

      const pendingEventAction = [...hockeyPendingActionsRef.current]
        .reverse()
        .find((pendingAction) => pendingAction.type === "event");

      // Card still saving — cancel that persist (and undo on server if it already landed).
      if (pendingEventAction && matchesPendingEvent(peek.removedEvent, pendingEventAction)) {
        hockeyCancelledPersistIdsRef.current.add(pendingEventAction.id);
        if (undoTeamId) {
          hockeyCancelledUndoTeamIdRef.current.set(pendingEventAction.id, undoTeamId);
        }
        hockeyPendingActionsRef.current = hockeyPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== pendingEventAction.id,
        );
        suppressHockeyEvent(peek.removedEvent);
        setCurrentGame(peek.nextGame);
        if (currentGameRef) {
          currentGameRef.current = peek.nextGame;
        }
        return;
      }

      const optimisticId = `hockey-undo-${Date.now()}-${(hockeyClientEventSeqRef.current += 1)}`;
      const action = { id: optimisticId, type: "undo", teamSide: effectiveSide };

      // ── CRITICAL: mutate pending ref BEFORE setCurrentGame ──────────────────
      hockeyPendingActionsRef.current = [...hockeyPendingActionsRef.current, action];

      let didUndo = false;
      setCurrentGame((prev) => {
        const { nextGame, removedEvent } = applyOptimisticHockeyUndo(prev, {
          teamSide: effectiveSide,
          ...replayOptions,
        });
        if (!removedEvent) {
          hockeyPendingActionsRef.current = hockeyPendingActionsRef.current.filter(
            (pendingAction) => pendingAction.id !== action.id,
          );
          return prev;
        }

        suppressHockeyEvent(removedEvent);

        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log(
            `[HockeyUndo] removing event: ${removedEvent.eventType} player=${removedEvent.playerId} team=${removedEvent.teamSide || "?"}`,
            `pendingAfterAdd=${hockeyPendingActionsRef.current.length}`,
            `undoTeamId=${undoTeamId || "any"}`,
          );
        }

        didUndo = true;
        return nextGame;
      });

      if (didUndo) {
        scheduleHockeyPersist(
          action,
          async () => {
            const response = await removeLastEventAPI(gameId, undoTeamId ? { teamId: undoTeamId } : undefined);
            const removed = response?.data?.removedEvent || response?.removedEvent;
            if (removed) {
              suppressHockeyEvent(removed);
              logHockeyCardDebug("undo.ack", {
                removed: getHockeyEventLooseFingerprint(removed),
                removedType: removed.eventType,
              });
            }
            return response;
          },
        );
      }
      return;
    }

    const base = latestGame.base;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const finalPlayerId = playerId || null;
    let playerName = null;
    if (finalPlayerId) {
      const p = [...(players.home || []), ...(players.away || [])].find(
        (pl) => String(pl._id) === String(playerId) || String(pl.id) === String(playerId)
      );
      playerName = p ? formatName(p) : null;
    }

    const optimisticId = `hockey-${Date.now()}-${(hockeyClientEventSeqRef.current += 1)}`;
    const baselineEventCount = hockeyServerSnapshotRef.current?.sport?.events?.length
      ?? latestGame?.sport?.events?.filter((event) => !event?._optimisticId)?.length
      ?? 0;
    const eventPayload = {
      _optimisticId: optimisticId,
      clientEventId: optimisticId,
      eventType, playerId: finalPlayerId, teamId: tId, playerName,
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home, awayTeamName: teamNames.away,
      teamSide,
      quarter: latestGame?.sport?.currentQuarter || latestGame?.sport?.currentPeriod || 1,
      period: latestGame?.sport?.currentQuarter || latestGame?.sport?.currentPeriod || 1,
      gameTime: `${String(gameTime.minutes).padStart(2, "0")}:${String(gameTime.seconds).padStart(2, "0")}`,
      outPlayerId: extraData?.outPlayerId || null,
      inPlayerId: extraData?.inPlayerId || null,
      // Card events: carry the original wall-clock issue time so replay never
      // resets suspensionStartedAt to Date.now() and briefly resurrects the card.
      ...(extraData?.suspensionStartedAt && { suspensionStartedAt: extraData.suspensionStartedAt }),
      rosterSnapshot: {
        homePlayerIds: (players.home || []).map((player) => player?._id || player?.id).filter(Boolean),
        awayPlayerIds: (players.away || []).map((player) => player?._id || player?.id).filter(Boolean),
      },
    };

    const action = {
      id: optimisticId,
      type: "event",
      payload: eventPayload,
      baselineEventCount,
    };
    // ── CRITICAL: mutate pending ref BEFORE setCurrentGame (see undo handler comment) ──
    hockeyPendingActionsRef.current = [...hockeyPendingActionsRef.current, action];
    setCurrentGame((prev) => {
      const next = applyOptimisticHockeyUpdate(
        prev,
        eventPayload,
        getHockeyReplayOptions(prev),
      );
      if (currentGameRef) currentGameRef.current = next;
      return next;
    });
    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;
    scheduleHockeyPersist(action, () => addGameEventAPI(gameId, persistPayload));
  }, [currentGame, currentGameRef, gameId, getHockeyReplayOptions, isOwner, gameOver, isSelfOwnedOpponent, players, suppressHockeyEvent, teamNames, gameTime, userSide, setCurrentGame, scheduleHockeyPersist, syncTimerNow]);

  // ── Ice Hockey ──
  const handleIceHockeyEvent = useCallback((eventType, teamSide, playerId, extraData = {}) => {
    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame || !gameId || !isOwner || gameOver) return;

    const isGameLevelEvent = eventType === "undo" || eventType === "period_break";
    if (!isSelfOwnedOpponent && !isGameLevelEvent && teamSide !== userSide) return;

    if (eventType === "undo") {
      iceHockeyPendingSyncRef.current += 1;
      setLiveEvents(prev => prev.slice(1));
      const persistUndo = async () => {
        try {
          await removeLastEventAPI(gameId);
        } catch (error) {
          Alert.alert("Undo Failed", error?.response?.data?.error || "Nothing to undo");
        } finally {
          await finishIceHockeyPersist(true);
        }
      };
      iceHockeyPersistChainRef.current = iceHockeyPersistChainRef.current.then(persistUndo, persistUndo);
      return;
    }

    if (eventType === "period_break") {
      const t = { minutes: 20, seconds: 0, isRunning: false };
      setGameTime(t);
      syncTimerNow?.(t);
    }

    const base = currentGame.base;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const finalPlayerId = playerId || null;
    const selectedPlayer = finalPlayerId
      ? [...(players.home || []), ...(players.away || [])].find(
          pl => String(pl._id) === String(finalPlayerId) || String(pl.id) === String(finalPlayerId)
        )
      : null;
    const playerName = selectedPlayer ? formatName(selectedPlayer) : null;

    if (ICE_HOCKEY_PLAYER_REQUIRED_EVENTS.has(eventType) && !finalPlayerId) {
      Alert.alert(
        "Player required",
        eventType === "goal" ? "Select the goal scorer before recording a goal." : "Select the penalized player before recording a penalty.",
      );
      return;
    }

    const clock = formatClockPayload(gameTime);
    const enrichedExtraData = { ...extraData };
    const rosterSnapshot = enrichedExtraData.rosterSnapshot || buildIceHockeyRosterSnapshot(players);
    const onIceSnapshot = enrichedExtraData.onIceSnapshot || buildIceHockeyOnIceSnapshot(latestGame?.sport, players);
    if ((eventType === "goal" || eventType === "shot_on_goal") && !enrichedExtraData.goalieId) {
      const goalieSide = teamSide === "home" ? "away" : "home";
      const snapshotGoalieId = onIceSnapshot?.[goalieSide]?.goalieId;
      const goalie = snapshotGoalieId
        ? [...(players.home || []), ...(players.away || [])].find(
            (player) => String(playerIdOf(player)) === String(snapshotGoalieId),
          )
        : findLikelyIceHockeyGoalie(players?.[goalieSide] || []);
      if (goalie || snapshotGoalieId) {
        enrichedExtraData.goalieId = snapshotGoalieId || goalie._id || goalie.id;
        enrichedExtraData.goalieTeamId = goalieSide === "home" ? base.teamId : base.opponentTeamId;
        enrichedExtraData.goalieName = goalie ? formatName(goalie) : null;
      }
    }

    const optimisticId = `ice-hockey-${Date.now()}-${iceHockeyClientEventSeqRef.current += 1}`;
    const eventPayload = {
      _optimisticId: optimisticId,
      eventType,
      playerId: finalPlayerId,
      teamId: tId,
      playerName,
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      period: latestGame?.sport?.currentPeriod || 1,
      gameTime: clock,
      rosterSnapshot,
      onIceSnapshot,
      ...enrichedExtraData,
    };
    if (["line_change", "goalie_pulled", "goalie_return"].includes(eventType)) {
      eventPayload._previousOnIce = latestGame?.sport?.onIce || null;
    }
    if (eventType === "period_break") {
      eventPayload._previousPeriodState = {
        currentPeriod: latestGame?.sport?.currentPeriod,
        periodTime: latestGame?.sport?.periodTime,
        isOvertime: latestGame?.sport?.isOvertime,
        isShootout: latestGame?.sport?.isShootout,
        matchStatus: latestGame?.sport?.matchStatus,
        result: latestGame?.sport?.result,
      };
    }

    setCurrentGame?.((prev) => applyOptimisticIceHockeyUpdate(prev, eventPayload));
    if (!["period_break", "possession_change"].includes(eventType)) {
      setLiveEvents(prev => [{
        _id: optimisticId,
        _optimisticId: optimisticId,
        pending: true,
        eventType, teamSide, playerName,
        goalType: enrichedExtraData.goalType || null,
        teamName: teamSide === "home" ? teamNames.home : teamNames.away,
        gameTime: clock,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev.slice(0, 9)]);
    }
    scheduleIceHockeyPersist(eventPayload);
  }, [
    currentGame,
    currentGameRef,
    finishIceHockeyPersist,
    gameId,
    isOwner,
    gameOver,
    isSelfOwnedOpponent,
    players,
    teamNames,
    gameTime,
    setCurrentGame,
    setGameTime,
    syncTimerNow,
    scheduleIceHockeyPersist,
    userSide,
  ]);

  // ── Football ──
  const handleFootballEvent = useCallback(async (eventType, teamSide, selectedPlayerId, extraData = {}) => {
    if (!currentGame || !gameId || !isOwner || gameOver) return;
    // In split-owner mode, only allow events for user's own side
    if (!isSelfOwnedOpponent && teamSide !== userSide) return;
    if (!isOnline || !setCurrentGame) {
      if (isUpdating) return;
      const eventPayload = buildFootballEventPayload(currentGame, eventType, teamSide, selectedPlayerId, extraData);
      if (!eventPayload) return;

      setIsUpdating(true);
      try {
        const apiCall = () => addGameEventAPI(gameId, eventPayload);
        if (queueOrFire && !isOnline) {
          const result = await queueOrFire(apiCall, `${String(eventType).replace(/_/g, " ")} (${teamSide})`);
          if (result !== null) await fetchGame();
        } else {
          await apiCall();
          await fetchGame();
        }
      } catch {
        Alert.alert("Error", "Event failed");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    let action = null;
    setCurrentGame((prev) => {
      const eventPayload = buildFootballEventPayload(prev, eventType, teamSide, selectedPlayerId, extraData);
      if (!eventPayload) return prev;

      const optimisticId = `football-${Date.now()}-${(footballClientEventSeqRef.current += 1)}`;
      const payload = {
        ...eventPayload,
        clientEventId: optimisticId,
        _optimisticId: optimisticId,
      };
      const nextGame = applyOptimisticFootballUpdate(prev, payload);
      const optimisticEvent = nextGame?.sport?.events?.[nextGame.sport.events.length - 1] || payload;
      action = {
        id: optimisticId,
        type: "event",
        payload: optimisticEvent,
      };
      footballPendingActionsRef.current = [...footballPendingActionsRef.current, action];
      return nextGame;
    });

    if (!action?.payload) return;

    scheduleFootballPersist(action, () => {
      const payload = { ...action.payload };
      delete payload._optimisticId;
      delete payload._id;
      delete payload.optimistic;
      return addGameEventAPI(gameId, payload);
    });
  }, [buildFootballEventPayload, currentGame, fetchGame, gameOver, gameId, isOnline, isOwner, isSelfOwnedOpponent, isUpdating, queueOrFire, scheduleFootballPersist, setCurrentGame, setIsUpdating, userSide]);

  // ── Football Undo ──
  const handleFootballUndo = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner) return;
    const events = currentGame?.sport?.events || [];
    const base = currentGame?.base;

    let latestEvent = null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event && event.eventType !== "undo") {
        latestEvent = event;
        break;
      }
    }

    const undoSide = isSelfOwnedOpponent ? null : userSide;
    const undoTeamId = undoSide && base
      ? (undoSide === "home" ? base.teamId : base.opponentTeamId)
      : null;
    const canUndoLatestEvent = latestEvent && (!undoTeamId || String(latestEvent.teamId) === String(undoTeamId));

    if (!canUndoLatestEvent) {
      Alert.alert(
        "Nothing to undo",
        undoTeamId ? "No recent events to undo for your team." : "No events recorded yet.",
      );
      return;
    }

    if (!isOnline || !setCurrentGame) {
      if (isUpdating) return;
      setIsUpdating(true);
      try {
        await removeLastEventAPI(gameId, undoTeamId ? { teamId: undoTeamId } : undefined);
        await fetchGame();
      } catch {
        Alert.alert("Error", "Undo failed");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    let action = null;
    setCurrentGame((prev) => {
      const result = applyOptimisticFootballUndo(prev, { teamSide: undoSide });
      if (!result?.removedEvent) return prev;

      const optimisticId = `football-undo-${Date.now()}-${(footballClientEventSeqRef.current += 1)}`;
      action = {
        id: optimisticId,
        type: "undo",
        teamSide: undoSide,
      };
      footballPendingActionsRef.current = [...footballPendingActionsRef.current, action];
      return result.nextGame;
    });

    if (!action) return;

    const undoApiOptions = undoTeamId ? { teamId: undoTeamId } : undefined;
    scheduleFootballPersist(action, async () => {
      const first = await removeLastEventAPI(gameId, undoApiOptions);
      const removed = first?.removedEvent || first?.data?.removedEvent;
      const shouldCascade =
        removed?.eventType === "red_card"
        && (removed?.reason === "second_yellow" || removed?.isSecondYellow === true);
      if (shouldCascade) {
        await removeLastEventAPI(gameId, undoApiOptions);
      }
      return first;
    });
  }, [currentGame, fetchGame, gameId, isOnline, isOwner, isSelfOwnedOpponent, isUpdating, scheduleFootballPersist, setCurrentGame, setIsUpdating, userSide]);

  const buildFootballLineupPayload = useCallback((starters, bench, formation) => {
    const formationLabel = formation ? String(formation) : "4-3-3";
    // Place XI into real formation slots (LB/CB/RB…) instead of leaving generic roster roles
    const placedStarters = applyFormationPositionsToStarters(starters, formationLabel);
    const toSlot = (player) => ({
      playerId: String(player._id || player.id || player.playerId),
      playerName: [player.firstName, player.lastName].filter(Boolean).join(" ").trim() || player.playerName,
      position: player.position || null,
      slotKey: player.slotKey || null,
      jerseyNumber: player.jerseyNumber ?? player.number ?? null,
      isGoalkeeper:
        player.position === "Goalkeeper"
        || player.position === "GK"
        || player.slotKey === "GK"
        || !!player.isGoalkeeper,
    });
    return {
      starters: placedStarters.map(toSlot),
      bench: bench.map(toSlot),
      formation: formationLabel,
    };
  }, []);

  const getFootballOtherSideToSetup = useCallback((savedSide) => {
    if (!isSelfOwnedOpponent) return null;
    const otherSide = savedSide === "home" ? "away" : "home";
    const rosterCount = (players?.[otherSide] || []).filter((p) => p && p.role !== "manager").length;
    if (rosterCount <= 11) return null;
    const sportState = currentGameRef?.current?.sport || currentGame?.sport;
    const otherLineup = otherSide === "home" ? sportState?.homeLineup : sportState?.awayLineup;
    const onFieldCount = Array.isArray(otherLineup)
      ? otherLineup.filter(
        (player) => !player.isSubstitute && (player.substitutionMinute == null || player.substitutionMinute === undefined),
      ).length
      : 0;
    if (onFieldCount === 11) return null;
    return otherSide;
  }, [currentGame?.sport, currentGameRef, isSelfOwnedOpponent, players]);

  const handleFootballSetupLineup = useCallback(async ({ side, starters, bench = [], formation } = {}) => {
    if (!gameId || !isOwner || isUpdating) return { ok: false };
    if (!isSelfOwnedOpponent && side !== userSide) return { ok: false };
    if (!Array.isArray(starters) || starters.length !== 11) {
      Alert.alert("Invalid lineup", "Select exactly 11 starting players.");
      return { ok: false };
    }

    const payload = buildFootballLineupPayload(starters, bench, formation);

    if (setCurrentGame) {
      setCurrentGame((prev) => {
        if (!prev?.sport) return prev;
        const next = cloneGameSnapshot(prev);
        const lineupField = side === "home" ? "homeLineup" : "awayLineup";
        const formationField = side === "home" ? "homeFormation" : "awayFormation";
        const minute = gameTime?.minutes ?? prev.sport?.currentMinute ?? 0;
        next.sport[lineupField] = [
          ...payload.starters.map((slot) => ({
            ...slot,
            isSubstitute: false,
            startingMinute: 0,
            substitutionMinute: null,
          })),
          ...payload.bench.map((slot) => ({
            ...slot,
            isSubstitute: true,
            startingMinute: minute,
            substitutionMinute: null,
          })),
        ];
        if (payload.formation) next.sport[formationField] = payload.formation;
        if (currentGameRef) {
          currentGameRef.current = next;
        }
        return next;
      });
    }

    setIsUpdating(true);
    try {
      await updateFootballLineupAPI(gameId, { team: side, ...payload });
      await fetchGame();
      return { ok: true, nextSide: getFootballOtherSideToSetup(side) };
    } catch {
      await fetchGame();
      Alert.alert("Error", "Failed to save starting lineup");
      return { ok: false };
    } finally {
      setIsUpdating(false);
    }
  }, [
    buildFootballLineupPayload,
    fetchGame,
    gameId,
    gameTime?.minutes,
    currentGameRef,
    getFootballOtherSideToSetup,
    isOwner,
    isSelfOwnedOpponent,
    isUpdating,
    setCurrentGame,
    userSide,
  ]);

  // ── Football Substitution ──
  const handleFootballSubstitution = useCallback(async (teamSide, playerOutId, playerInId, lineupSnapshot = {}) => {
    if (!gameId || !isOwner || isUpdating) return;
    if (!isSelfOwnedOpponent && teamSide !== userSide) return;
    const base = currentGame?.base;
    if (!base) return;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const pOut = all.find(p => String(p._id || p.id) === String(playerOutId));
    const pIn = all.find(p => String(p._id || p.id) === String(playerInId));
    const minute = gameTime?.minutes ?? currentGame?.sport?.currentMinute ?? 0;
    const period = currentGame?.sport?.currentHalf || currentGame?.sport?.currentPeriod || 1;

    if (setCurrentGame) {
      setCurrentGame((prev) => {
        if (!prev?.sport) return prev;
        const next = cloneGameSnapshot(prev);
        const toLineupSlot = (player, isSubstitute) => {
          if (!player) return null;
          const playerId = String(player._id || player.id || player.playerId || "");
          if (!playerId) return null;
          return {
            playerId,
            position: player.position ?? null,
            slotKey: player.slotKey ?? null,
            jerseyNumber: player.jerseyNumber ?? player.number ?? null,
            isGoalkeeper: !!(player.isGoalkeeper || player.position === "GK" || player.slotKey === "GK"),
            isSubstitute,
            startingMinute: isSubstitute ? minute : 0,
            substitutionMinute: null,
          };
        };
        const bootstrapLineup = [
          ...(lineupSnapshot?.currentLineup || []).map((p) => toLineupSlot(p, false)),
          ...(lineupSnapshot?.benchLineup || []).map((p) => toLineupSlot(p, true)),
        ].filter(Boolean);
        applyFootballLineupSwap(next.sport, teamSide, playerOutId, playerInId, {
          minute,
          period,
          teamId: tId,
          bootstrapLineup,
        });
        return next;
      });
    }

    setIsUpdating(true);
    try {
      const apiRes = await makeSubstitutionAPI(gameId, {
        playerIn: playerInId,
        playerOut: playerOutId,
        teamId: tId,
        minute,
        period,
        playerOutName: pOut ? formatName(pOut) : "Player",
        playerInName: pIn ? formatName(pIn) : "Player",
        playerInJersey: pIn?.jerseyNumber ?? pIn?.number,
        playerInPosition: pIn?.position,
        currentLineup: lineupSnapshot?.currentLineup,
        benchLineup: lineupSnapshot?.benchLineup,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      const updatedSport = apiRes?.data?.game;
      if (updatedSport && setCurrentGame) {
        setCurrentGame((prev) => {
          if (!prev?.sport) return prev;
          return {
            ...prev,
            sport: {
              ...prev.sport,
              homeLineup: updatedSport.homeLineup ?? prev.sport.homeLineup,
              awayLineup: updatedSport.awayLineup ?? prev.sport.awayLineup,
              substitutions: updatedSport.substitutions ?? prev.sport.substitutions,
              events: updatedSport.events ?? prev.sport.events,
            },
          };
        });
      }
      await fetchGame();
    } catch {
      await fetchGame();
      Alert.alert("Error", "Substitution failed");
    }
    finally { setIsUpdating(false); }
  }, [gameId, isOwner, isUpdating, currentGame, players, teamNames, gameTime, fetchGame, isSelfOwnedOpponent, userSide, setCurrentGame]);

  const handleFootballMatchState = useCallback(async (matchStateData) => {
    if (!gameId || !isOwner || isUpdating) return;
    const currentSport = currentGame?.sport || {};
    const currentMinutes = gameTime?.minutes ?? currentSport?.currentMinute ?? 0;
    const currentSeconds = gameTime?.seconds ?? currentSport?.currentSecond ?? 0;
    const nextPeriod = matchStateData.currentPeriod ?? currentSport?.currentHalf ?? currentSport?.currentPeriod ?? 1;
    let nextTimerState = null;

    if (matchStateData.matchStatus === "half_time") {
      nextTimerState = {
        minutes: Math.max(45, currentMinutes),
        seconds: currentSeconds,
        isRunning: false,
      };
    } else if (matchStateData.matchStatus === "second_half") {
      nextTimerState = {
        minutes: Math.max(45, currentMinutes),
        seconds: currentSeconds,
        isRunning: true,
      };
    } else if (matchStateData.matchStatus === "extra_time") {
      const minimumMinute = nextPeriod >= 4 ? 105 : 90;
      nextTimerState = {
        minutes: Math.max(minimumMinute, currentMinutes),
        seconds: currentSeconds,
        isRunning: true,
      };
    } else if (matchStateData.matchStatus === "penalties") {
      nextTimerState = {
        minutes: Math.max(120, currentMinutes),
        seconds: currentSeconds,
        isRunning: false,
      };
    } else if (matchStateData.matchStatus === "finished") {
      nextTimerState = {
        minutes: currentMinutes,
        seconds: currentSeconds,
        isRunning: false,
      };
    }

    setIsUpdating(true);
    try {
      const payload = {
        ...matchStateData,
        ...(nextTimerState
          ? { currentMinute: nextTimerState.minutes, currentSecond: nextTimerState.seconds, currentPeriod: nextPeriod }
          : {}),
      };
      await updateFootballMatchStateAPI(gameId, payload);
      if (nextTimerState) {
        setGameTime(nextTimerState);
        syncTimerNow?.(nextTimerState);
      }
      await fetchGame();
    } catch {
      Alert.alert("Error", "Match state update failed");
    } finally {
      setIsUpdating(false);
    }
  }, [gameId, isOwner, isUpdating, currentGame, gameTime, fetchGame, setGameTime, setIsUpdating, syncTimerNow]);

  const handleFootballTimerAdjust = useCallback(async ({ deltaSeconds = 0, isRunning } = {}) => {
    if (!gameId || !isOwner || isUpdating) return;
    const currentSport = currentGame?.sport || {};
    const currentMinutes = gameTime?.minutes ?? currentSport?.currentMinute ?? 0;
    const currentSeconds = gameTime?.seconds ?? currentSport?.currentSecond ?? 0;
    const currentRunning = gameTime?.isRunning ?? false;
    const totalSeconds = Math.max(0, currentMinutes * 60 + currentSeconds + deltaSeconds);
    const nextTimerState = {
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
      isRunning: typeof isRunning === "boolean" ? isRunning : currentRunning,
    };

    setGameTime(nextTimerState);
    syncTimerNow?.(nextTimerState);
    setIsUpdating(true);
    try {
      await updateFootballMatchStateAPI(gameId, {
        currentMinute: nextTimerState.minutes,
        currentSecond: nextTimerState.seconds,
        currentPeriod: currentSport?.currentHalf || currentSport?.currentPeriod || 1,
      });
      await fetchGame();
    } catch {
      Alert.alert("Error", "Timer update failed");
    } finally {
      setIsUpdating(false);
    }
  }, [gameId, isOwner, isUpdating, currentGame, gameTime, fetchGame, setGameTime, setIsUpdating, syncTimerNow]);

  // ── Basketball ──
  const handleBasketballEvent = useCallback(async (eventType, teamSide, selectedPlayerId, extraData = {}) => {
    if (!currentGame || !gameId || !isOwner || gameOver) return;
    const isGameLevelEvent = eventType === "possession_change" || eventType === "quarter_transition";
    if (!isGameLevelEvent && !isSelfOwnedOpponent && teamSide !== userSide) return;

    if (!isOnline || !setCurrentGame) {
      if (isUpdating) return;
      const payload = buildBasketballEventPayload(currentGame, eventType, teamSide, selectedPlayerId, extraData);
      if (!payload) return;

      setIsUpdating(true);
      try {
        const apiCall = () => addGameEventAPI(gameId, payload);
        if (queueOrFire && !isOnline) {
          const result = await queueOrFire(apiCall, `${String(eventType).replace(/_/g, " ")} (${teamSide})`);
          if (result !== null) await fetchGame();
        } else {
          await apiCall();
          await fetchGame();
        }
      } catch {
        Alert.alert("Error", "Event failed");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    let action = null;
    setCurrentGame((prev) => {
      const eventPayload = buildBasketballEventPayload(prev, eventType, teamSide, selectedPlayerId, extraData);
      if (!eventPayload) return prev;

      const optimisticId = `basketball-${Date.now()}-${(basketballClientEventSeqRef.current += 1)}`;
      const payload = {
        ...eventPayload,
        clientEventId: optimisticId,
        _optimisticId: optimisticId,
      };
      const nextGame = applyOptimisticBasketballUpdate(prev, payload);
      const optimisticEvent = nextGame?.sport?.events?.[nextGame.sport.events.length - 1] || payload;
      action = {
        id: optimisticId,
        type: "event",
        payload: optimisticEvent,
      };
      basketballPendingActionsRef.current = [...basketballPendingActionsRef.current, action];
      return nextGame;
    });

    if (!action?.payload) return;

    if (eventType === "possession_change") {
      const [minutesText, secondsText] = String(action.payload.gameTime || "").split(":");
      const syncedTimerState = {
        minutes: Number.isFinite(Number(minutesText)) ? Number(minutesText) : (gameTime?.minutes ?? 0),
        seconds: Number.isFinite(Number(secondsText)) ? Number(secondsText) : (gameTime?.seconds ?? 0),
        isRunning: Boolean(gameTime?.isRunning),
      };
      syncTimerNow?.(syncedTimerState);
    }

    scheduleBasketballPersist(action, () => {
      const payload = { ...action.payload };
      delete payload._optimisticId;
      delete payload._id;
      delete payload.optimistic;
      return addGameEventAPI(gameId, payload);
    });
  }, [buildBasketballEventPayload, currentGame, fetchGame, gameOver, gameId, gameTime?.isRunning, gameTime?.minutes, gameTime?.seconds, isOnline, isOwner, isSelfOwnedOpponent, isUpdating, queueOrFire, scheduleBasketballPersist, setCurrentGame, setIsUpdating, syncTimerNow, userSide]);

  // ── Basketball Undo (replay-based rebuild on backend) ──
  const handleBasketballUndo = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner) return;
    const events = currentGame?.sport?.events || [];
    const base = currentGame?.base;

    let latestEvent = null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event && event.eventType !== "undo") {
        latestEvent = event;
        break;
      }
    }

    const undoSide = isSelfOwnedOpponent ? null : userSide;
    const undoTeamId = undoSide && base
      ? (undoSide === "home" ? base.teamId : base.opponentTeamId)
      : null;
    const canUndoLatestEvent = latestEvent && (!undoTeamId || String(latestEvent.teamId) === String(undoTeamId));

    if (!canUndoLatestEvent) {
      Alert.alert("Nothing to undo", "No events recorded yet.");
      return;
    }

    if (!isOnline || !setCurrentGame) {
      if (isUpdating) return;
      setIsUpdating(true);
      try {
        await removeLastEventAPI(gameId, undoTeamId ? { teamId: undoTeamId } : undefined);
        await fetchGame();
      } catch {
        Alert.alert("Error", "Undo failed");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    let action = null;
    setCurrentGame((prev) => {
      const result = applyOptimisticBasketballUndo(prev, { teamSide: undoSide });
      if (!result?.removedEvent) return prev;

      const optimisticId = `basketball-undo-${Date.now()}-${(basketballClientEventSeqRef.current += 1)}`;
      action = {
        id: optimisticId,
        type: "undo",
        teamSide: undoSide,
      };
      basketballPendingActionsRef.current = [...basketballPendingActionsRef.current, action];
      return result.nextGame;
    });

    if (!action) return;

    scheduleBasketballPersist(
      action,
      () => removeLastEventAPI(gameId, undoTeamId ? { teamId: undoTeamId } : undefined),
    );
  }, [currentGame, fetchGame, gameId, isOnline, isOwner, isSelfOwnedOpponent, isUpdating, scheduleBasketballPersist, setCurrentGame, setIsUpdating, userSide]);

  // ── Basketball Substitution ──
  const handleBasketballSubstitution = useCallback(async (teamSide, playerOutId, playerInId, currentLineup = []) => {
    if (!gameId || !isOwner || isUpdating) return;
    if (!isSelfOwnedOpponent && teamSide !== userSide) return;
    if (basketballPendingActionsRef.current.length > 0) {
      showToast("Wait for pending score sync before making a substitution.", "info", "top");
      return;
    }
    const base = currentGame?.base;
    if (!base) return;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const pIn = all.find(p => String(p._id || p.id) === String(playerInId));
    setIsUpdating(true);
    try {
      await makeSubstitutionAPI(gameId, {
        playerIn: playerInId,
        playerOut: playerOutId,
        teamId: tId,
        minute: gameTime?.minutes || 0,
        period: currentGame?.sport?.currentQuarter || 1,
        gameTime: `${String(gameTime?.minutes || 0).padStart(2, "0")}:${String(gameTime?.seconds || 0).padStart(2, "0")}`,
        playerInName: pIn ? formatName(pIn) : "Player",
        playerInJersey: pIn?.jerseyNumber ?? pIn?.number,
        playerInPosition: pIn?.position,
        currentLineup,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      await fetchGame();
    } catch {
      Alert.alert("Error", "Substitution failed");
    } finally {
      setIsUpdating(false);
    }
  }, [gameId, isOwner, isUpdating, currentGame, players, teamNames, gameTime, fetchGame, isSelfOwnedOpponent, userSide]);

  const getBasketballOtherSideToSetup = useCallback((savedSide) => {
    if (!isSelfOwnedOpponent) return null;
    const otherSide = savedSide === "home" ? "away" : "home";
    const rosterCount = (players?.[otherSide] || []).filter((p) => p && p.role !== "manager").length;
    if (rosterCount <= 5) return null;
    const sportState = currentGameRef?.current?.sport || currentGame?.sport;
    const otherLineup = otherSide === "home" ? sportState?.homeLineup : sportState?.awayLineup;
    if (Array.isArray(otherLineup) && otherLineup.length === 5) return null;
    return otherSide;
  }, [currentGame?.sport, currentGameRef, isSelfOwnedOpponent, players]);

  const handleBasketballSetupLineup = useCallback(async ({ side, players: lineupPlayers }) => {
    if (!gameId || !isOwner || isUpdating) return { ok: false };
    if (!isSelfOwnedOpponent && side !== userSide) return { ok: false };
    if (basketballPendingActionsRef.current.length > 0) {
      showToast("Wait for pending score sync before updating the starting five.", "info", "top");
      return { ok: false };
    }
    if (!Array.isArray(lineupPlayers) || lineupPlayers.length !== 5) {
      Alert.alert("Invalid lineup", "Select exactly 5 players for the starting five.");
      return { ok: false };
    }

    const normalizedPlayers = lineupPlayers.map((player, index) => ({
      playerId: String(player.playerId || player._id || player.id),
      playerName:
        player.playerName ||
        [player.firstName, player.lastName].filter(Boolean).join(" ").trim() ||
        `Player ${index + 1}`,
      position: player.position || null,
      jerseyNumber: player.jerseyNumber ?? player.number ?? null,
      isStarter: true,
    }));

    if (setCurrentGame) {
      setCurrentGame((prev) => {
        if (!prev?.sport) return prev;
        const next = cloneGameSnapshot(prev);
        const lineupField = side === "home" ? "homeLineup" : "awayLineup";
        const startingField = side === "home" ? "startingHomeLineup" : "startingAwayLineup";
        next.sport[lineupField] = normalizedPlayers;
        next.sport[startingField] = normalizedPlayers.map((player) => ({ ...player }));
        if (currentGameRef) {
          currentGameRef.current = next;
        }
        return next;
      });
    }

    setIsUpdating(true);
    try {
      await updateBasketballLineupAPI(gameId, {
        team: side,
        players: lineupPlayers,
      });
      await fetchGame();
      return { ok: true, nextSide: getBasketballOtherSideToSetup(side) };
    } catch {
      await fetchGame();
      Alert.alert("Error", "Failed to save starting five");
      return { ok: false };
    } finally {
      setIsUpdating(false);
    }
  }, [
    gameId,
    isOwner,
    isUpdating,
    fetchGame,
    currentGameRef,
    getBasketballOtherSideToSetup,
    isSelfOwnedOpponent,
    setCurrentGame,
    userSide,
  ]);

  // ── Volleyball ──
  const handleVolleyballRally = useCallback(async (eventType, teamSide) => {
    if (!currentGame || !gameId || !isOwner || gameOver) return;
    if (!ensureVolleyballSideAccess(teamSide)) return;
    if (!isOnline || !setCurrentGame) {
      const eventPayload = buildVolleyballEventPayload(currentGame, eventType, teamSide);
      if (!eventPayload) return;

      setIsUpdating(true);
      try {
        const apiCall = () => addGameEventAPI(gameId, eventPayload);
        if (queueOrFire && !isOnline) {
          const result = await queueOrFire(apiCall, `${String(eventType).replace(/_/g, " ")} (${teamSide})`);
          if (result !== null) await fetchGame();
        } else {
          await apiCall();
          await fetchGame();
        }
      } catch {
        Alert.alert("Error", "Rally failed");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    let action = null;
    setCurrentGame((prev) => {
      const eventPayload = buildVolleyballEventPayload(prev, eventType, teamSide);
      if (!eventPayload) return prev;

      const optimisticId = `volleyball-${Date.now()}-${(volleyballClientEventSeqRef.current += 1)}`;
      const payload = {
        ...eventPayload,
        clientEventId: optimisticId,
        _optimisticId: optimisticId,
      };
      const nextGame = applyOptimisticVolleyballUpdate(prev, payload);
      const optimisticEvent = nextGame?.sport?.events?.[nextGame.sport.events.length - 1] || payload;
      action = {
        id: optimisticId,
        type: "event",
        payload: optimisticEvent,
      };
      volleyballPendingActionsRef.current = [...volleyballPendingActionsRef.current, action];
      return nextGame;
    });

    if (!action?.payload) return;

    scheduleVolleyballPersist(
      action,
      () => {
        const payload = { ...action.payload };
        delete payload._optimisticId;
        delete payload._id;
        delete payload.optimistic;
        return addGameEventAPI(gameId, payload);
      },
      `${String(eventType).replace(/_/g, " ")} (${teamSide})`,
    );
  }, [buildVolleyballEventPayload, currentGame, ensureVolleyballSideAccess, fetchGame, gameOver, gameId, isOnline, isOwner, queueOrFire, scheduleVolleyballPersist, setCurrentGame, setIsUpdating]);

  // ── Volleyball Lineup Setup ──
  const handleVolleyballSetupLineup = useCallback(async (data) => {
    if (!gameId || !isOwner) return;
    const { side, players: lineupPlayers, libero, firstServerRotation } = data;
    if (!ensureVolleyballSideAccess(side)) return;
    const base = currentGame?.base;
    const team = side === "home" ? "home" : "away";
    setIsUpdating(true);
    try {
      await updateVolleyballLineupAPI(gameId, {
        team,
        players: lineupPlayers,
        startingRotation: firstServerRotation || 1,
      });
      // Set serving team if this is home team setup and no serving team yet
      const sportData = currentGame?.sport;
      if (!sportData?.servingTeam && side === "home") {
        const servingId = base?.teamId;
        if (servingId) {
          await updateServingTeamAPI(gameId, { servingTeam: servingId });
        }
      }
      // If libero provided, send a libero event
      if (libero?.playerId) {
        const tId = side === "home" ? base?.teamId : base?.opponentTeamId;
        await addGameEventAPI(gameId, {
          eventType: "rotation",
          playerId: libero.playerId,
          teamId: tId,
          setNumber: sportData?.currentSet || 1,
          isRallyPoint: false,
          isLibero: true,
          playerName: libero.playerName || "Libero",
          teamSide: side,
        });
      }
      await fetchGame();
    } catch { Alert.alert("Error", "Failed to set lineup"); }
    finally { setIsUpdating(false); }
  }, [currentGame, ensureVolleyballSideAccess, gameId, isOwner, fetchGame]);

  // ── Volleyball Substitution ──
  const handleVolleyballSubstitution = useCallback(async (data) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    const { playerOut, playerIn, side } = data;
    if (!ensureVolleyballSideAccess(side)) return;
    const base = currentGame.base;
    const tId = side === "home" ? base.teamId : base.opponentTeamId;
    // Resolve playerIn full name from roster
    const rosterPlayerIn = (players?.[side] || []).find(
      p => String(p?._id || p?.id) === String(playerIn?._id || playerIn?.id || playerIn?.playerId)
    );
    const playerInName = rosterPlayerIn ? formatName(rosterPlayerIn) : (playerIn?.playerName || playerIn?.firstName || "Player In");
    const playerOutName = playerOut?.playerName || formatName(playerOut) || "Player Out";

    setIsUpdating(true);
    try {
      await makeSubstitutionAPI(gameId, {
        playerOut: playerOut?.playerId || String(playerOut?._id || playerOut?.id),
        playerIn: playerIn?.playerId || String(playerIn?._id || playerIn?.id),
        teamId: tId,
        playerInName,
        playerInJersey: rosterPlayerIn?.jerseyNumber || playerIn?.jerseyNumber || "",
        description: `Substitution: ${playerOutName} off, ${playerInName} on`,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Substitution failed"); }
    finally { setIsUpdating(false); }
  }, [currentGame, ensureVolleyballSideAccess, gameId, isOwner, isUpdating, players, teamNames, fetchGame]);

  // ── Volleyball Libero Swap ──
  const handleVolleyballLiberoSwap = useCallback(async (data) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    const { side, liberoIn, playerSwap } = data;
    if (!ensureVolleyballSideAccess(side)) return;
    const base = currentGame.base;
    const tId = side === "home" ? base.teamId : base.opponentTeamId;
    const sportData = currentGame.sport || {};
    setIsUpdating(true);
    try {
      await addGameEventAPI(gameId, {
        eventType: "substitution",
        playerId: liberoIn ? playerSwap.playerId : playerSwap.playerId,
        relatedPlayerId: liberoIn ? (sportData?.homeLineup?.find(p => p.isLibero)?.playerId || "libero") : playerSwap.playerId,
        teamId: tId,
        setNumber: sportData?.currentSet || 1,
        isRallyPoint: false,
        isLibero: true,
        playerName: playerSwap?.playerName || "Player",
        teamSide: side,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Libero swap failed"); }
    finally { setIsUpdating(false); }
  }, [currentGame, ensureVolleyballSideAccess, gameId, isOwner, isUpdating, fetchGame]);

  // ── Volleyball Timeout ──
  const handleVolleyballTimeout = useCallback(async (teamSide) => {
    if (!currentGame || !gameId || !isOwner) return;
    const base = currentGame.base;
    const tId = String(teamSide === "home" ? base.teamId : base.opponentTeamId);
    const sportData = currentGame.sport || {};
    const setNumber = Number(sportData?.currentSet) || 1;
    const existingTimeouts = (sportData.timeouts || []).filter(
      (t) => String(t?.teamId) === tId && Number(t?.setNumber) === setNumber,
    ).length;
    if (existingTimeouts >= 2) {
      Alert.alert("Timeout limit", "This team has already used 2 timeouts this set.");
      return;
    }
    setIsUpdating(true);
    try {
      await addGameEventAPI(gameId, {
        eventType: "timeout",
        playerId: `team_${tId}`,
        teamId: tId,
        setNumber,
        isRallyPoint: false,
        teamSide,
        teamName: teamSide === "home" ? teamNames.home : teamNames.away,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      const rawSnapshot = await fetchGameSnapshot(gameId);
      const refreshed = normalizeGameModel(rawSnapshot);
      if (refreshed?.base && refreshed?.sport) {
        if (currentGameRef) {
          currentGameRef.current = refreshed;
        }
        setCurrentGame?.(refreshed);
        setGameOver?.(isGameFinished(refreshed));
        const version =
          Number(refreshed.base?.version) ||
          Number(store.getState().liveGame?.byGameId?.[gameId]?.serverVersion) ||
          0;
        store.dispatch(hydrateGame({ gameId, snapshot: refreshed, version }));
      } else {
        await fetchGame();
      }
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.error || "Timeout failed");
    } finally {
      setIsUpdating(false);
    }
  }, [
    currentGame,
    currentGameRef,
    gameId,
    isOwner,
    setCurrentGame,
    setGameOver,
    setIsUpdating,
    teamNames,
    fetchGame,
  ]);

  // ── Volleyball Challenge ──
  const handleVolleyballChallenge = useCallback(async (teamSide, result) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    if (!ensureVolleyballSideAccess(teamSide)) return;
    const base = currentGame.base;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const sportData = currentGame.sport || {};
    setIsUpdating(true);
    try {
      // Send challenge event
      await addGameEventAPI(gameId, {
        eventType: "challenge",
        playerId: `team_${tId}`,
        teamId: tId,
        setNumber: sportData?.currentSet || 1,
        isRallyPoint: false,
        teamSide,
        teamName: teamSide === "home" ? teamNames.home : teamNames.away,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      // Send result event
      if (result === "challenge_won" || result === "challenge_lost") {
        await addGameEventAPI(gameId, {
          eventType: result,
          playerId: `team_${tId}`,
          teamId: tId,
          setNumber: sportData?.currentSet || 1,
          isRallyPoint: false,
          teamSide,
          teamName: teamSide === "home" ? teamNames.home : teamNames.away,
          homeTeamName: teamNames.home,
          awayTeamName: teamNames.away,
        });
      }
      await fetchGame();
    } catch { Alert.alert("Error", "Challenge failed"); }
    finally { setIsUpdating(false); }
  }, [currentGame, ensureVolleyballSideAccess, gameId, isOwner, isUpdating, teamNames, fetchGame]);

  // ── Volleyball Undo ──
  const handleVolleyballUndo = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner) return;

    cancelInflightSync(gameId);

    const liveState = store.getState().liveGame?.byGameId?.[gameId];
    const derived =
      selectDerivedLiveGame(store.getState(), gameId) ||
      currentGameRef?.current ||
      currentGame;

    const { nextGame, removedEvent } = applyOptimisticVolleyballUndo(derived, {
      teamSide: null,
    });
    if (!removedEvent) {
      Alert.alert("Nothing to undo", "No rally to undo.");
      return;
    }

    const inflightIds = [...(liveState?.inflightIds || [])];
    if (inflightIds.length > 0) {
      store.dispatch(nackBatch({ gameId, optimisticIds: inflightIds, fatal: true }));
    }

    const targetRallyCount = countVolleyballRallyEvents(nextGame);
    const targetScoreSig = volleyballSetScoreSignature(nextGame);
    const version = Math.max(
      Number(nextGame?.base?.version) || 0,
      Number(liveState?.serverVersion) || 0,
    );
    volleyballPendingActionsRef.current = [];
    store.dispatch(
      forceResetFromServer({
        gameId,
        snapshot: nextGame,
        version,
        localAuthorityRallyCount: targetRallyCount,
        localAuthorityScoreSig: targetScoreSig,
      }),
    );
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);
    setGameOver?.(isGameFinished(nextGame));

    let serverRallyCount = countVolleyballRallyEvents(liveState?.serverState);
    if (serverRallyCount === 0 && targetRallyCount === 0) {
      return;
    }

    try {
      let guard = 0;
      while (guard < 12) {
        guard += 1;
        if (serverRallyCount > targetRallyCount) {
          await removeLastEventAPI(gameId);
          serverRallyCount -= 1;
          continue;
        }

        const rawSnapshot = await fetchGameSnapshot(gameId);
        const resetSnapshot = normalizeGameModel(rawSnapshot);
        if (!resetSnapshot?.base || !resetSnapshot?.sport) {
          break;
        }

        if (volleyballSetScoreSignature(resetSnapshot) === targetScoreSig) {
          if (currentGameRef) {
            currentGameRef.current = resetSnapshot;
          }
          setCurrentGame?.(resetSnapshot);
          store.dispatch(
            forceResetFromServer({
              gameId,
              snapshot: resetSnapshot,
              version: Number(resetSnapshot.base?.version) || version,
              localAuthorityRallyCount: countVolleyballRallyEvents(resetSnapshot),
              localAuthorityScoreSig: targetScoreSig,
            }),
          );
          setGameOver?.(isGameFinished(resetSnapshot));
          break;
        }

        const fetchedRallyCount = countVolleyballRallyEvents(resetSnapshot);
        if (fetchedRallyCount > targetRallyCount) {
          serverRallyCount = fetchedRallyCount;
          continue;
        }

        break;
      }
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.error || "Undo failed");
    }
  }, [
    currentGame,
    currentGameRef,
    fetchGame,
    gameId,
    isOwner,
    selectDerivedLiveGame,
    setCurrentGame,
    setGameOver,
  ]);

  const handleCricketScore = useCallback(async (eventType, extraRuns) => {
    if (!gameId || !isOwner || gameOver || isUpdating) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame) return;

    const sportData = latestGame?.sport || {};
    const striker = sportData?.currentBatsmen?.find((b) => b.striker);
    const bowlerPlayerId = sportData?.currentBowler?.playerId;
    const BATTING = ["dot_ball", "single", "double", "triple", "boundary_4", "boundary_6"];
    const BOWLING = ["wide", "no_ball"];
    const EXTRAS = ["bye", "leg_bye"];
    const homeTeamId = latestGame.base?.teamId;
    const battingTeamId =
      sportData?.innings?.[(sportData?.currentInnings || 1) - 1]?.battingTeamId ||
      sportData?.battingTeamId ||
      homeTeamId;
    const bowlingTeamId =
      sportData?.innings?.[(sportData?.currentInnings || 1) - 1]?.bowlingTeamId ||
      sportData?.bowlingTeamId ||
      latestGame.base?.opponentTeamId;
    let playerId, tId, teamSide, role;
    if (BATTING.includes(eventType)) {
      if (!striker?.playerId) { Alert.alert("Error", "No striker set"); return; }
      playerId = striker.playerId;
      tId = battingTeamId;
      teamSide = String(tId) === String(homeTeamId) ? "home" : "away";
      role = "batsman";
    } else if (BOWLING.includes(eventType)) {
      if (!bowlerPlayerId) { Alert.alert("Error", "No bowler set"); return; }
      playerId = bowlerPlayerId;
      tId = bowlingTeamId;
      teamSide = String(tId) === String(homeTeamId) ? "home" : "away";
      role = "bowler";
    } else if (EXTRAS.includes(eventType)) {
      if (!striker?.playerId) return;
      playerId = striker.playerId;
      tId = battingTeamId;
      teamSide = String(tId) === String(homeTeamId) ? "home" : "away";
      role = "batsman";
    } else {
      return;
    }
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const player = all.find((entry) => String(entry._id || entry.id) === String(playerId));
    const runs = extraRuns != null ? extraRuns : getRunsForCricketStat(eventType);
    const optimisticId = `cricket-${Date.now()}-${(cricketClientEventSeqRef.current += 1)}`;
    const eventPayload = {
      eventType,
      playerId,
      teamId: tId,
      playerName: player ? formatName(player) : "Unknown",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      gameTime,
      teamSide,
      overNumber: sportData?.currentOver ?? 0,
      ballNumber: sportData?.currentBall ?? 0,
      innings: sportData?.currentInnings || 1,
      runs,
      role,
      _optimisticId: optimisticId,
    };

    const nextGame = applyOptimisticCricketUpdate(latestGame, eventPayload);
    cricketPendingActionsRef.current = [
      ...cricketPendingActionsRef.current,
      { id: optimisticId, type: "event", payload: eventPayload },
    ];
    commitCricketLocalGame(nextGame);

    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;

    cricketPendingSyncRef.current += 1;
    setCricketPendingSyncCount(cricketPendingSyncRef.current);

    const persist = async () => {
      let shouldFetch = true;
      try {
        await addGameEventAPI(gameId, persistPayload);
      } catch (error) {
        shouldFetch = false;
        cricketPendingActionsRef.current = cricketPendingActionsRef.current.filter(
          (action) => action.id !== optimisticId,
        );

        const serverSnapshot = cricketServerSnapshotRef.current
          ? cloneGameSnapshot(cricketServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          commitCricketLocalGame(replayPendingCricketActions(serverSnapshot, cricketPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Scoring failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        cricketPendingSyncRef.current = Math.max(0, cricketPendingSyncRef.current - 1);
        setCricketPendingSyncCount(cricketPendingSyncRef.current);
        if (shouldFetch && cricketPendingSyncRef.current === 0) {
          cricketPendingActionsRef.current = [];
          await fetchGame();
        }
      }
    };

    cricketPersistChainRef.current = cricketPersistChainRef.current.then(persist, persist);
  }, [commitCricketLocalGame, currentGame, currentGameRef, fetchGame, gameOver, gameId, gameTime, isOwner, isUpdating, players, setCurrentGame, teamNames]);

  const handleCricketWicket = useCallback(async (wicketType, dismissedPlayerId, fielderId, runsCompleted) => {
    if (!gameId || !isOwner || gameOver || isUpdating) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame) return;

    const sportData = latestGame?.sport || {};
    const bowlerPlayerId = sportData?.currentBowler?.playerId;
    if (!bowlerPlayerId) { Alert.alert("Error", "No bowler set"); return; }
    const homeTeamId = latestGame.base?.teamId;
    const bowlingTeamId =
      sportData?.innings?.[(sportData?.currentInnings || 1) - 1]?.bowlingTeamId ||
      sportData?.bowlingTeamId ||
      latestGame.base?.opponentTeamId;
    const teamSide = String(bowlingTeamId) === String(homeTeamId) ? "home" : "away";
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const bowler = all.find((pl) => String(pl._id || pl.id) === String(bowlerPlayerId));
    const dismissed = dismissedPlayerId
      ? all.find((pl) => String(pl._id || pl.id) === String(dismissedPlayerId))
      : null;
    const fielder = fielderId
      ? all.find((pl) => String(pl._id || pl.id) === String(fielderId))
      : null;
    const optimisticId = `cricket-wicket-${Date.now()}-${(cricketClientEventSeqRef.current += 1)}`;
    const eventPayload = {
      eventType: wicketType || "wicket",
      playerId: bowlerPlayerId,
      teamId: bowlingTeamId,
      playerName: bowler ? formatName(bowler) : "Bowler",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      gameTime,
      teamSide,
      overNumber: sportData?.currentOver ?? 0,
      ballNumber: sportData?.currentBall ?? 0,
      innings: sportData?.currentInnings || 1,
      runs: runsCompleted || 0,
      role: "bowler",
      wicketType,
      dismissedPlayerId,
      dismissedPlayerName: dismissed ? formatName(dismissed) : undefined,
      fielderId,
      fielderName: fielder ? formatName(fielder) : undefined,
      _optimisticId: optimisticId,
    };

    const nextGame = applyOptimisticCricketUpdate(latestGame, eventPayload);
    cricketPendingActionsRef.current = [
      ...cricketPendingActionsRef.current,
      { id: optimisticId, type: "event", payload: eventPayload },
    ];
    commitCricketLocalGame(nextGame);

    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;

    cricketPendingSyncRef.current += 1;
    setCricketPendingSyncCount(cricketPendingSyncRef.current);

    const persist = async () => {
      let shouldFetch = true;
      try {
        await addGameEventAPI(gameId, persistPayload);
      } catch (error) {
        shouldFetch = false;
        cricketPendingActionsRef.current = cricketPendingActionsRef.current.filter(
          (action) => action.id !== optimisticId,
        );

        const serverSnapshot = cricketServerSnapshotRef.current
          ? cloneGameSnapshot(cricketServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          commitCricketLocalGame(replayPendingCricketActions(serverSnapshot, cricketPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Wicket failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        cricketPendingSyncRef.current = Math.max(0, cricketPendingSyncRef.current - 1);
        setCricketPendingSyncCount(cricketPendingSyncRef.current);
        if (shouldFetch && cricketPendingSyncRef.current === 0) {
          cricketPendingActionsRef.current = [];
          await fetchGame();
        }
      }
    };

    cricketPersistChainRef.current = cricketPersistChainRef.current.then(persist, persist);
  }, [commitCricketLocalGame, currentGame, currentGameRef, fetchGame, gameOver, gameId, gameTime, isOwner, isUpdating, players, setCurrentGame, teamNames]);

  const handleSwapStrike = useCallback(async () => {
    if (!gameId || !isOwner || gameOver || isUpdating) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame) return;

    const batsmen = latestGame?.sport?.currentBatsmen;
    if (!batsmen || batsmen.length < 2) {
      Alert.alert("Error", "Two batsmen are required to swap strike");
      return;
    }
    const optimisticId = `cricket-swap-${Date.now()}-${(cricketClientEventSeqRef.current += 1)}`;
    const nextGame = applyOptimisticCricketSwapStrike(latestGame);
    cricketPendingActionsRef.current = [
      ...cricketPendingActionsRef.current,
      { id: optimisticId, type: "swap_strike" },
    ];
    commitCricketLocalGame(nextGame);

    const currentBatsmen = (nextGame?.sport?.currentBatsmen || []).map((batter) => ({
      playerId: batter?.playerId,
      striker: !!batter?.striker,
      runs: Number(batter?.runs) || 0,
      balls: Number(batter?.balls) || 0,
      fours: Number(batter?.fours) || 0,
      sixes: Number(batter?.sixes) || 0,
      battingOrder: batter?.battingOrder,
    }));

    cricketPendingSyncRef.current += 1;
    setCricketPendingSyncCount(cricketPendingSyncRef.current);

    const persist = async () => {
      let shouldFetch = true;
      try {
        await updateBattingOrderAPI(gameId, { currentBatsmen });
      } catch (error) {
        shouldFetch = false;
        cricketPendingActionsRef.current = cricketPendingActionsRef.current.filter(
          (action) => action.id !== optimisticId,
        );

        const serverSnapshot = cricketServerSnapshotRef.current
          ? cloneGameSnapshot(cricketServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          commitCricketLocalGame(replayPendingCricketActions(serverSnapshot, cricketPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Swap strike failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        cricketPendingSyncRef.current = Math.max(0, cricketPendingSyncRef.current - 1);
        setCricketPendingSyncCount(cricketPendingSyncRef.current);
        if (shouldFetch && cricketPendingSyncRef.current === 0) {
          cricketPendingActionsRef.current = [];
          await fetchGame();
        }
      }
    };

    cricketPersistChainRef.current = cricketPersistChainRef.current.then(persist, persist);
  }, [commitCricketLocalGame, currentGame, currentGameRef, fetchGame, gameOver, gameId, isOwner, isUpdating, setCurrentGame]);

  const syncCricketLiveSnapshot = useCallback((snapshot) => {
    if (!gameId || !snapshot?.base || !snapshot?.sport) return;
    store.dispatch(
      hydrateGame({
        gameId,
        snapshot,
        version: Number(snapshot.base?.version) || 0,
      }),
    );
  }, [gameId]);

  const handleChangeBowler = useCallback(async (bowlerPlayerId) => {
    if (!gameId || !isOwner || !bowlerPlayerId || isUpdating) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame) return;

    const optimisticId = `cricket-bowler-${Date.now()}-${(cricketClientEventSeqRef.current += 1)}`;
    const nextGame = applyOptimisticCricketChangeBowler(latestGame, bowlerPlayerId);
    cricketPendingActionsRef.current = [
      ...cricketPendingActionsRef.current,
      { id: optimisticId, type: "change_bowler", bowlerPlayerId },
    ];
    commitCricketLocalGame(nextGame);
    syncCricketLiveSnapshot(nextGame);

    const overNumber = nextGame?.sport?.currentOver || 0;

    cricketPendingSyncRef.current += 1;
    setCricketPendingSyncCount(cricketPendingSyncRef.current);

    const persist = async () => {
      let shouldFetch = true;
      try {
        await updateCurrentBowlerAPI(gameId, {
          bowlerId: bowlerPlayerId,
          playerId: bowlerPlayerId,
          overNumber,
          ballsInOver: 0,
          runsInOver: 0,
          wicketsInOver: 0,
        });
      } catch (error) {
        shouldFetch = false;
        cricketPendingActionsRef.current = cricketPendingActionsRef.current.filter(
          (action) => action.id !== optimisticId,
        );

        const serverSnapshot = cricketServerSnapshotRef.current
          ? cloneGameSnapshot(cricketServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          commitCricketLocalGame(replayPendingCricketActions(serverSnapshot, cricketPendingActionsRef.current));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Change bowler failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        cricketPendingSyncRef.current = Math.max(0, cricketPendingSyncRef.current - 1);
        setCricketPendingSyncCount(cricketPendingSyncRef.current);
        if (shouldFetch && cricketPendingSyncRef.current === 0) {
          cricketPendingActionsRef.current = [];
          await fetchGame();
        }
      }
    };

    cricketPersistChainRef.current = cricketPersistChainRef.current.then(persist, persist);
  }, [
    commitCricketLocalGame,
    currentGame,
    currentGameRef,
    fetchGame,
    gameId,
    isOwner,
    isUpdating,
    setCurrentGame,
    syncCricketLiveSnapshot,
  ]);

  const handleSetBattingOrder = useCallback(async (battingOrderData) => {
    if (!currentGame || !gameId || cricketPendingSyncCount > 0) return;
    setIsUpdating(true);
    try {
      const response = await updateBattingOrderAPI(gameId, battingOrderData);
      const prevGame = currentGameRef?.current || currentGame;
      const sportFromApi = response?.data || response;
      if (prevGame?.base && sportFromApi) {
        const snapshot = normalizeGameModel({ base: prevGame.base, sport: sportFromApi });
        if (snapshot) {
          if (currentGameRef) {
            currentGameRef.current = snapshot;
          }
          setCurrentGame?.(snapshot);
          syncCricketLiveSnapshot(snapshot);
        }
      }
      await fetchGame();
      const latestSnapshot = currentGameRef?.current;
      if (latestSnapshot?.base && latestSnapshot?.sport) {
        syncCricketLiveSnapshot(latestSnapshot);
      }
    } catch {} finally { setIsUpdating(false); }
  }, [
    cricketPendingSyncCount,
    currentGame,
    currentGameRef,
    gameId,
    fetchGame,
    setCurrentGame,
    syncCricketLiveSnapshot,
  ]);

  const handleTossSelection = useCallback(async (winner, decision) => {
    if (!isOwner || !currentGame) return;
    const homeTeamId = String(currentGame.base?.teamId);
    const awayTeamId = String(currentGame.base?.opponentTeamId);
    const winnerStr = String(winner);
    const battingTeamId = decision === "bat" ? winnerStr : winnerStr === homeTeamId ? awayTeamId : homeTeamId;
    const bowlingTeamId = decision === "bowl" ? winnerStr : winnerStr === homeTeamId ? awayTeamId : homeTeamId;
    setTossSelection({ showSelection: false, tossWinner: winner, decision, elected: decision, isSelected: true, battingTeamId, bowlingTeamId });
    if (gameId) {
      try { await updateTossAPI(gameId, { winner, decision, elected: decision, battingTeamId, bowlingTeamId }); await fetchGame(); }
      catch {}
    }
  }, [currentGame, gameId, isOwner, fetchGame]);

  const handleOversConfirm = useCallback(async () => {
    setOversSelection((prev) => ({ ...prev, showModal: false, confirmed: true }));
    setTossSelection((prev) => ({ ...prev, showSelection: true }));
    // Persist totalOvers to backend
    if (gameId) {
      try {
        await updateCricketMatchStateAPI(gameId, { totalOvers: parseInt(oversSelection.overs) || 20 });
        await fetchGame();
      } catch {}
    }
  }, [gameId, oversSelection.overs, fetchGame]);

  // ── Cricket: Start 2nd Innings ──
  const handleStartSecondInnings = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner || gameOver || isUpdating || cricketPendingSyncCount > 0) return;
    const sportData = currentGame?.sport;
    if ((sportData?.currentInnings || 1) >= 2) {
      Alert.alert("Info", "Already in 2nd innings");
      return;
    }

    // Check if innings should end: all out or overs completed
    const firstInnings = sportData?.innings?.[0];
    const totalOvers = sportData?.totalOvers || 20;
    const wicketsFallen = firstInnings?.wickets || 0;
    const ballsCompleted = firstInnings?.balls_completed || 0;
    const oversCompleted = Math.floor(ballsCompleted / 6);
    const isAllOut = wicketsFallen >= 10;
    const isOversComplete = oversCompleted >= totalOvers;

    const currentBattingTeamId = firstInnings?.battingTeamId || currentGame?.base?.teamId;
    const currentBowlingTeamId = firstInnings?.bowlingTeamId || currentGame?.base?.opponentTeamId;

    const startInnings = async () => {
      setIsUpdating(true);
      try {
        await updateCricketMatchStateAPI(gameId, {
          matchStatus: "second_innings",
          currentInnings: 2,
          battingTeamId: currentBowlingTeamId,
          bowlingTeamId: currentBattingTeamId,
          clearBowler: true,
          currentOver: 0,
          currentBall: 0,
        });
        await fetchGame();
      } catch {
        Alert.alert("Error", "Failed to start 2nd innings");
      } finally {
        setIsUpdating(false);
      }
    };

    if (isAllOut || isOversComplete) {
      // Automatic condition met — confirm with user
      Alert.alert(
        "Start 2nd Innings",
        isAllOut
          ? "Batting team is all out. Start 2nd innings?"
          : "First innings overs completed. Start 2nd innings?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start", style: "default", onPress: startInnings },
        ]
      );
    } else {
      // Early declaration
      Alert.alert(
        "Declare & Start 2nd Innings",
        `Only ${wicketsFallen} wickets fallen, ${oversCompleted}.${ballsCompleted % 6} of ${totalOvers} overs bowled.\n\nDeclare and start the 2nd innings?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Declare", style: "destructive", onPress: startInnings },
        ]
      );
    }
  }, [cricketPendingSyncCount, currentGame, gameId, isOwner, gameOver, isUpdating, fetchGame]);

  const handleStartSuperOver = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner || gameOver || isUpdating || cricketPendingSyncCount > 0) return;
    const sportData = currentGame?.sport;
    if (!sportData?.superOverAllowed) return;

    const innings = sportData?.innings || [];
    const nextInnings = innings.length + 1;
    if (nextInnings < 3) return;

    let battingTeamId;
    let bowlingTeamId;
    if (nextInnings === 3) {
      const second = innings[1];
      battingTeamId = second?.battingTeamId;
      bowlingTeamId = second?.bowlingTeamId;
    } else if (nextInnings % 2 === 1) {
      const prevChase = innings[nextInnings - 2];
      battingTeamId = prevChase?.battingTeamId;
      bowlingTeamId = prevChase?.bowlingTeamId;
    } else {
      const prevBat = innings[nextInnings - 2];
      battingTeamId = prevBat?.bowlingTeamId;
      bowlingTeamId = prevBat?.battingTeamId;
    }

    if (!battingTeamId || !bowlingTeamId) return;

    const startInnings = async () => {
      setIsUpdating(true);
      try {
        await updateCricketMatchStateAPI(gameId, {
          matchStatus: "super_over",
          currentInnings: nextInnings,
          battingTeamId,
          bowlingTeamId,
          clearBowler: true,
          isSuperOver: true,
          currentOver: 0,
          currentBall: 0,
        });
        await fetchGame();
      } catch {
        Alert.alert("Error", "Failed to start Super Over");
      } finally {
        setIsUpdating(false);
      }
    };

    const isChaseInnings = nextInnings % 2 === 0;
    Alert.alert(
      isChaseInnings ? "Start Super Over — 2nd innings" : "Start Super Over",
      isChaseInnings
        ? "The other side will chase in a 1-over eliminator (2 wickets max)."
        : "Each side gets 1 over and 2 wickets. The chasing side from the main match bats first.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start", style: "default", onPress: startInnings },
      ],
    );
  }, [cricketPendingSyncCount, currentGame, gameId, isOwner, gameOver, isUpdating, fetchGame]);

  const finishBadmintonPersist = useCallback(async (shouldFetch) => {
    badmintonPendingSyncRef.current = Math.max(0, badmintonPendingSyncRef.current - 1);
    if (shouldFetch && badmintonPendingSyncRef.current === 0) {
      badmintonPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleBadmintonPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    badmintonPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        badmintonPendingActionsRef.current = badmintonPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = badmintonServerSnapshotRef.current
          ? cloneGameSnapshot(badmintonServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          const replayedGame = replayPendingBadmintonActions(
            serverSnapshot,
            badmintonPendingActionsRef.current,
          );
          if (currentGameRef) {
            currentGameRef.current = replayedGame;
          }
          setCurrentGame(replayedGame);
          setGameOver?.(isGameFinished(replayedGame));
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Badminton event failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        await finishBadmintonPersist(shouldFetch);
      }
    };

    badmintonPersistChainRef.current = badmintonPersistChainRef.current.then(persist, persist);
  }, [currentGameRef, fetchGame, finishBadmintonPersist, gameId, setCurrentGame, setGameOver]);

  const finishTableTennisPersist = useCallback(async (shouldFetch) => {
    tableTennisPendingSyncRef.current = Math.max(0, tableTennisPendingSyncRef.current - 1);
    if (shouldFetch && tableTennisPendingSyncRef.current === 0) {
      tableTennisPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleTableTennisPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    tableTennisPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        tableTennisPendingActionsRef.current = tableTennisPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = tableTennisServerSnapshotRef.current
          ? cloneGameSnapshot(tableTennisServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          const replayedGame = replayPendingTableTennisActions(
            serverSnapshot,
            tableTennisPendingActionsRef.current,
          );
          if (currentGameRef) {
            currentGameRef.current = replayedGame;
          }
          setCurrentGame(replayedGame);
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Table tennis event failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        await finishTableTennisPersist(shouldFetch);
      }
    };

    tableTennisPersistChainRef.current = tableTennisPersistChainRef.current.then(persist, persist);
  }, [currentGameRef, fetchGame, finishTableTennisPersist, gameId, setCurrentGame]);

  const finishTennisPersist = useCallback(async (shouldFetch) => {
    tennisPendingSyncRef.current = Math.max(0, tennisPendingSyncRef.current - 1);
    if (shouldFetch && tennisPendingSyncRef.current === 0) {
      tennisPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleTennisPersist = useCallback((action, persistFn) => {
    if (!gameId) return;

    tennisPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        tennisPendingActionsRef.current = tennisPendingActionsRef.current.filter(
          (pendingAction) => pendingAction.id !== action.id,
        );

        const serverSnapshot = tennisServerSnapshotRef.current
          ? cloneGameSnapshot(tennisServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          const replayedGame = replayPendingTennisActions(serverSnapshot, tennisPendingActionsRef.current);
          if (currentGameRef) {
            currentGameRef.current = replayedGame;
          }
          setCurrentGame(replayedGame);
        } else {
          await fetchGame();
        }

        const message = error?.response?.data?.error || error?.message || "Tennis event failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        await finishTennisPersist(shouldFetch);
      }
    };

    tennisPersistChainRef.current = tennisPersistChainRef.current.then(persist, persist);
  }, [currentGameRef, fetchGame, finishTennisPersist, gameId, setCurrentGame]);

  const handleTennisRallyEvent = useCallback((eventType, teamSide, selectedPlayer) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    if (gameOver || isGameFinished(currentGame)) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame?.sport || latestGame.sport.matchStatus === "final") return;

    const base = latestGame.base;
    const sportData = latestGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const teamPlayers = (players?.[teamSide] || []).filter(Boolean);
    const rep = selectedPlayer || (teamPlayers.length === 1 ? teamPlayers[0] : null);
    const basePayload = {
      eventType,
      playerId: rep?._id || rep?.id || `team_${tId}`,
      teamId: tId,
      playerName: rep ? formatName(rep) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      gameNumber: sportData?.currentGame || 1,
      setNumber: sportData?.currentSetNumber || 1,
      source: "mobile_scoring_panel",
      operatorTeamId: teamId,
      timestamp: new Date().toISOString(),
    };

    if (eventType === "undo") {
      const { nextGame, removedEvent } = applyOptimisticTennisUndo(latestGame);
      if (!removedEvent) {
        Alert.alert("Nothing to undo", "No tennis points have been recorded yet.");
        return;
      }

      const optimisticId = `tennis-undo-${Date.now()}-${(tennisClientEventSeqRef.current += 1)}`;
      const action = { id: optimisticId, type: "undo" };
      tennisPendingActionsRef.current = [...tennisPendingActionsRef.current, action];
      if (currentGameRef) {
        currentGameRef.current = nextGame;
      }
      setCurrentGame?.(nextGame);

      scheduleTennisPersist(action, () => addGameEventAPI(gameId, basePayload));
      return;
    }

    const optimisticId = `tennis-${Date.now()}-${(tennisClientEventSeqRef.current += 1)}`;
    const eventPayload = {
      ...basePayload,
      _optimisticId: optimisticId,
    };

    const nextGame = applyOptimisticTennisUpdate(latestGame, eventPayload);
    if (nextGame === latestGame) return;

    const action = { id: optimisticId, type: "event", payload: eventPayload };
    tennisPendingActionsRef.current = [...tennisPendingActionsRef.current, action];
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);

    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;
    scheduleTennisPersist(action, () => addGameEventAPI(gameId, persistPayload));
  }, [currentGame, currentGameRef, gameId, gameOver, isOwner, isUpdating, players, scheduleTennisPersist, setCurrentGame, teamId, teamNames]);

  const handleBadmintonRallyEvent = useCallback((eventType, teamSide, selectedPlayer) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    if (gameOver || isGameFinished(currentGame)) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame?.sport || latestGame.sport.matchStatus === "final") return;

    const base = latestGame.base;
    const sportData = latestGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const teamPlayers = (players?.[teamSide] || []).filter(Boolean);
    const rep = selectedPlayer || (teamPlayers.length === 1 ? teamPlayers[0] : null);
    const optimisticId = `badminton-${Date.now()}-${(badmintonClientEventSeqRef.current += 1)}`;
    const eventPayload = {
      eventType,
      playerId: rep?._id || rep?.id || `team_${tId}`,
      teamId: tId,
      playerName: rep ? formatName(rep) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      gameNumber: sportData?.currentGameNumber || 1,
      setNumber: sportData?.currentSetNumber || 1,
      source: "mobile_scoring_panel",
      operatorTeamId: teamId,
      timestamp: new Date().toISOString(),
      _optimisticId: optimisticId,
    };

    const nextGame = applyOptimisticBadmintonEvent(latestGame, eventPayload);
    if (nextGame === latestGame) return;

    const action = { id: optimisticId, type: "event", payload: eventPayload };
    badmintonPendingActionsRef.current = [...badmintonPendingActionsRef.current, action];
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);
    setGameOver?.(isGameFinished(nextGame));

    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;
    scheduleBadmintonPersist(action, () => addGameEventAPI(gameId, persistPayload));
  }, [currentGame, currentGameRef, gameId, gameOver, isOwner, isUpdating, players, scheduleBadmintonPersist, setCurrentGame, setGameOver, teamId, teamNames]);

  const handleTableTennisRallyEvent = useCallback((eventType, teamSide, selectedPlayer) => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    if (gameOver || isGameFinished(currentGame)) return;

    const latestGame = currentGameRef?.current || currentGame;
    if (!latestGame?.sport || latestGame.sport.matchStatus === "final") return;

    const base = latestGame.base;
    const sportData = latestGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const teamPlayers = (players?.[teamSide] || []).filter(Boolean);
    const rep = selectedPlayer || (teamPlayers.length === 1 ? teamPlayers[0] : null);
    const pointNumber = Number(sportData?.currentPointScore?.player1 || 0)
      + Number(sportData?.currentPointScore?.player2 || 0)
      + 1;
    const optimisticId = `table-tennis-${Date.now()}-${(tableTennisClientEventSeqRef.current += 1)}`;
    const eventPayload = {
      eventType,
      playerId: rep?._id || rep?.id || `team_${tId}`,
      teamId: tId,
      playerName: rep ? formatName(rep) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      gameNumber: sportData?.currentGame || 1,
      pointNumber,
      ...(eventType === "timeout" ? { wasTimerRunning: !!gameTime?.isRunning } : {}),
      source: "mobile_scoring_panel",
      operatorTeamId: teamId,
      timestamp: new Date().toISOString(),
      _optimisticId: optimisticId,
    };

    const nextGame = applyOptimisticTableTennisUpdate(latestGame, eventPayload);
    if (nextGame === latestGame) return;

    const action = { id: optimisticId, type: "event", payload: eventPayload };
    tableTennisPendingActionsRef.current = [...tableTennisPendingActionsRef.current, action];
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);

    const persistPayload = { ...eventPayload };
    delete persistPayload._optimisticId;
    scheduleTableTennisPersist(action, () => addGameEventAPI(gameId, persistPayload));
  }, [currentGame, currentGameRef, gameId, gameOver, gameTime?.isRunning, isOwner, isUpdating, players, scheduleTableTennisPersist, setCurrentGame, teamId, teamNames]);

  // ── Rally (Tennis, Badminton, TableTennis, Pickleball) ──
  const handleRallyEvent = useCallback(async (eventType, teamSide, selectedPlayer) => {
    if (sport === "Tennis") {
      handleTennisRallyEvent(eventType, teamSide, selectedPlayer);
      return;
    }

    if (sport === "Badminton") {
      handleBadmintonRallyEvent(eventType, teamSide, selectedPlayer);
      return;
    }

    if (sport === "TableTennis" || sport === "Table Tennis") {
      handleTableTennisRallyEvent(eventType, teamSide, selectedPlayer);
      return;
    }

    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    if (gameOver || isGameFinished(currentGame)) return;
    const base = currentGame.base;
    const sportData = currentGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;

    // Player attribution: use explicit selection (doubles) > single player > team fallback
    const teamPlayers = (players?.[teamSide] || []).filter(Boolean);
    const rep = selectedPlayer || (teamPlayers.length === 1 ? teamPlayers[0] : null);
    setIsUpdating(true);

    // ─── Smarter Optimistic UI Update ───────────────────────────────────────
    const isScoreEvent = ["pointWon", "serve_ace", "forehand_smash", "unforced_error"].includes(eventType);
    if (sport === "Badminton" && setCurrentGame) {
      setCurrentGame((prev) => applyOptimisticBadmintonUpdate(prev, eventType, teamSide, selectedPlayer));
      if ((currentGame?.sport?.result?.homeGamesWon || 0) === 1 || (currentGame?.sport?.result?.awayGamesWon || 0) === 1) {
        const scoringSide = getBadmintonScoringSide(eventType, teamSide);
        if (scoringSide) {
          const projectedScore = {
            ...(currentGame?.sport?.score || { home: 0, away: 0 }),
            [scoringSide]: ((currentGame?.sport?.score || { home: 0, away: 0 })[scoringSide] || 0) + 1,
          };
          const leader = Math.max(projectedScore.home, projectedScore.away);
          const trailer = Math.min(projectedScore.home, projectedScore.away);
          if ((leader >= 21 && leader - trailer >= 2) || leader >= 30) {
            const winnerSide = projectedScore.home > projectedScore.away ? "home" : "away";
            const homeWins = (currentGame?.sport?.result?.homeGamesWon || 0) + (winnerSide === "home" ? 1 : 0);
            const awayWins = (currentGame?.sport?.result?.awayGamesWon || 0) + (winnerSide === "away" ? 1 : 0);
            if (homeWins >= 2 || awayWins >= 2) {
              setGameOver?.(true);
            }
          }
        }
      }
    } else if (isScoreEvent && setCurrentGame && sportData?.currentPointScore) {
      // Determine which player/side actually scores
      const scoringSide = eventType === "unforced_error"
        ? (teamSide === "home" ? "away" : "home")
        : teamSide;
      const scoringKey = scoringSide === "home" ? "player1" : "player2";

      setCurrentGame((prev) => {
        if (!prev?.sport?.currentPointScore) return prev;
        const newPointScore = {
          ...prev.sport.currentPointScore,
          [scoringKey]: (prev.sport.currentPointScore[scoringKey] || 0) + 1,
        };

        // Optimistic serve switch calculation
        const p1 = newPointScore.player1;
        const p2 = newPointScore.player2;
        const totalPoints = p1 + p2;
        const matchConfig = prev.sport.matchConfig || {};
        const pointsToWin = matchConfig.pointsToWinGame || 11;
        const servesPerTurn = matchConfig.servesPerTurn || 2;
        const mustWinByTwo = matchConfig.mustWinByTwo !== false;
        const deuceThreshold = Math.max(pointsToWin - 1, 0);
        let newServingTeam = prev.sport.servingTeam || "home";

        if (mustWinByTwo && p1 >= deuceThreshold && p2 >= deuceThreshold) {
          // Deuce: alternate every point
          newServingTeam = prev.sport.servingTeam === "home" ? "away" : "home";
        } else if (totalPoints > 0 && totalPoints % servesPerTurn === 0) {
          newServingTeam = prev.sport.servingTeam === "home" ? "away" : "home";
        }

        // Optimistic game win check
        const reachedTarget = p1 >= pointsToWin || p2 >= pointsToWin;
        const hasMargin = mustWinByTwo ? Math.abs(p1 - p2) >= 2 : true;
        if (reachedTarget && hasMargin) {
          const gameWinner = p1 > p2 ? "home" : "away";
          const newScore = { ...prev.sport.score };
          if (gameWinner === "home") newScore.home = (newScore.home || 0) + 1;
          else newScore.away = (newScore.away || 0) + 1;

          const gameStartingServer = prev.sport.gameStartingServer || "home";
          const nextStartServer = gameStartingServer === "home" ? "away" : "home";

          return {
            ...prev,
            sport: {
              ...prev.sport,
              currentPointScore: { player1: 0, player2: 0 },
              score: newScore,
              currentGame: (prev.sport.currentGame || 1) + 1,
              servingTeam: nextStartServer,
              gameStartingServer: nextStartServer,
              gameScores: [...(prev.sport.gameScores || []), {
                gameNumber: prev.sport.currentGame || 1,
                player1Points: p1,
                player2Points: p2,
                winner: p1 > p2 ? "player1" : "player2",
              }],
            },
          };
        }

        return {
          ...prev,
          sport: {
            ...prev.sport,
            currentPointScore: newPointScore,
            servingTeam: newServingTeam,
          },
        };
      });
    }

    // ─── Fire API with audit metadata (offline-safe) ───────────────────────
    const eventPayload = {
      eventType,
      playerId: rep?._id || rep?.id || `team_${tId}`,
      teamId: tId,
      playerName: rep ? formatName(rep) : "Team",
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home,
      awayTeamName: teamNames.away,
      teamSide,
      gameNumber: sportData?.currentGameNumber || sportData?.currentGame || 1,
      setNumber: sportData?.currentSetNumber || 1,
      ...(eventType === "timeout" ? { wasTimerRunning: !!gameTime?.isRunning } : {}),
      // Audit metadata
      source: "mobile_scoring_panel",
      operatorTeamId: teamId,
      timestamp: new Date().toISOString(),
    };

    try {
      const apiCall = () => addGameEventAPI(gameId, eventPayload);
      if (queueOrFire && !isOnline) {
        await queueOrFire(apiCall, `${eventType} (${teamSide})`);
        // Queued offline — optimistic state stays until sync
      } else {
        await apiCall();
        await fetchGame();
      }
    } catch (error) {
      await fetchGame();
      const msg = error?.response?.data?.error || "Event failed";
      showToast(`Sync failed: ${msg}. Score refreshed from server.`, "error", "top");
    }
    finally { setIsUpdating(false); }
  }, [currentGame, gameId, teamId, isOwner, gameOver, isUpdating, players, teamNames, fetchGame, setCurrentGame, setGameOver, gameTime?.isRunning, queueOrFire, isOnline, sport, handleBadmintonRallyEvent, handleTableTennisRallyEvent, handleTennisRallyEvent]);

  const selectDerivedCricketGame = useMemo(() => createDerivedGameSelector(), []);

  // ── Cricket Undo (remove last ball event with confirmation) ──
  const handleCricketUndo = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner || gameOver || isUpdating || cricketPendingSyncCount > 0) return;
    const liveState = store.getState();
    const derivedGame = selectDerivedCricketGame(liveState, gameId);
    const gameForUndo = derivedGame || currentGameRef?.current || currentGame;
    const events = gameForUndo?.sport?.events;
    if (!Array.isArray(events) || events.length === 0) {
      Alert.alert("Undo", "No balls to undo.");
      return;
    }
    const lastEvent = events[events.length - 1];
    const label = (lastEvent?.eventType || "event").replace(/_/g, " ");
    Alert.alert(
      "Undo Last Ball",
      `Remove the last delivery (${label})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          style: "destructive",
          onPress: async () => {
            setIsUpdating(true);
            try {
              const pending = selectPendingEvents(store.getState(), gameId);
              if (pending.length > 0) {
                store.dispatch(
                  rollbackOptimistic({
                    gameId,
                    optimisticId: pending[pending.length - 1].optimisticId,
                  }),
                );
              }
              await removeLastEventAPI(gameId);
              const fetchedGame = await fetchGame();
              const resetSnapshot = reconcileCricketTotalsFromEvents(
                fetchedGame || currentGameRef?.current || currentGame,
              );
              if (resetSnapshot?.base && resetSnapshot?.sport) {
                if (currentGameRef) {
                  currentGameRef.current = resetSnapshot;
                }
                setCurrentGame?.(resetSnapshot);
                store.dispatch(
                  forceResetFromServer({
                    gameId,
                    snapshot: resetSnapshot,
                    version: Number(resetSnapshot.base?.version) || 0,
                  }),
                );
              }
            } catch (e) {
              Alert.alert("Undo Failed", e?.response?.data?.error || "Could not undo last ball.");
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  }, [
    cricketPendingSyncCount,
    currentGame,
    currentGameRef,
    gameId,
    isOwner,
    gameOver,
    isUpdating,
    fetchGame,
    setCurrentGame,
    selectDerivedCricketGame,
  ]);

  // ── Pickleball Undo (uses removeLastEventAPI for reliable score rebuild) ──
  const handlePickleballUndo = useCallback(async () => {
    if (!currentGame || !gameId || !isOwner || gameOver || isUpdating) return;
    setIsUpdating(true);
    try {
      await removeLastEventAPI(gameId);
      await fetchGame();
    } catch { Alert.alert("Error", "Nothing to undo"); }
    finally { setIsUpdating(false); }
  }, [currentGame, gameId, isOwner, gameOver, isUpdating, fetchGame]);

  const handleTableTennisUndo = useCallback(() => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    const latestGame = currentGameRef?.current || currentGame;
    const events = (latestGame?.sport?.events || []).filter((event) => event && event.eventType !== "undo");
    if (events.length === 0) {
      Alert.alert("Nothing to undo", "No table tennis points or actions have been recorded yet.");
      return;
    }
    const lastEvent = events[events.length - 1];
    Alert.alert(
      "Undo Last Event",
      `Remove \"${(lastEvent?.eventType || "last event").replace(/_/g, " ")}\"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          style: "destructive",
          onPress: () => {
            const latestOptimisticGame = currentGameRef?.current || currentGame;
            const { nextGame, removedEvent } = applyOptimisticTableTennisUndo(latestOptimisticGame);
            if (!removedEvent) {
              Alert.alert("Nothing to undo", "No table tennis points or actions have been recorded yet.");
              return;
            }

            const optimisticId = `table-tennis-undo-${Date.now()}-${(tableTennisClientEventSeqRef.current += 1)}`;
            const action = { id: optimisticId, type: "undo" };
            tableTennisPendingActionsRef.current = [...tableTennisPendingActionsRef.current, action];
            if (currentGameRef) {
              currentGameRef.current = nextGame;
            }
            setCurrentGame?.(nextGame);

            scheduleTableTennisPersist(action, () => removeLastEventAPI(gameId));
          },
        },
      ],
    );
  }, [currentGame, currentGameRef, gameId, isOwner, isUpdating, scheduleTableTennisPersist, setCurrentGame]);

  const handleBadmintonUndo = useCallback(() => {
    if (!currentGame || !gameId || !isOwner || isUpdating) return;
    const latestGame = currentGameRef?.current || currentGame;
    const events = (latestGame?.sport?.events || []).filter(
      (event) => event && !["undo", "interval", "change_of_ends"].includes(event.eventType),
    );
    if (events.length === 0) {
      Alert.alert("Nothing to undo", "No badminton rallies or actions have been recorded yet.");
      return;
    }
    const { nextGame, removedEvent } = applyOptimisticBadmintonUndo(latestGame);
    if (!removedEvent) {
      Alert.alert("Nothing to undo", "No badminton rallies or actions have been recorded yet.");
      return;
    }

    const optimisticId = `badminton-undo-${Date.now()}-${(badmintonClientEventSeqRef.current += 1)}`;
    const action = { id: optimisticId, type: "undo" };
    badmintonPendingActionsRef.current = [...badmintonPendingActionsRef.current, action];
    if (currentGameRef) {
      currentGameRef.current = nextGame;
    }
    setCurrentGame?.(nextGame);
    setGameOver?.(isGameFinished(nextGame));

    scheduleBadmintonPersist(action, () => removeLastEventAPI(gameId));
  }, [currentGame, currentGameRef, gameId, isOwner, isUpdating, scheduleBadmintonPersist, setCurrentGame, setGameOver]);

  // ── Baseball ──
  const handleBaseballEvent = useCallback(async (eventType, teamSide, selectedPlayerId, extraData = {}) => {
    if (!currentGame || !gameId || !isOwner || gameOver || isUpdating) return;
    const base = currentGame.base;
    const sportData = currentGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const sel = selectedPlayerId ? all.find((p) => String(p._id || p.id) === String(selectedPlayerId)) : null;
    const rep = sel || (players[teamSide] || []).filter(Boolean)[0];
    setIsUpdating(true);
    try {
      await addGameEventAPI(gameId, {
        eventType, playerId: selectedPlayerId || rep?._id || rep?.id, teamId: tId,
        playerName: rep ? formatName(rep) : "Team",
        teamName: teamSide === "home" ? teamNames.home : teamNames.away,
        homeTeamName: teamNames.home, awayTeamName: teamNames.away, teamSide,
        inning: sportData?.currentInning || 1, inningHalf: sportData?.inningHalf || "top", outs: sportData?.outs || 0,
        ...extraData,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Event failed"); }
    finally { setIsUpdating(false); }
  }, [currentGame, gameId, isOwner, gameOver, isUpdating, players, teamNames, fetchGame]);

  const handleBaseballSubstitution = useCallback(async (teamSide, playerOutId, playerInId, extraData = {}) => {
    if (!gameId || !isOwner || isUpdating) return;
    const base = currentGame?.base;
    if (!base) return;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const pIn = all.find(p => String(p._id || p.id) === String(playerInId));
    setIsUpdating(true);
    try {
      await makeSubstitutionAPI(gameId, {
        playerIn: playerInId,
        playerOut: playerOutId,
        teamId: tId,
        playerInName: pIn ? formatName(pIn) : "Player",
        playerInJersey: pIn?.jerseyNumber ?? pIn?.number,
        position: extraData.position,
        reason: extraData.reason || "strategic",
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Substitution failed"); }
    finally { setIsUpdating(false); }
  }, [gameId, isOwner, isUpdating, currentGame, players, teamNames, fetchGame]);

  const handleBaseballSetupLineup = useCallback(async ({ side, players: lineupPlayers }) => {
    if (!gameId || !isOwner || isUpdating) return;
    if (!Array.isArray(lineupPlayers) || lineupPlayers.length < 1 || lineupPlayers.length > 9) {
      Alert.alert(
        "Invalid lineup",
        lineupPlayers?.length > 9
          ? "Lineup cannot exceed 9 players. Fielding must use the same players as your batting order."
          : "Select 1 to 9 players for the batting order.",
      );
      return;
    }
    setIsUpdating(true);
    try {
      await updateBaseballLineupAPI(gameId, {
        team: side,
        players: lineupPlayers,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Failed to save batting order"); }
    finally { setIsUpdating(false); }
  }, [gameId, isOwner, isUpdating, fetchGame]);

  const handleBaseballUndo = useCallback(async () => {
    if (!gameId || !isOwner || isUpdating) return;
    const events = currentGame?.sport?.events || [];
    if (events.length === 0) {
      Alert.alert("Nothing to undo", "No events recorded yet.");
      return;
    }
    setIsUpdating(true);
    try {
      await removeLastEventAPI(gameId);
      await fetchGame();
    } catch { Alert.alert("Error", "Undo failed"); }
    finally { setIsUpdating(false); }
  }, [gameId, isOwner, isUpdating, currentGame, fetchGame]);

  // ── Rugby (optimistic) ──
  const finishRugbyPersist = useCallback(async (shouldFetch) => {
    rugbyPendingSyncRef.current = Math.max(0, rugbyPendingSyncRef.current - 1);
    if (shouldFetch && rugbyPendingSyncRef.current === 0) {
      rugbyPendingActionsRef.current = [];
      await fetchGame();
    }
  }, [fetchGame]);

  const scheduleRugbyPersist = useCallback((action, persistFn, label) => {
    if (!gameId) return;

    rugbyPendingSyncRef.current += 1;

    const persist = async () => {
      let shouldFetch = true;
      try {
        await persistFn();
      } catch (error) {
        shouldFetch = false;
        rugbyPendingActionsRef.current = rugbyPendingActionsRef.current.filter(
          (a) => a.id !== action.id,
        );

        const serverSnapshot = rugbyServerSnapshotRef.current
          ? cloneGameSnapshot(rugbyServerSnapshotRef.current)
          : null;
        if (serverSnapshot && setCurrentGame) {
          setCurrentGame(replayPendingRugbyActions(serverSnapshot, rugbyPendingActionsRef.current));
        } else {
          await fetchGame();
        }
        const message = error?.response?.data?.error || error?.message || "Rugby event failed";
        showToast(`Sync failed: ${message}. Score refreshed.`, "error", "top");
      } finally {
        await finishRugbyPersist(shouldFetch);
      }
    };

    rugbyPersistChainRef.current = rugbyPersistChainRef.current.then(persist, persist);
  }, [finishRugbyPersist, gameId, setCurrentGame, fetchGame]);

  const RUGBY_ON_FIELD_MAX = 15;

  const handleRugbyKickoffLineup = useCallback(async (side, onFieldPlayerIds) => {
    if (!currentGame || !gameId || !isOwner) return;
    if (!isSelfOwnedOpponent && side !== userSide) return;

    const ids = (onFieldPlayerIds || []).map(String).filter(Boolean);
    if (ids.length > RUGBY_ON_FIELD_MAX) {
      Alert.alert("Too many players", `You can only have ${RUGBY_ON_FIELD_MAX} players on the field.`);
      return;
    }

    const base = currentGame.base;
    const teamId = side === "home" ? base.teamId : base.opponentTeamId;
    const roster = (players?.[side] || []).filter((p) => p && p.role !== "manager");
    const lineupField = side === "home" ? "homeLineup" : "awayLineup";
    const existingLineup = currentGame?.sport?.[lineupField] || [];

    const lineupPlayers = ids.map((id) => {
      const p = roster.find((player) => String(player._id || player.id) === id);
      const existing = existingLineup.find((slot) => String(slot?.playerId) === id);
      return {
        playerId: id,
        teamId: String(teamId),
        position: existing?.position || p?.position || "",
        jerseyNumber: p?.jerseyNumber ?? existing?.jerseyNumber,
        isStarter: true,
        isCaptain: !!existing?.isCaptain,
        isKicker: !!existing?.isKicker,
      };
    });

    if (setCurrentGame) {
      setCurrentGame((prev) => {
        if (!prev?.sport) return prev;
        const next = cloneGameSnapshot(prev);
        next.sport[lineupField] = lineupPlayers;
        if (currentGameRef) {
          currentGameRef.current = next;
        }
        return next;
      });
    }

    try {
      await updateRugbyLineupAPI(gameId, { team: side, players: lineupPlayers });
      const refreshed = await fetchGame();
      if (refreshed?.sport && setCurrentGame) {
        setCurrentGame(refreshed);
        if (currentGameRef) {
          currentGameRef.current = refreshed;
        }
      }
    } catch {
      await fetchGame();
      Alert.alert("Error", "Failed to update lineup");
    }
  }, [
    currentGame,
    currentGameRef,
    fetchGame,
    gameId,
    isOwner,
    isSelfOwnedOpponent,
    players,
    setCurrentGame,
    userSide,
  ]);

  const handleRugbyEvent = useCallback((eventType, teamSide, selectedPlayerId) => {
    if (!currentGame || !gameId || !isOwner || gameOver) {
      return;
    }
    const isGameLevelEvent = eventType === "second_half" || eventType === "extra_time" || eventType === "extra_time_2" || eventType === "undo";
    if (!isSelfOwnedOpponent && eventType === "possession_change") {
      if (currentGame?.sport?.possessionTeam) return;
    }
    if (!isGameLevelEvent && !isSelfOwnedOpponent && teamSide !== userSide) {
      return;
    }
    const base = currentGame.base;
    const sportData = currentGame.sport;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);

    const skipped = selectedPlayerId === null;
    const sel = selectedPlayerId ? all.find((p) => String(p._id || p.id) === String(selectedPlayerId)) : null;
    const rep = skipped ? null : (sel || (players[teamSide] || []).filter(Boolean)[0]);
    const playerId = skipped ? `team_${tId}` : (selectedPlayerId || rep?._id || rep?.id || `team_${tId}`);
    const playerName = rep ? formatName(rep) : "Team";

    // ── Match state changes (not optimistic — rare, can wait) ──
    if (eventType === "possession_change") {
      setIsUpdating(true);
      updateRugbyMatchStateAPI(gameId, { possessionTeam: tId })
        .then(() => fetchGame())
        .catch(() => {})
        .finally(() => setIsUpdating(false));
      return;
    }
    if (eventType === "second_half") {
      setIsUpdating(true);
      updateRugbyMatchStateAPI(gameId, { currentHalf: 2, matchStatus: "second_half" })
        .then(() => fetchGame())
        .catch(() => {})
        .finally(() => setIsUpdating(false));
      return;
    }
    if (eventType === "extra_time") {
      setIsUpdating(true);
      updateRugbyMatchStateAPI(gameId, { currentHalf: 3, matchStatus: "extra_time" })
        .then(() => fetchGame())
        .catch(() => {})
        .finally(() => setIsUpdating(false));
      return;
    }
    if (eventType === "extra_time_2") {
      setIsUpdating(true);
      updateRugbyMatchStateAPI(gameId, { currentHalf: 4, matchStatus: "extra_time" })
        .then(() => fetchGame())
        .catch(() => {})
        .finally(() => setIsUpdating(false));
      return;
    }
    if (eventType === "undo") {
      // Optimistic undo
      let action = null;
      setCurrentGame((prev) => {
        const { nextGame, removedEvent } = applyOptimisticRugbyUndo(prev);
        if (!removedEvent) return prev;
        const optimisticId = `rugby-undo-${Date.now()}-${(rugbyClientEventSeqRef.current += 1)}`;
        action = { id: optimisticId, type: "undo", teamSide };
        rugbyPendingActionsRef.current = [...rugbyPendingActionsRef.current, action];
        return nextGame;
      });
      if (action) {
        scheduleRugbyPersist(action, () => removeLastEventAPI(gameId), "undo");
      }
      return;
    }

    // ── Scoring / card / event — fully optimistic ──
    const eventPayload = {
      eventType, playerId, teamId: tId,
      playerName,
      teamName: teamSide === "home" ? teamNames.home : teamNames.away,
      homeTeamName: teamNames.home, awayTeamName: teamNames.away, teamSide,
      currentHalf: sportData?.currentHalf || 1,
      minute: sportData?.currentMinute || 0,
    };
    if (eventType === "yellow_card") {
      eventPayload.sinBinUntil = new Date(Date.now() + 600000).toISOString();
    }

    const optimisticId = `rugby-${Date.now()}-${(rugbyClientEventSeqRef.current += 1)}`;
    eventPayload._optimisticId = optimisticId;

    let action = null;
    setCurrentGame((prev) => {
      const nextGame = applyOptimisticRugbyUpdate(prev, eventPayload);
      action = { id: optimisticId, type: "event", payload: eventPayload };
      rugbyPendingActionsRef.current = [...rugbyPendingActionsRef.current, action];
      return nextGame;
    });

    if (action) {
      const persistPayload = { ...eventPayload };
      delete persistPayload._optimisticId;
      const label = `${eventType.replace(/_/g, " ")} (${teamSide})`;
      scheduleRugbyPersist(action, () => addGameEventAPI(gameId, persistPayload), label);
    }
  }, [currentGame, gameId, isOwner, gameOver, isSelfOwnedOpponent, players, teamNames, fetchGame, userSide, setCurrentGame, scheduleRugbyPersist]);

  const handleRugbySubstitution = useCallback(async (data) => {
    if (!gameId || !isOwner || isUpdating) return;
    const base = currentGame?.base;
    if (!base) return;
    const sportData = currentGame?.sport;
    const teamSide = data.teamSide || "home";
    if (!isSelfOwnedOpponent && teamSide !== userSide) return;
    const tId = teamSide === "home" ? base.teamId : base.opponentTeamId;
    const all = [...(players?.home || []), ...(players?.away || [])].filter(Boolean);
    const pIn = all.find(p => String(p._id || p.id) === String(data.playerInId));
    setIsUpdating(true);
    try {
      await makeSubstitutionAPI(gameId, {
        playerIn: data.playerInId,
        playerOut: data.playerOutId,
        teamId: tId,
        playerInName: pIn ? formatName(pIn) : "Player",
        playerInJersey: pIn?.jerseyNumber ?? pIn?.number,
        position: data.position,
        description: data.reason || "tactical",
        reason: data.reason || "tactical",
        minute: sportData?.currentMinute || 0,
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
      });
      await fetchGame();
    } catch { Alert.alert("Error", "Substitution failed"); }
    finally { setIsUpdating(false); }
  }, [gameId, isOwner, isSelfOwnedOpponent, isUpdating, currentGame, players, teamNames, fetchGame, userSide]);

  // ── Chess ──
  const handleChessEvent = useCallback(async (eventType, extraData) => {
    if (!currentGame || !gameId) return;
    const playerOnlyEvents = new Set(["move", "resign", "draw_offer", "draw_accept", "draw_decline"]);
    if (isOwner && playerOnlyEvents.has(eventType)) {
      Alert.alert("Coach view", "Only players can move pieces or offer resign/draw.");
      return;
    }
    const base = currentGame.base;
    const moveColor = extraData?.color || currentGame?.sport?.currentTurn || "white";
    const homeTeamId = String(base.teamId || "");
    const awayTeamId = String(base.opponentTeamId || "");
    const movingTeamId = moveColor === "white" ? homeTeamId : awayTeamId;
    const movingSide = moveColor === "white" ? "home" : "away";
    const sidePlayers = movingSide === "home" ? (players?.home || []) : (players?.away || []);
    const rep = sidePlayers[0];
    setIsUpdating(true);
    try {
      const response = await addGameEventAPI(gameId, {
        eventType, playerId: rep?._id || rep?.id || `team_${movingTeamId}`, teamId: movingTeamId,
        playerName: rep ? formatName(rep) : "Player",
        teamName: movingSide === "home" ? teamNames.home : teamNames.away,
        homeTeamName: teamNames.home, awayTeamName: teamNames.away,
        moveNumber: extraData?.moveNumber || currentGame?.sport?.currentMoveNumber || 1,
        color: extraData?.color || currentGame?.sport?.currentTurn || "white",
        fen: extraData?.fen, notation: extraData?.san,
        fromSquare: extraData?.fromSquare, toSquare: extraData?.toSquare,
        promotion: extraData?.promotion, isCheck: extraData?.isCheck,
        isCheckmate: extraData?.isCheckmate, isStalemate: extraData?.isStalemate,
        isDraw: extraData?.isDraw, drawReason: extraData?.drawReason,
        captured: extraData?.captured, piece: extraData?.piece,
      });
      const updatedSport = response?.data?.game;
      if (updatedSport && setCurrentGame) {
        setCurrentGame((prev) => {
          if (!prev?.base) return prev;
          const next = { ...prev, sport: updatedSport };
          if (currentGameRef) currentGameRef.current = next;
          return next;
        });
      }
    } catch { Alert.alert("Error", "Move failed to save"); }
    finally { setIsUpdating(false); }
  }, [currentGame, gameId, isOwner, players, teamNames, setCurrentGame, currentGameRef]);

  return {
    // Game lifecycle
    handleStartGame, handleEndGame,
    // Sport handlers
    handleHockeyEvent, handleHockeySetupLineup, handleIceHockeyEvent, handleFootballEvent, handleFootballUndo, handleFootballSubstitution, handleFootballSetupLineup, handleFootballMatchState, handleFootballTimerAdjust, handleBasketballEvent, handleBasketballUndo, handleBasketballSubstitution, handleBasketballSetupLineup,
    handleVolleyballRally, handleVolleyballSetupLineup, handleVolleyballSubstitution,
    handleVolleyballLiberoSwap, handleVolleyballTimeout, handleVolleyballChallenge, handleVolleyballUndo,
    handleRallyEvent, handlePickleballUndo, handleTableTennisUndo, handleBadmintonUndo, handleBaseballEvent, handleBaseballSetupLineup, handleBaseballSubstitution, handleBaseballUndo, handleRugbyEvent, handleRugbyKickoffLineup, handleRugbySubstitution,
    // Cricket
    handleCricketScore, handleCricketWicket, handleSwapStrike,
    handleChangeBowler, handleSetBattingOrder, handleTossSelection, handleOversConfirm, handleStartSecondInnings, handleStartSuperOver, handleCricketUndo,
    // Chess
    handleChessEvent,
    // Cricket state
    oversSelection, setOversSelection, tossSelection, setTossSelection, isCricketSyncing: cricketPendingSyncCount > 0,
    // Hockey state
    liveEvents,
  };
}
