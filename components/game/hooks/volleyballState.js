const VOLLEYBALL_ERROR_EVENTS = new Set(["serve_error", "attack_error", "fault"]);
const VOLLEYBALL_POINT_EVENTS = new Set([
  "point",
  "serve_ace",
  "service_ace",
  "attack_kill",
  "kill",
  "block_point",
  "side_out",
]);

const createEmptyMatchStats = () => ({
  attacks: { home: 0, away: 0 },
  attack_kills: { home: 0, away: 0 },
  blocks: { home: 0, away: 0 },
  aces: { home: 0, away: 0 },
  digs: { home: 0, away: 0 },
  reception_perfect: { home: 0, away: 0 },
  errors: { home: 0, away: 0 },
  set_assists: { home: 0, away: 0 },
});

const createSetEntry = (setNumber = 1) => ({
  setNumber,
  homeScore: 0,
  awayScore: 0,
  winner: null,
  duration: null,
});

const cloneSideBucket = (bucket = {}) => ({
  home: Number(bucket?.home || 0),
  away: Number(bucket?.away || 0),
});

const cloneMatchStats = (stats = {}) => {
  const fallback = createEmptyMatchStats();
  return Object.keys(fallback).reduce((next, key) => {
    next[key] = cloneSideBucket(stats?.[key] || fallback[key]);
    return next;
  }, {});
};

const cloneResult = (result = {}) => ({
  ...result,
  setsWon: {
    home: Number(result?.setsWon?.home || 0),
    away: Number(result?.setsWon?.away || 0),
  },
  winner: result?.winner || null,
});

const cloneVolleyballEvent = (event = {}) => ({ ...event });

const isRallyEventType = (eventType) =>
  VOLLEYBALL_POINT_EVENTS.has(eventType) || VOLLEYBALL_ERROR_EVENTS.has(eventType);

const shouldScoreEvent = (event = {}) =>
  isRallyEventType(event.eventType) && (event.isRallyPoint === undefined || event.isRallyPoint === true);

/** Rally events that affect the scoreboard (for undo/sync guards). */
export const countVolleyballRallyEvents = (game) => {
  if (!game?.sport?.events) return 0;
  return (game.sport.events || []).filter(
    (event) => event && event.eventType !== "undo" && shouldScoreEvent(event),
  ).length;
};

/** Current-set scores used to detect stale server/socket snapshots after undo. */
export const getVolleyballCurrentSetScorePair = (game) => {
  const sport = game?.sport;
  if (!sport) return { home: 0, away: 0 };
  const setNumber = Math.max(1, Number(sport.currentSet || 1));
  const setEntry = (sport.sets || [])[setNumber - 1] || {};
  return {
    home: Number(setEntry.homeScore ?? sport.homeScore ?? 0),
    away: Number(setEntry.awayScore ?? sport.awayScore ?? 0),
  };
};

export const volleyballSetScoreSignature = (game) => {
  const { home, away } = getVolleyballCurrentSetScorePair(game);
  return `${home}-${away}`;
};

const getOppositeTeamId = (teamId, base = {}) =>
  String(teamId) === String(base?.teamId) ? base?.opponentTeamId : base?.teamId;

const getScoringTeamId = (event = {}, base = {}) => {
  if (event.scoringTeamId) return event.scoringTeamId;
  if (VOLLEYBALL_ERROR_EVENTS.has(event.eventType) || event.eventType === "side_out") {
    return getOppositeTeamId(event.teamId, base);
  }
  return event.teamId;
};

const getEventSide = (event = {}, base = {}) =>
  String(event?.teamId) === String(base?.teamId) ? "home" : "away";

const ensureSetEntry = (sport, setNumber) => {
  const normalizedSet = Math.max(1, Number(setNumber || 1));
  if (!Array.isArray(sport.sets) || sport.sets.length === 0) {
    sport.sets = [createSetEntry(1)];
  }
  while (sport.sets.length < normalizedSet) {
    sport.sets.push(createSetEntry(sport.sets.length + 1));
  }
  if (!sport.sets[normalizedSet - 1]) {
    sport.sets[normalizedSet - 1] = createSetEntry(normalizedSet);
  }
  return sport.sets[normalizedSet - 1];
};

const deriveReplayServingTeam = (sport, base, firstEvent) => {
  if (!firstEvent) return sport?.servingTeam || null;
  if (!shouldScoreEvent(firstEvent)) {
    return firstEvent.servingTeam || sport?.servingTeam || null;
  }
  const storedServingTeam = firstEvent.servingTeam || null;
  if (!storedServingTeam) return sport?.servingTeam || null;
  if (!firstEvent.serveChanges) return storedServingTeam;
  return getOppositeTeamId(getScoringTeamId(firstEvent, base), base);
};

const createReplaySport = (sport = {}, base = {}, firstEvent = null) => {
  const servingTeam = deriveReplayServingTeam(sport, base, firstEvent);
  return {
    ...sport,
    score: { home: 0, away: 0 },
    homeScore: 0,
    awayScore: 0,
    currentSet: 1,
    rallyCount: 0,
    servingTeam: servingTeam || null,
    receivingTeam: servingTeam ? getOppositeTeamId(servingTeam, base) : null,
    homeRotation: Number(firstEvent?.homeRotation || 1),
    awayRotation: Number(firstEvent?.awayRotation || 1),
    sets: [createSetEntry(1)],
    matchStatus: firstEvent ? "set_1" : (sport?.matchStatus || "scheduled"),
    result: cloneResult(sport?.result),
    timeouts: [],
    substitutions: [],
    matchStats: cloneMatchStats(sport?.matchStats),
    events: [],
  };
};

const normalizeIncomingEvent = (sport, base, rawEvent = {}) => {
  const event = cloneVolleyballEvent(rawEvent);

  if (event.setNumber === undefined) {
    event.setNumber = sport.currentSet || 1;
  }
  if (event.rotation === undefined) {
    event.rotation = Number(
      String(event.teamId) === String(base?.teamId)
        ? sport.homeRotation || 1
        : sport.awayRotation || 1,
    );
  }
  if (event.homeRotation === undefined) {
    event.homeRotation = Number(sport.homeRotation || 1);
  }
  if (event.awayRotation === undefined) {
    event.awayRotation = Number(sport.awayRotation || 1);
  }
  if (event.servingTeam === undefined) {
    event.servingTeam = sport.servingTeam || null;
  }
  if (event.rallyNumber === undefined) {
    event.rallyNumber = (sport.rallyCount || 0) + 1;
  }
  if (event.point === undefined) {
    event.point = String(event.teamId) === String(base?.teamId)
      ? sport.homeScore || 0
      : sport.awayScore || 0;
  }
  if (VOLLEYBALL_POINT_EVENTS.has(event.eventType) && event.isRallyPoint === undefined) {
    event.isRallyPoint = true;
  }
  if (event.timestamp === undefined) {
    event.timestamp = new Date().toISOString();
  }
  if (event._optimisticId) {
    event.optimistic = true;
  }

  return event;
};

const applyVolleyballEvent = (sport, event, base = {}) => {
  const currentSet = Number(event.setNumber || sport.currentSet || 1);
  const currentSetEntry = ensureSetEntry(sport, currentSet);
  const isHomeTeam = String(event.teamId) === String(base?.teamId);

  if (sport.matchStatus === "scheduled") {
    sport.matchStatus = `set_${currentSet}`;
  }

  if (shouldScoreEvent(event)) {
    const scoringTeamId = getScoringTeamId(event, base);
    const isScoringHomeTeam = String(scoringTeamId) === String(base?.teamId);

    if (isScoringHomeTeam) {
      currentSetEntry.homeScore = Number(currentSetEntry.homeScore || 0) + 1;
      sport.homeScore = Number(sport.homeScore || 0) + 1;
    } else {
      currentSetEntry.awayScore = Number(currentSetEntry.awayScore || 0) + 1;
      sport.awayScore = Number(sport.awayScore || 0) + 1;
    }

    sport.rallyCount = Number(sport.rallyCount || 0) + 1;

    const currentServingTeamId = sport.servingTeam;
    const serveChanges = !!event.serveChanges || (
      currentServingTeamId && String(scoringTeamId) !== String(currentServingTeamId)
    );

    if (serveChanges) {
      sport.servingTeam = scoringTeamId;
      sport.receivingTeam = getOppositeTeamId(scoringTeamId, base);
      if (isScoringHomeTeam) {
        sport.homeRotation = ((Number(sport.homeRotation || 1) % 6) + 1);
      } else {
        sport.awayRotation = ((Number(sport.awayRotation || 1) % 6) + 1);
      }
    }

    const homeSetScore = Number(currentSetEntry.homeScore || 0);
    const awaySetScore = Number(currentSetEntry.awayScore || 0);
    const totalSets = Number(sport.totalSets || 5);
    const setsToWin = Math.ceil(totalSets / 2);
    const regularPts = Number(sport.setPoints) || 25;
    const decidingPts = Number(sport.decidingSetPoints) || 15;
    const minPoints = currentSet >= totalSets ? decidingPts : regularPts;
    const winBy = sport.winByTwo === false ? 1 : 2;

    if (
      (homeSetScore >= minPoints || awaySetScore >= minPoints) &&
      Math.abs(homeSetScore - awaySetScore) >= winBy
    ) {
      const setWinner = homeSetScore > awaySetScore ? "home" : "away";
      currentSetEntry.winner = setWinner;
      currentSetEntry.duration = currentSetEntry.duration || null;

      if (!sport.result) {
        sport.result = cloneResult();
      }
      if (!sport.result.setsWon) {
        sport.result.setsWon = { home: 0, away: 0 };
      }
      sport.result.setsWon[setWinner] = Number(sport.result.setsWon[setWinner] || 0) + 1;

      if (
        sport.result.setsWon.home >= setsToWin ||
        sport.result.setsWon.away >= setsToWin ||
        currentSet >= totalSets
      ) {
        sport.matchStatus = "finished";
        sport.result.winner = sport.result.setsWon.home > sport.result.setsWon.away ? "home" : "away";
      } else {
        const nextSet = currentSet + 1;
        sport.currentSet = nextSet;
        sport.homeScore = 0;
        sport.awayScore = 0;
        sport.matchStatus = `set_${nextSet}`;
        ensureSetEntry(sport, nextSet);
        sport.servingTeam = setWinner === "home" ? base?.teamId : base?.opponentTeamId;
        sport.receivingTeam = setWinner === "home" ? base?.opponentTeamId : base?.teamId;
      }
    }
  }

  switch (event.eventType) {
    case "serve_ace":
    case "service_ace":
      sport.matchStats.aces[isHomeTeam ? "home" : "away"] += 1;
      break;
    case "serve_error":
      sport.matchStats.errors[isHomeTeam ? "home" : "away"] += 1;
      break;
    case "attack_kill":
    case "kill":
      sport.matchStats.attacks[isHomeTeam ? "home" : "away"] += 1;
      sport.matchStats.attack_kills[isHomeTeam ? "home" : "away"] += 1;
      break;
    case "attack_error":
      sport.matchStats.attacks[isHomeTeam ? "home" : "away"] += 1;
      sport.matchStats.errors[isHomeTeam ? "home" : "away"] += 1;
      break;
    case "block_point":
      sport.matchStats.blocks[isHomeTeam ? "home" : "away"] += 1;
      break;
    case "rotation":
      if (isHomeTeam) {
        sport.homeRotation = Number(event.rotation || 1);
      } else {
        sport.awayRotation = Number(event.rotation || 1);
      }
      break;
    case "timeout": {
      const teamId = String(event.teamId ?? "");
      const timeoutCount = (sport.timeouts || []).filter(
        (timeout) =>
          String(timeout?.teamId) === teamId &&
          Number(timeout?.setNumber) === currentSet,
      ).length;
      if (timeoutCount >= 2) break;
      sport.timeouts = [
        ...(sport.timeouts || []),
        {
          teamId,
          setNumber: currentSet,
          timeoutNumber: timeoutCount + 1,
          homeScore: currentSetEntry.homeScore || 0,
          awayScore: currentSetEntry.awayScore || 0,
          timestamp: event.timestamp || new Date().toISOString(),
        },
      ];
      break;
    }
    case "substitution":
      sport.substitutions = [
        ...(sport.substitutions || []),
        {
          playerIn: event.relatedPlayerId || event.playerId,
          playerOut: event.playerId,
          teamId: event.teamId,
          setNumber: currentSet,
          homeScore: currentSetEntry.homeScore || 0,
          awayScore: currentSetEntry.awayScore || 0,
          timestamp: event.timestamp || new Date().toISOString(),
        },
      ];
      break;
    default:
      break;
  }

  if (event.eventType === "side_out" && !shouldScoreEvent(event)) {
    const newServingTeam = getOppositeTeamId(event.teamId, base);
    sport.servingTeam = newServingTeam;
    sport.receivingTeam = event.teamId;
  }

  sport.score = {
    home: Number(sport.homeScore || 0),
    away: Number(sport.awayScore || 0),
  };

  const displaySet = sport.sets[Math.max(0, (sport.currentSet || 1) - 1)] || currentSetEntry;
  event.homeScoreAfter = Number(displaySet?.homeScore ?? sport.homeScore ?? 0);
  event.awayScoreAfter = Number(displaySet?.awayScore ?? sport.awayScore ?? 0);
  event.servingTeam = sport.servingTeam || null;

  sport.events = [...(sport.events || []), event];
};

const replayVolleyballGame = (prev, rawEvents = []) => {
  if (!prev?.sport || !prev?.base) return prev;

  const eventsToReplay = (rawEvents || [])
    .filter(Boolean)
    .filter((event) => event.eventType !== "undo")
    .map(cloneVolleyballEvent);

  const sport = createReplaySport(prev.sport, prev.base, eventsToReplay[0] || null);
  eventsToReplay.forEach((rawEvent) => {
    const event = normalizeIncomingEvent(sport, prev.base, rawEvent);
    applyVolleyballEvent(sport, event, prev.base);
  });

  return {
    ...prev,
    sport,
  };
};

const cloneSportForApply = (sport) => {
  try {
    return typeof structuredClone === "function"
      ? structuredClone(sport)
      : JSON.parse(JSON.stringify(sport));
  } catch {
    return JSON.parse(JSON.stringify(sport));
  }
};

/** Apply one rally event on top of current sport state (live-game queue replay). */
export const applyIncrementalVolleyballEvent = (prev, eventPayload) => {
  if (!prev?.sport || !eventPayload || !prev?.base) return prev;
  const sport = cloneSportForApply(prev.sport);
  const event = normalizeIncomingEvent(sport, prev.base, eventPayload);
  applyVolleyballEvent(sport, event, prev.base);
  return { ...prev, sport };
};

export const applyOptimisticVolleyballUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !eventPayload) return prev;
  return replayVolleyballGame(prev, [...(prev.sport.events || []), eventPayload]);
};

export const applyOptimisticVolleyballUndo = (prev, options = {}) => {
  if (!prev?.sport) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const teamSide = options?.teamSide || null;
  const events = [...(prev.sport.events || [])];
  let removedIndex = -1;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.eventType === "undo") continue;
    if (!teamSide || getEventSide(event, prev.base) === teamSide) {
      removedIndex = index;
      break;
    }
  }

  if (removedIndex < 0) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const [removedEvent] = events.splice(removedIndex, 1);
  return {
    nextGame: replayVolleyballGame(prev, events),
    removedEvent,
    removedIndex,
  };
};