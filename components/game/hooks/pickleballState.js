const FAULT_EVENT_TYPES = new Set([
  "fault",
  "serve_error",
  "serve_fault",
  "kitchen_fault",
  "double_bounce_fault",
  "foot_fault",
  "out_fault",
  "net_fault",
]);

const STAT_ONLY_EVENT_TYPES = new Set([
  "serve",
  "volley",
  "dink",
  "lob",
  "smash",
  "let",
  "timeout",
]);

export const clonePickleballGameSnapshot = (game) => {
  if (!game) return game;
  return JSON.parse(JSON.stringify(game));
};

const oppositeSide = (side) => (side === "home" ? "away" : "home");
const scoreKeyForSide = (side) => (side === "home" ? "player1" : "player2");
const servingPlayerForSide = (side) => (side === "home" ? "player1" : "player2");
const sideForServingPlayer = (servingPlayer) => (servingPlayer === "player2" ? "away" : "home");

const getServingSide = (sport = {}) =>
  sport.servingTeam || sideForServingPlayer(sport.servingPlayer || "player1");

const normalizeScore = (score = {}) => ({
  player1: Number(score.player1 || 0),
  player2: Number(score.player2 || 0),
});

const normalizeGamesScore = (score = {}) => ({
  home: Number(score.home || 0),
  away: Number(score.away || 0),
});

const normalizeMatchConfig = (sport = {}) => {
  const config = sport.matchConfig || {};
  const pointsToWinGame = Math.max(1, Number(config.pointsToWinGame) || 11);
  const maxGamePoints = Number(config.maxGamePoints);

  return {
    pointsToWinGame,
    mustWinByTwo: config.mustWinByTwo !== false,
    maxGamePoints: Number.isFinite(maxGamePoints) && maxGamePoints >= pointsToWinGame ? maxGamePoints : null,
  };
};

const ensurePickleballState = (sport = {}) => {
  sport.currentPointScore = normalizeScore(sport.currentPointScore);
  sport.score = normalizeGamesScore(sport.score);
  sport.gameScores = Array.isArray(sport.gameScores) ? [...sport.gameScores] : [];
  sport.currentGame = Number(sport.currentGame) > 0 ? Number(sport.currentGame) : 1;
  sport.events = Array.isArray(sport.events) ? [...sport.events] : [];
  sport.matchStatus = sport.matchStatus || "scheduled";
  return sport;
};

const buildServeState = (sport, servingSide, serverNumber) => {
  const servingScore = Number(sport.currentPointScore?.[scoreKeyForSide(servingSide)] || 0);
  return {
    ...(sport.serveState || {}),
    servingTeam: servingSide,
    receivingTeam: oppositeSide(servingSide),
    serverNumber,
    serverCourtSide: servingScore % 2 === 0 ? "right" : "left",
  };
};

const setServe = (sport, servingSide, serverNumber) => ({
  ...sport,
  servingTeam: servingSide,
  servingPlayer: servingPlayerForSide(servingSide),
  serverNumber,
  serveState: buildServeState(sport, servingSide, serverNumber),
});

const advanceServeAfterServerLoss = (sport) => {
  const servingSide = getServingSide(sport);
  const serverNumber = Number(sport.serverNumber) === 1 ? 1 : 2;

  if (serverNumber === 1) {
    return setServe(sport, servingSide, 2);
  }

  return setServe(sport, oppositeSide(servingSide), 1);
};

const completeGameIfNeeded = (sport) => {
  const pointScore = normalizeScore(sport.currentPointScore);
  const config = normalizeMatchConfig(sport);
  const p1 = pointScore.player1;
  const p2 = pointScore.player2;
  const leader = Math.max(p1, p2);
  const reachedTarget = p1 >= config.pointsToWinGame || p2 >= config.pointsToWinGame;
  const hasMargin = config.mustWinByTwo ? Math.abs(p1 - p2) >= 2 : true;
  const hitCap = config.maxGamePoints ? leader >= config.maxGamePoints : false;

  if ((!reachedTarget || !hasMargin) && !hitCap) return sport;

  const winnerSide = p1 > p2 ? "home" : "away";
  const nextGamesScore = {
    ...normalizeGamesScore(sport.score),
    [winnerSide]: (sport.score?.[winnerSide] || 0) + 1,
  };
  const gamesNeeded = sport.matchFormat === "best_of_5" ? 3 : 2;
  const gameScores = [
    ...(sport.gameScores || []),
    {
      gameNumber: sport.currentGame || 1,
      player1Points: p1,
      player2Points: p2,
      winner: winnerSide === "home" ? "player1" : "player2",
      optimistic: true,
    },
  ];

  if (nextGamesScore.home >= gamesNeeded || nextGamesScore.away >= gamesNeeded) {
    return {
      ...sport,
      score: nextGamesScore,
      gameScores,
      matchStatus: "final",
    };
  }

  const nextServingSide = oppositeSide(winnerSide);
  return setServe(
    {
      ...sport,
      score: nextGamesScore,
      gameScores,
      currentGame: (sport.currentGame || 1) + 1,
      currentPointScore: { player1: 0, player2: 0 },
    },
    nextServingSide,
    2,
  );
};

const awardPointToServer = (sport) => {
  const servingSide = getServingSide(sport);
  const scoringKey = scoreKeyForSide(servingSide);
  const nextSport = {
    ...sport,
    currentPointScore: {
      ...normalizeScore(sport.currentPointScore),
      [scoringKey]: Number(sport.currentPointScore?.[scoringKey] || 0) + 1,
    },
  };
  return completeGameIfNeeded(setServe(nextSport, servingSide, Number(sport.serverNumber) === 1 ? 1 : 2));
};

const buildOptimisticEvent = (eventPayloadOrType, teamSide) => {
  if (eventPayloadOrType && typeof eventPayloadOrType === "object") {
    return {
      ...eventPayloadOrType,
      teamSide: eventPayloadOrType.teamSide || teamSide,
    };
  }

  return {
    eventType: eventPayloadOrType,
    teamSide,
  };
};

const appendOptimisticPickleballEvent = (sport, eventPayload) => {
  sport.events = [
    ...(sport.events || []),
    {
      ...eventPayload,
      optimistic: true,
      pending: eventPayload?.pending !== false,
    },
  ];
};

const resetPickleballSportForReplay = (sport) => ({
  ...sport,
  currentPointScore: { player1: 0, player2: 0 },
  score: { home: 0, away: 0 },
  gameScores: [],
  currentGame: 1,
  servingTeam: "home",
  servingPlayer: "player1",
  serverNumber: 2,
  serveState: {
    ...(sport.serveState || {}),
    servingTeam: "home",
    receivingTeam: "away",
    serverNumber: 2,
    serverCourtSide: "right",
    sideOuts: 0,
  },
  matchStatus: "scheduled",
  events: [],
});

const applyPickleballEvent = (sport, eventPayload) => {
  ensurePickleballState(sport);

  if (!eventPayload?.eventType || !eventPayload?.teamSide || sport.matchStatus === "final") {
    return { nextSport: sport, applied: false };
  }

  const { eventType, teamSide } = eventPayload;
  const servingSide = getServingSide(sport);
  let nextSport = setServe(sport, servingSide, Number(sport.serverNumber) === 1 ? 1 : 2);

  if (eventType === "rally_won") {
    // Rally scoring: winning team ALWAYS scores +1 and takes the serve.
    // IMPORTANT: NEVER use advanceServeAfterServerLoss for rally scoring.
    // That function when serverNumber=1 keeps serve on the SAME team (rotates
    // to server #2), causing the wrong team to be awarded the point.
    // We directly set serve to the winning team as server #1 instead.
    if (teamSide !== servingSide) {
      nextSport = setServe(nextSport, teamSide, 1);
    }
    nextSport = awardPointToServer(nextSport);
  } else if (eventType === "side_out") {
    if (teamSide !== oppositeSide(servingSide)) return { nextSport: sport, applied: false };
    nextSport = advanceServeAfterServerLoss(nextSport);
  } else if (FAULT_EVENT_TYPES.has(eventType)) {
    nextSport = teamSide === servingSide
      ? advanceServeAfterServerLoss(nextSport)
      : awardPointToServer(nextSport);
  } else if (eventType === "winner") {
    nextSport = teamSide === servingSide
      ? awardPointToServer(nextSport)
      : advanceServeAfterServerLoss(nextSport);
  } else if (!STAT_ONLY_EVENT_TYPES.has(eventType)) {
    return { nextSport: sport, applied: false };
  }

  if (
    nextSport.matchStatus !== "final"
    && nextSport.matchStatus !== "in_progress"
    && eventType !== "timeout"
    && eventType !== "let"
  ) {
    nextSport = {
      ...nextSport,
      matchStatus: "in_progress",
    };
  }

  return { nextSport, applied: true };
};

export const applyOptimisticPickleballUpdate = (prev, eventPayloadOrType, teamSide) => {
  if (!prev?.sport) return prev;

  const optimisticEvent = buildOptimisticEvent(eventPayloadOrType, teamSide);
  if (!optimisticEvent?.eventType || !optimisticEvent?.teamSide) return prev;

  const nextGame = clonePickleballGameSnapshot(prev);
  ensurePickleballState(nextGame.sport);

  const { nextSport, applied } = applyPickleballEvent(nextGame.sport, optimisticEvent);
  if (!applied) return prev;

  nextGame.sport = nextSport;
  appendOptimisticPickleballEvent(nextGame.sport, optimisticEvent);
  return nextGame;
};

export const applyOptimisticPickleballUndo = (prev) => {
  if (!prev?.sport) {
    return { nextGame: prev, removedEvent: null };
  }

  const history = [...(prev.sport.events || [])].filter(Boolean);
  if (history.length === 0) {
    return { nextGame: prev, removedEvent: null };
  }

  const removedEvent = history[history.length - 1];
  const replayHistory = history.slice(0, -1);
  const nextGame = clonePickleballGameSnapshot(prev);
  ensurePickleballState(nextGame.sport);
  nextGame.sport = resetPickleballSportForReplay(nextGame.sport);

  for (const pastEvent of replayHistory) {
    const { nextSport, applied } = applyPickleballEvent(nextGame.sport, pastEvent);
    if (!applied) continue;
    nextGame.sport = nextSport;
    appendOptimisticPickleballEvent(nextGame.sport, pastEvent);
  }

  return { nextGame, removedEvent };
};
