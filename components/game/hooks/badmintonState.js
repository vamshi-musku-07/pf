const BADMINTON_ERROR_EVENTS = new Set(["fault", "service_fault"]);
const BADMINTON_SCORING_EVENTS = new Set([
  "pointWon",
  "ace",
  "smash",
  "drop",
  "clear",
  "net_shot",
  "lift",
  "drive",
  "push",
  "flick",
  "flick_serve",
  "fault",
  "service_fault",
]);
const BADMINTON_DERIVED_EVENTS = new Set(["undo", "interval", "change_of_ends"]);

export const cloneGameSnapshot = (game) => {
  if (!game) return game;
  return JSON.parse(JSON.stringify(game));
};

export const getBadmintonScoringSide = (eventType, teamSide) => {
  if (BADMINTON_ERROR_EVENTS.has(eventType)) {
    return teamSide === "home" ? "away" : "home";
  }
  return BADMINTON_SCORING_EVENTS.has(eventType) ? teamSide : null;
};

const createOptimisticServeSide = () => ({
  leftPlayerId: null,
  rightPlayerId: null,
  rotationOrder: [],
});

const buildEmptyBreakState = () => ({
  isActive: false,
  breakType: null,
  durationSeconds: null,
  startedAt: null,
  endsAt: null,
  gameNumber: null,
  triggeredAtScore: {
    home: null,
    away: null,
  },
});

const createOptimisticBreak = (breakType, durationSeconds, score, gameNumber, startedAtInput) => {
  const startedAt = startedAtInput ? new Date(startedAtInput) : new Date();
  return {
    isActive: true,
    breakType,
    durationSeconds,
    startedAt: startedAt.toISOString(),
    endsAt: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
    gameNumber,
    triggeredAtScore: {
      home: score.home || 0,
      away: score.away || 0,
    },
  };
};

const normalizeOptimisticServeState = (serveState = {}) => ({
  servingTeam: serveState.servingTeam || null,
  serviceCourt: serveState.serviceCourt || null,
  servingPlayerId: serveState.servingPlayerId || null,
  receivingPlayerId: serveState.receivingPlayerId || null,
  home: {
    leftPlayerId: serveState.home?.leftPlayerId || null,
    rightPlayerId: serveState.home?.rightPlayerId || null,
    rotationOrder: Array.isArray(serveState.home?.rotationOrder) ? [...serveState.home.rotationOrder] : [],
  },
  away: {
    leftPlayerId: serveState.away?.leftPlayerId || null,
    rightPlayerId: serveState.away?.rightPlayerId || null,
    rotationOrder: Array.isArray(serveState.away?.rotationOrder) ? [...serveState.away.rotationOrder] : [],
  },
});

const createDefaultPlayerStats = (playerId, teamId) => ({
  playerId,
  teamId,
  pointsWon: 0,
  errors: 0,
  serviceFaults: 0,
  smashes: 0,
  drops: 0,
  clears: 0,
  netShots: 0,
  lifts: 0,
  drives: 0,
});

const ensureBadmintonState = (sport = {}) => {
  if (!sport.score) sport.score = { home: 0, away: 0 };
  if (!Array.isArray(sport.games)) sport.games = [];
  if (!sport.currentGameNumber) sport.currentGameNumber = 1;
  if (!sport.result) sport.result = { winner: null, homeGamesWon: 0, awayGamesWon: 0 };
  if (!sport.matchType) sport.matchType = "singles";
  if (!sport.activeBreak) sport.activeBreak = buildEmptyBreakState();
  if (!sport.serveState) {
    sport.serveState = {
      servingTeam: sport.servingTeam || null,
      serviceCourt: null,
      servingPlayerId: null,
      receivingPlayerId: null,
      home: createOptimisticServeSide(),
      away: createOptimisticServeSide(),
    };
  } else {
    sport.serveState = normalizeOptimisticServeState(sport.serveState);
  }
  if (!Array.isArray(sport.events)) sport.events = [];
  if (!Array.isArray(sport.playerStats)) sport.playerStats = [];
  if (!sport.matchStatus) sport.matchStatus = "scheduled";
};

const clearActiveBreak = (sport) => {
  sport.activeBreak = buildEmptyBreakState();
};

const syncActiveBreakState = (sport, now = new Date()) => {
  if (!sport.activeBreak?.isActive) return false;
  const endsAt = sport.activeBreak.endsAt ? new Date(sport.activeBreak.endsAt) : null;
  if (!endsAt || endsAt.getTime() <= now.getTime()) {
    clearActiveBreak(sport);
    return false;
  }
  return true;
};

const createSystemEvent = (sport, eventType, description, overrides = {}) => ({
  eventType,
  teamId: overrides.teamId || "system",
  playerId: overrides.playerId || null,
  teamSide: overrides.teamSide || null,
  gameNumber: overrides.gameNumber || sport.currentGameNumber || 1,
  description,
  timestamp: overrides.timestamp || new Date().toISOString(),
  createdBy: overrides.createdBy || "system",
  optimistic: true,
  pending: overrides.pending !== false,
});

const isTrackedPlayerId = (playerId, teamId) => {
  if (!playerId) return false;
  const normalizedPlayerId = String(playerId);
  return !normalizedPlayerId.startsWith("team_") && normalizedPlayerId !== String(teamId || "");
};

const registerOptimisticBadmintonPlayer = (serveState, side, selectedPlayer) => {
  const playerId = selectedPlayer?._id || selectedPlayer?.id;
  if (!playerId) return;
  const normalizedPlayerId = String(playerId);
  const sideState = serveState[side] || createOptimisticServeSide();
  if (!sideState.rotationOrder.includes(normalizedPlayerId)) {
    sideState.rotationOrder.push(normalizedPlayerId);
  }
  if (!sideState.rightPlayerId) {
    sideState.rightPlayerId = normalizedPlayerId;
  } else if (!sideState.leftPlayerId && sideState.rightPlayerId !== normalizedPlayerId) {
    sideState.leftPlayerId = normalizedPlayerId;
  }
  serveState[side] = sideState;
};

const registerServePlayer = (sport, side, playerId, teamId) => {
  if (!isTrackedPlayerId(playerId, teamId)) return;
  registerOptimisticBadmintonPlayer(sport.serveState, side, { _id: playerId });
};

const swapOptimisticBadmintonCourts = (serveState, side) => {
  const sideState = serveState[side];
  if (!sideState?.leftPlayerId || !sideState?.rightPlayerId) return;
  const previousLeft = sideState.leftPlayerId;
  sideState.leftPlayerId = sideState.rightPlayerId;
  sideState.rightPlayerId = previousLeft;
};

const maybeSwapCourtsAfterPoint = (sport, scoringSide) => {
  if (sport.matchType !== "doubles") return;
  swapOptimisticBadmintonCourts(sport.serveState, scoringSide);
};

const getServiceCourt = (scoreValue) => (scoreValue % 2 === 0 ? "right" : "left");

const getOptimisticCourtPlayer = (serveState, side, court, fallbackPlayerId = null) => {
  const sideState = serveState[side] || createOptimisticServeSide();
  const directPlayerId = court === "left" ? sideState.leftPlayerId : sideState.rightPlayerId;
  return directPlayerId || fallbackPlayerId || null;
};

const getSideCourtPlayer = (sport, side, court, fallbackPlayerId, fallbackTeamId) => {
  const playerId = getOptimisticCourtPlayer(sport.serveState, side, court, null);
  if (playerId) return playerId;
  if (isTrackedPlayerId(fallbackPlayerId, fallbackTeamId)) return String(fallbackPlayerId);
  return fallbackTeamId ? `team_${fallbackTeamId}` : null;
};

const syncServeState = (sport, base, servingSide, eventPayload) => {
  const opponentSide = servingSide === "home" ? "away" : "home";
  const servingScore = sport.score[servingSide] || 0;
  const serviceCourt = getServiceCourt(servingScore);
  const fallbackServingPlayerId = eventPayload?.teamSide === servingSide ? eventPayload?.playerId : null;
  const fallbackServingTeamId = servingSide === "home" ? base?.teamId : base?.opponentTeamId;
  const fallbackReceivingTeamId = opponentSide === "home" ? base?.teamId : base?.opponentTeamId;

  sport.servingTeam = servingSide;
  sport.serveState.servingTeam = servingSide;
  sport.serveState.serviceCourt = serviceCourt;
  sport.serveState.servingPlayerId = getSideCourtPlayer(
    sport,
    servingSide,
    serviceCourt,
    fallbackServingPlayerId,
    fallbackServingTeamId,
  );
  sport.serveState.receivingPlayerId = getSideCourtPlayer(
    sport,
    opponentSide,
    serviceCourt,
    null,
    fallbackReceivingTeamId,
  );
};

const startAutomaticBreak = (sport, breakType, durationSeconds, description, sourceEvent) => {
  sport.activeBreak = createOptimisticBreak(
    breakType,
    durationSeconds,
    sport.score,
    sport.currentGameNumber,
    sourceEvent?.timestamp,
  );
  sport.events.push(
    createSystemEvent(sport, "interval", description, {
      gameNumber: sport.currentGameNumber,
      timestamp: sourceEvent?.timestamp,
      pending: sourceEvent?.pending !== false,
    }),
  );
};

const findOrCreatePlayerStats = (sport, playerId, teamId) => {
  if (!playerId) return null;
  let playerStats = sport.playerStats.find(
    (stat) => String(stat?.playerId || "") === String(playerId) && String(stat?.teamId || "") === String(teamId || ""),
  );
  if (!playerStats) {
    playerStats = createDefaultPlayerStats(playerId, teamId);
    sport.playerStats.push(playerStats);
  }
  return playerStats;
};

const zeroPlayerStats = (playerStats = {}) => {
  const nextStats = { ...playerStats };
  Object.keys(nextStats).forEach((key) => {
    if (typeof nextStats[key] === "number") {
      nextStats[key] = 0;
    }
  });
  return nextStats;
};

const getTeamSideFromPayload = (base, eventPayload) => {
  if (eventPayload?.teamSide) return eventPayload.teamSide;
  return String(eventPayload?.teamId || "") === String(base?.teamId || "") ? "home" : "away";
};

const applyBadmintonEvent = (sport, eventPayload, base, options = {}) => {
  const isReplay = !!options.isReplay;
  ensureBadmintonState(sport);

  if (sport.matchStatus === "final" && eventPayload?.eventType !== "undo") {
    return false;
  }

  const hasActiveBreak = syncActiveBreakState(sport);
  const side = getTeamSideFromPayload(base, eventPayload);
  const opponent = side === "home" ? "away" : "home";

  registerServePlayer(sport, side, eventPayload?.playerId, eventPayload?.teamId);

  if (hasActiveBreak && !isReplay && !BADMINTON_DERIVED_EVENTS.has(eventPayload?.eventType)) {
    return false;
  }

  const playerStats = findOrCreatePlayerStats(sport, eventPayload?.playerId, eventPayload?.teamId);

  const awardPoint = (scoringSide) => {
    sport.score[scoringSide] = (sport.score[scoringSide] || 0) + 1;
    maybeSwapCourtsAfterPoint(sport, scoringSide);
    syncServeState(sport, base, scoringSide, { ...eventPayload, teamSide: side });

    const homeScore = sport.score.home || 0;
    const awayScore = sport.score.away || 0;
    const leaderScore = Math.max(homeScore, awayScore);
    const trailerScore = Math.min(homeScore, awayScore);

    let isGameWon = false;
    if (leaderScore >= 21 && leaderScore - trailerScore >= 2) isGameWon = true;
    else if (leaderScore >= 30) isGameWon = true;

    const reachedMidGameInterval = !isGameWon
      && leaderScore === 11
      && !sport.activeBreak?.isActive
      && !(sport.activeBreak?.triggeredAtScore?.home === homeScore && sport.activeBreak?.triggeredAtScore?.away === awayScore);

    if (reachedMidGameInterval) {
      startAutomaticBreak(sport, "mid_game_interval", 60, "Mid-game interval at 11 points", eventPayload);
    }

    if (!isGameWon) return;

    const gameWinner = homeScore > awayScore ? "home" : "away";
    sport.games.push({
      gameNumber: sport.currentGameNumber,
      homeScore,
      awayScore,
      winner: gameWinner,
      isCompleted: true,
      optimistic: true,
    });

    sport.result[`${gameWinner}GamesWon`] = (sport.result[`${gameWinner}GamesWon`] || 0) + 1;

    if (sport.result.homeGamesWon >= 2 || sport.result.awayGamesWon >= 2) {
      sport.result.winner = sport.result.homeGamesWon >= 2 ? "home" : "away";
      sport.matchStatus = "final";
      clearActiveBreak(sport);
      return;
    }

    sport.events.push(
      createSystemEvent(sport, "change_of_ends", "Players change ends before the next game", {
        gameNumber: sport.currentGameNumber,
        timestamp: eventPayload?.timestamp,
        pending: eventPayload?.pending !== false,
      }),
    );
    sport.currentGameNumber += 1;
    sport.score = { home: 0, away: 0 };
    syncServeState(sport, base, gameWinner, { ...eventPayload, teamSide: gameWinner });
    startAutomaticBreak(sport, "between_games", 120, "Between-games interval", eventPayload);
  };

  switch (eventPayload?.eventType) {
    case "pointWon":
      awardPoint(side);
      if (playerStats) playerStats.pointsWon += 1;
      break;

    case "fault":
    case "service_fault":
      awardPoint(opponent);
      if (playerStats) {
        if (eventPayload.eventType === "fault") playerStats.errors += 1;
        else playerStats.serviceFaults += 1;
      }
      break;

    case "smash":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.smashes += 1;
      }
      break;

    case "drop":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.drops += 1;
      }
      break;

    case "net_shot":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.netShots += 1;
      }
      break;

    case "drive":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.drives += 1;
      }
      break;

    case "clear":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.clears += 1;
      }
      break;

    case "lift":
    case "flick_serve":
      awardPoint(side);
      if (playerStats) {
        playerStats.pointsWon += 1;
        playerStats.lifts += 1;
      }
      break;

    case "push":
    case "flick":
    case "ace":
      awardPoint(side);
      if (playerStats) playerStats.pointsWon += 1;
      break;

    case "let":
    case "interval":
    case "change_of_ends":
      break;

    default:
      return false;
  }

  if (sport.matchStatus === "scheduled" && !["let", "interval", "change_of_ends"].includes(eventPayload?.eventType)) {
    sport.matchStatus = "in_progress";
  }

  return true;
};

const appendOptimisticBadmintonEvent = (sport, eventPayload) => {
  sport.events = [
    ...(sport.events || []),
    {
      ...eventPayload,
      optimistic: true,
      pending: eventPayload?.pending !== false,
    },
  ];
};

const resetBadmintonSportForReplay = (sport, matchStatus = "scheduled") => ({
  ...sport,
  score: { home: 0, away: 0 },
  games: [],
  currentGameNumber: 1,
  matchStatus,
  result: { winner: null, homeGamesWon: 0, awayGamesWon: 0 },
  servingTeam: null,
  serveState: {
    servingTeam: null,
    serviceCourt: null,
    servingPlayerId: null,
    receivingPlayerId: null,
    home: createOptimisticServeSide(),
    away: createOptimisticServeSide(),
  },
  activeBreak: buildEmptyBreakState(),
  events: [],
  playerStats: Array.isArray(sport.playerStats) ? sport.playerStats.map(zeroPlayerStats) : [],
});

export const applyOptimisticBadmintonEvent = (prev, eventPayload) => {
  if (!prev?.sport || !eventPayload) return prev;

  const nextGame = cloneGameSnapshot(prev);
  ensureBadmintonState(nextGame.sport);

  const optimisticEvent = {
    ...eventPayload,
    teamSide: getTeamSideFromPayload(nextGame.base, eventPayload),
  };
  appendOptimisticBadmintonEvent(nextGame.sport, optimisticEvent);

  const applied = applyBadmintonEvent(nextGame.sport, optimisticEvent, nextGame.base);
  return applied ? nextGame : prev;
};

export const applyOptimisticBadmintonUndo = (prev) => {
  if (!prev?.sport) {
    return { nextGame: prev, removedEvent: null };
  }

  const nextGame = cloneGameSnapshot(prev);
  ensureBadmintonState(nextGame.sport);

  const history = [...(nextGame.sport.events || [])].filter(Boolean);
  let lastUndoableIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (!BADMINTON_DERIVED_EVENTS.has(history[index]?.eventType)) {
      lastUndoableIndex = index;
      break;
    }
  }

  if (lastUndoableIndex < 0) {
    return { nextGame: prev, removedEvent: null };
  }

  const removedEvent = history[lastUndoableIndex];
  const replayHistory = history
    .slice(0, lastUndoableIndex)
    .filter((event) => event && !BADMINTON_DERIVED_EVENTS.has(event.eventType));

  nextGame.sport = resetBadmintonSportForReplay(
    nextGame.sport,
    replayHistory.length > 0 ? "in_progress" : "scheduled",
  );

  for (const pastEvent of replayHistory) {
    nextGame.sport.events.push(pastEvent);
    applyBadmintonEvent(nextGame.sport, pastEvent, nextGame.base, { isReplay: true });
  }

  return { nextGame, removedEvent };
};

export const replayPendingBadmintonActions = (game, actions = []) => {
  return (actions || []).reduce((nextGame, action) => {
    if (!nextGame) return nextGame;

    if (action?.type === "undo") {
      return applyOptimisticBadmintonUndo(nextGame).nextGame;
    }

    if (action?.type === "event" && action.payload) {
      return applyOptimisticBadmintonEvent(nextGame, action.payload);
    }

    return nextGame;
  }, game);
};

export const applyOptimisticBadmintonUpdate = (prev, eventType, teamSide, selectedPlayer) => {
  const sport = prev?.sport;
  if (!sport?.score || sport?.matchStatus === "final") return prev;

  const activeBreakEndsAtMs = sport.activeBreak?.endsAt ? new Date(sport.activeBreak.endsAt).getTime() : 0;
  if (sport.activeBreak?.isActive && activeBreakEndsAtMs > Date.now()) {
    return prev;
  }

  const scoringSide = getBadmintonScoringSide(eventType, teamSide);
  if (!scoringSide) return prev;

  const opponentSide = scoringSide === "home" ? "away" : "home";
  const selectedPlayerId = selectedPlayer?._id || selectedPlayer?.id || null;
  const nextScore = {
    ...sport.score,
    [scoringSide]: (sport.score?.[scoringSide] || 0) + 1,
  };

  const leaderScore = Math.max(nextScore.home || 0, nextScore.away || 0);
  const trailerScore = Math.min(nextScore.home || 0, nextScore.away || 0);
  const isGameWon = (leaderScore >= 21 && leaderScore - trailerScore >= 2) || leaderScore >= 30;
  const nextGames = [...(sport.games || [])];
  const nextResult = {
    winner: sport.result?.winner || null,
    homeGamesWon: sport.result?.homeGamesWon || 0,
    awayGamesWon: sport.result?.awayGamesWon || 0,
    notes: sport.result?.notes,
  };

  let nextMatchStatus = sport.matchStatus === "scheduled" ? "in_progress" : sport.matchStatus;
  let nextCurrentGameNumber = sport.currentGameNumber || 1;
  let nextServingTeam = scoringSide;
  let nextServeState = normalizeOptimisticServeState(sport.serveState);
  registerOptimisticBadmintonPlayer(nextServeState, teamSide, selectedPlayer);
  if (sport.matchType === "doubles") {
    swapOptimisticBadmintonCourts(nextServeState, scoringSide);
  }
  const nextServiceCourt = nextScore[scoringSide] % 2 === 0 ? "right" : "left";
  nextServeState = {
    ...nextServeState,
    servingTeam: scoringSide,
    serviceCourt: nextServiceCourt,
    servingPlayerId: getOptimisticCourtPlayer(
      nextServeState,
      scoringSide,
      nextServiceCourt,
      teamSide === scoringSide ? selectedPlayerId : sport.serveState?.servingPlayerId || null,
    ),
    receivingPlayerId: getOptimisticCourtPlayer(
      nextServeState,
      opponentSide,
      nextServiceCourt,
      sport.serveState?.receivingPlayerId || null,
    ),
  };
  let nextActiveBreak = {
    ...(sport.activeBreak || {}),
    isActive: false,
  };
  let liveScore = nextScore;

  if (!isGameWon && leaderScore === 11) {
    nextActiveBreak = createOptimisticBreak("mid_game_interval", 60, nextScore, nextCurrentGameNumber);
  }

  if (isGameWon) {
    const gameWinner = nextScore.home > nextScore.away ? "home" : "away";
    nextGames.push({
      gameNumber: nextCurrentGameNumber,
      homeScore: nextScore.home,
      awayScore: nextScore.away,
      winner: gameWinner,
      isCompleted: true,
    });

    if (gameWinner === "home") nextResult.homeGamesWon += 1;
    else nextResult.awayGamesWon += 1;

    if (nextResult.homeGamesWon >= 2 || nextResult.awayGamesWon >= 2) {
      nextResult.winner = nextResult.homeGamesWon >= 2 ? "home" : "away";
      nextMatchStatus = "final";
      nextActiveBreak = {
        ...(sport.activeBreak || {}),
        isActive: false,
        breakType: null,
        durationSeconds: null,
        startedAt: null,
        endsAt: null,
        gameNumber: null,
        triggeredAtScore: { home: null, away: null },
      };
    } else {
      nextCurrentGameNumber += 1;
      liveScore = { home: 0, away: 0 };
      nextServingTeam = gameWinner;
      nextServeState = {
        ...normalizeOptimisticServeState(nextServeState),
        servingTeam: gameWinner,
        serviceCourt: "right",
        servingPlayerId: getOptimisticCourtPlayer(nextServeState, gameWinner, "right", nextServeState.servingPlayerId),
        receivingPlayerId: getOptimisticCourtPlayer(nextServeState, gameWinner === "home" ? "away" : "home", "right", nextServeState.receivingPlayerId),
      };
      nextActiveBreak = createOptimisticBreak("between_games", 120, liveScore, nextCurrentGameNumber);
    }
  }

  return {
    ...prev,
    sport: {
      ...sport,
      score: liveScore,
      games: nextGames,
      result: nextResult,
      matchStatus: nextMatchStatus,
      currentGameNumber: nextCurrentGameNumber,
      servingTeam: nextServingTeam,
      serveState: nextServeState,
      activeBreak: nextActiveBreak,
    },
  };
};