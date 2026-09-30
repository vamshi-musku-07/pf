const cloneGame = (game) => {
  if (!game) return game;
  return JSON.parse(JSON.stringify(game));
};

const oppositeSide = (side) => (side === "home" ? "away" : "home");
const scoreKeyForSide = (side) => (side === "home" ? "player1" : "player2");

const createDefaultPlayerStats = (playerId, teamId) => ({
  playerId,
  teamId,
  totalPointsWon: 0,
  totalPointsLost: 0,
  totalServes: 0,
  aceServes: 0,
  serveWinners: 0,
  serveErrors: 0,
  forehandTotal: 0,
  forehandWinners: 0,
  forehandErrors: 0,
  backhandTotal: 0,
  backhandWinners: 0,
  backhandErrors: 0,
  attackShots: 0,
  returnPointsWon: 0,
  returnErrors: 0,
});

const getGamesNeeded = (matchFormat) => {
  switch (matchFormat) {
    case "best_of_7":
      return 4;
    case "best_of_5":
      return 3;
    case "best_of_3":
    default:
      return 2;
  }
};

const syncServingState = (sport, servingTeam) => {
  sport.servingTeam = servingTeam;
  sport.servingPlayer = servingTeam === "home" ? "player1" : "player2";
};

const getTableTennisConfig = (sport) => {
  const matchConfig = sport?.matchConfig || {};
  const pointsToWinGame = Number.isInteger(matchConfig.pointsToWinGame) && matchConfig.pointsToWinGame > 0
    ? matchConfig.pointsToWinGame
    : 11;
  const servesPerTurn = Number.isInteger(matchConfig.servesPerTurn) && matchConfig.servesPerTurn > 0
    ? matchConfig.servesPerTurn
    : 2;

  return {
    pointsToWinGame,
    mustWinByTwo: matchConfig.mustWinByTwo !== false,
    servesPerTurn,
  };
};

const ensureTimeoutState = (sport) => {
  if (!sport.timeouts) {
    sport.timeouts = {
      player1: { remaining: 1, used: 0, timestamps: [] },
      player2: { remaining: 1, used: 0, timestamps: [] },
    };
    return;
  }

  for (const key of ["player1", "player2"]) {
    if (!sport.timeouts[key]) {
      sport.timeouts[key] = { remaining: 1, used: 0, timestamps: [] };
      continue;
    }

    if (!Array.isArray(sport.timeouts[key].timestamps)) {
      sport.timeouts[key].timestamps = [];
    }
    if (!Number.isInteger(sport.timeouts[key].remaining)) {
      sport.timeouts[key].remaining = 1;
    }
    if (!Number.isInteger(sport.timeouts[key].used)) {
      sport.timeouts[key].used = 0;
    }
  }
};

const clearActiveTimeout = (sport) => {
  sport.activeTimeout = {
    isActive: false,
    calledBy: null,
    startedAt: null,
    endsAt: null,
    durationSeconds: null,
    wasTimerRunning: false,
  };
};

const syncActiveTimeoutState = (sport, now = new Date()) => {
  if (!sport.activeTimeout) {
    clearActiveTimeout(sport);
    return false;
  }

  const endsAt = sport.activeTimeout.endsAt ? new Date(sport.activeTimeout.endsAt) : null;
  const isStillActive = !!(sport.activeTimeout.isActive && endsAt && endsAt.getTime() > now.getTime());

  if (!isStillActive) {
    clearActiveTimeout(sport);
    return false;
  }

  return true;
};

const ensureTableTennisState = (sport = {}) => {
  if (!sport.score) sport.score = { home: 0, away: 0 };
  if (!Array.isArray(sport.gameScores)) sport.gameScores = [];
  if (!sport.currentGame) sport.currentGame = 1;
  if (!sport.currentPointScore) sport.currentPointScore = { player1: 0, player2: 0 };
  if (!sport.servingTeam) sport.servingTeam = "home";
  if (!sport.gameStartingServer) sport.gameStartingServer = sport.servingTeam;
  if (!Array.isArray(sport.events)) sport.events = [];
  if (!Array.isArray(sport.playerStats)) sport.playerStats = [];
  if (!sport.matchStatus) sport.matchStatus = "scheduled";
  if (!sport.matchConfig) sport.matchConfig = {};
  if (!sport.matchFormat) sport.matchFormat = "best_of_5";
  if (sport.result === undefined) sport.result = null;
  ensureTimeoutState(sport);
  syncActiveTimeoutState(sport);
  syncServingState(sport, sport.servingTeam);
};

const findOrCreatePlayerStats = (sport, playerId, teamId) => {
  if (!playerId || !teamId) return null;

  let playerStats = sport.playerStats.find(
    (stat) => String(stat?.playerId || "") === String(playerId) && String(stat?.teamId || "") === String(teamId),
  );

  if (!playerStats) {
    playerStats = createDefaultPlayerStats(playerId, teamId);
    sport.playerStats.push(playerStats);
  }

  return playerStats;
};

const zeroPlayerStats = (stats) => {
  const nextStats = { ...stats };
  Object.keys(nextStats).forEach((key) => {
    if (typeof nextStats[key] === "number") {
      nextStats[key] = 0;
    }
  });
  return nextStats;
};

const getSideFromTeamId = (teamId, base) =>
  String(teamId || "") === String(base?.teamId || "") ? "home" : "away";

const checkServeAlternation = (sport) => {
  const { pointsToWinGame, mustWinByTwo, servesPerTurn } = getTableTennisConfig(sport);
  const p1 = Number(sport.currentPointScore?.player1 || 0);
  const p2 = Number(sport.currentPointScore?.player2 || 0);
  const totalPoints = p1 + p2;
  const deuceThreshold = Math.max(pointsToWinGame - 1, 0);

  if (mustWinByTwo && p1 >= deuceThreshold && p2 >= deuceThreshold) {
    syncServingState(sport, sport.servingTeam === "home" ? "away" : "home");
    return;
  }

  if (totalPoints > 0 && totalPoints % servesPerTurn === 0) {
    syncServingState(sport, sport.servingTeam === "home" ? "away" : "home");
  }
};

const advancePoint = (sport, scoringSide) => {
  const scoringKey = scoreKeyForSide(scoringSide);
  sport.currentPointScore[scoringKey] = Number(sport.currentPointScore?.[scoringKey] || 0) + 1;

  checkServeAlternation(sport);

  const { pointsToWinGame, mustWinByTwo } = getTableTennisConfig(sport);
  const p1 = Number(sport.currentPointScore?.player1 || 0);
  const p2 = Number(sport.currentPointScore?.player2 || 0);
  const reachedTarget = p1 >= pointsToWinGame || p2 >= pointsToWinGame;
  const hasWinningMargin = mustWinByTwo ? Math.abs(p1 - p2) >= 2 : true;

  if (!reachedTarget || !hasWinningMargin) return;

  const gameWinnerSide = p1 > p2 ? "home" : "away";
  sport.gameScores.push({
    gameNumber: sport.currentGame,
    player1Points: p1,
    player2Points: p2,
    winner: p1 > p2 ? "player1" : "player2",
    optimistic: true,
  });

  sport.score[gameWinnerSide] = Number(sport.score?.[gameWinnerSide] || 0) + 1;
  sport.currentGame += 1;
  sport.currentPointScore = { player1: 0, player2: 0 };

  const nextGameStartingServer = sport.gameStartingServer === "home" ? "away" : "home";
  sport.gameStartingServer = nextGameStartingServer;
  syncServingState(sport, nextGameStartingServer);

  const gamesNeeded = getGamesNeeded(sport.matchFormat);
  if (sport.score.home >= gamesNeeded || sport.score.away >= gamesNeeded) {
    sport.matchStatus = "final";
    sport.result = {
      winner: sport.score.home >= gamesNeeded ? "player1" : "player2",
      finalScore: {
        player1Games: sport.score.home,
        player2Games: sport.score.away,
      },
    };
  }
};

const applyTableTennisEvent = (sport, eventPayload, base) => {
  const hasActiveTimeout = syncActiveTimeoutState(sport);
  const side = eventPayload?.teamSide || getSideFromTeamId(eventPayload?.teamId, base);
  const opponent = oppositeSide(side);
  const timeoutKey = side === "home" ? "player1" : "player2";

  if (hasActiveTimeout && eventPayload?.eventType !== "timeout") {
    return false;
  }

  const playerStats = findOrCreatePlayerStats(sport, eventPayload?.playerId, eventPayload?.teamId);

  switch (eventPayload?.eventType) {
    case "pointWon":
    case "return_winner":
    case "winner":
      advancePoint(sport, side);
      if (playerStats) {
        playerStats.totalPointsWon = Number(playerStats.totalPointsWon || 0) + 1;
        playerStats.returnPointsWon = Number(playerStats.returnPointsWon || 0) + 1;
      }
      break;

    case "forehand_smash":
    case "forehand_attack":
      advancePoint(sport, side);
      if (playerStats) {
        playerStats.totalPointsWon = Number(playerStats.totalPointsWon || 0) + 1;
        playerStats.forehandWinners = Number(playerStats.forehandWinners || 0) + 1;
        playerStats.forehandTotal = Number(playerStats.forehandTotal || 0) + 1;
        playerStats.attackShots = Number(playerStats.attackShots || 0) + 1;
      }
      break;

    case "backhand_smash":
    case "backhand_attack":
      advancePoint(sport, side);
      if (playerStats) {
        playerStats.totalPointsWon = Number(playerStats.totalPointsWon || 0) + 1;
        playerStats.backhandWinners = Number(playerStats.backhandWinners || 0) + 1;
        playerStats.backhandTotal = Number(playerStats.backhandTotal || 0) + 1;
        playerStats.attackShots = Number(playerStats.attackShots || 0) + 1;
      }
      break;

    case "serve_ace":
      advancePoint(sport, side);
      if (playerStats) {
        playerStats.totalPointsWon = Number(playerStats.totalPointsWon || 0) + 1;
        playerStats.totalServes = Number(playerStats.totalServes || 0) + 1;
        playerStats.aceServes = Number(playerStats.aceServes || 0) + 1;
        playerStats.serveWinners = Number(playerStats.serveWinners || 0) + 1;
      }
      break;

    case "unforced_error":
    case "forced_error":
    case "net_ball":
    case "out_of_bounds":
    case "double_bounce":
    case "receive_error":
      advancePoint(sport, opponent);
      if (playerStats) {
        playerStats.totalPointsLost = Number(playerStats.totalPointsLost || 0) + 1;
        playerStats.forehandErrors = Number(playerStats.forehandErrors || 0) + 1;
        playerStats.forehandTotal = Number(playerStats.forehandTotal || 0) + 1;
        if (eventPayload.eventType === "receive_error") {
          playerStats.returnErrors = Number(playerStats.returnErrors || 0) + 1;
        }
      }
      break;

    case "serve_error":
    case "double_fault":
      advancePoint(sport, opponent);
      if (playerStats) {
        playerStats.totalPointsLost = Number(playerStats.totalPointsLost || 0) + 1;
        playerStats.totalServes = Number(playerStats.totalServes || 0) + 1;
        playerStats.serveErrors = Number(playerStats.serveErrors || 0) + 1;
      }
      break;

    case "forehand_error":
      advancePoint(sport, opponent);
      if (playerStats) {
        playerStats.totalPointsLost = Number(playerStats.totalPointsLost || 0) + 1;
        playerStats.forehandErrors = Number(playerStats.forehandErrors || 0) + 1;
        playerStats.forehandTotal = Number(playerStats.forehandTotal || 0) + 1;
      }
      break;

    case "backhand_error":
      advancePoint(sport, opponent);
      if (playerStats) {
        playerStats.totalPointsLost = Number(playerStats.totalPointsLost || 0) + 1;
        playerStats.backhandErrors = Number(playerStats.backhandErrors || 0) + 1;
        playerStats.backhandTotal = Number(playerStats.backhandTotal || 0) + 1;
      }
      break;

    case "let":
      break;

    case "timeout": {
      const timeoutState = sport.timeouts?.[timeoutKey];
      if (!timeoutState || timeoutState.remaining <= 0 || hasActiveTimeout) {
        return false;
      }

      const startedAt = eventPayload?.timestamp ? new Date(eventPayload.timestamp) : new Date();
      const durationSeconds = sport.matchConfig?.timeoutDuration || 60;
      const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      timeoutState.remaining -= 1;
      timeoutState.used = Number(timeoutState.used || 0) + 1;
      timeoutState.timestamps = [...(timeoutState.timestamps || []), startedAt.toISOString()];
      sport.activeTimeout = {
        isActive: true,
        calledBy: side,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationSeconds,
        wasTimerRunning: !!eventPayload?.wasTimerRunning,
      };
      break;
    }

    default:
      return false;
  }

  if (sport.matchStatus === "scheduled" && eventPayload?.eventType !== "timeout") {
    sport.matchStatus = "in_progress";
  }

  return true;
};

const appendOptimisticEvent = (sport, eventPayload) => {
  sport.events = [
    ...(sport.events || []),
    {
      ...eventPayload,
      optimistic: true,
      pending: eventPayload?.pending !== false,
    },
  ];
};

const resetSportForReplay = (sport) => ({
  ...sport,
  score: { home: 0, away: 0 },
  gameScores: [],
  currentGame: 1,
  currentPointScore: { player1: 0, player2: 0 },
  gameStartingServer: "home",
  servingTeam: "home",
  servingPlayer: "player1",
  timeouts: {
    player1: { remaining: 1, used: 0, timestamps: [] },
    player2: { remaining: 1, used: 0, timestamps: [] },
  },
  activeTimeout: {
    isActive: false,
    calledBy: null,
    startedAt: null,
    endsAt: null,
    durationSeconds: null,
    wasTimerRunning: false,
  },
  matchStatus: "scheduled",
  result: null,
  events: [],
  playerStats: Array.isArray(sport.playerStats) ? sport.playerStats.map(zeroPlayerStats) : [],
});

export const applyOptimisticTableTennisUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;
  if (prev.sport.matchStatus === "final") return prev;

  const nextGame = cloneGame(prev);
  ensureTableTennisState(nextGame.sport);

  appendOptimisticEvent(nextGame.sport, eventPayload);
  const applied = applyTableTennisEvent(nextGame.sport, eventPayload, nextGame.base);
  return applied ? nextGame : prev;
};

export const applyOptimisticTableTennisUndo = (prev) => {
  if (!prev?.sport || !prev?.base) {
    return { nextGame: prev, removedEvent: null };
  }

  const nextGame = cloneGame(prev);
  ensureTableTennisState(nextGame.sport);

  const history = [...(nextGame.sport.events || [])].filter(Boolean);
  if (history.length === 0) {
    return { nextGame: prev, removedEvent: null };
  }

  const removedEvent = history.pop() || null;
  if (!removedEvent) {
    return { nextGame: prev, removedEvent: null };
  }

  const replayHistory = history.filter((event) => event && event.eventType !== "undo");
  const replaySport = resetSportForReplay(nextGame.sport);
  replaySport.matchStatus = replayHistory.length > 0 ? "in_progress" : "scheduled";
  nextGame.sport = replaySport;

  for (const event of replayHistory) {
    replaySport.events.push(event);
    applyTableTennisEvent(replaySport, event, nextGame.base);
  }

  return { nextGame, removedEvent };
};

export const replayPendingTableTennisActions = (game, actions = []) => {
  return (actions || []).reduce((nextGame, action) => {
    if (!nextGame) return nextGame;

    if (action?.type === "undo") {
      return applyOptimisticTableTennisUndo(nextGame).nextGame;
    }

    if (action?.type === "event" && action.payload) {
      return applyOptimisticTableTennisUpdate(nextGame, action.payload);
    }

    return nextGame;
  }, game);
};