// Decides what an owner's basketball clock should do, given where the clock is
// and what we have already done for this quarter. Kept pure because the
// end-of-quarter rules are subtle: the clock stops itself at zero, so the render
// where it is both running and at 00:00 is easy to miss, and missing it must not
// strand the game in the same quarter.
//
//   "arm"    → clock is ticking inside the quarter; remember it started
//   "end"    → quarter is spent; close it and move on
//   "ignore" → nothing to do (already closed, or never started)
export const resolveBasketballClockAction = ({
  quarter,
  remainingSeconds,
  isRunning,
  armedQuarter,
  endedQuarter,
}) => {
  const q = Math.max(1, Number(quarter) || 1);
  const remaining = Math.max(0, Number(remainingSeconds) || 0);

  if (remaining > 0) {
    return { action: isRunning ? "arm" : "ignore", quarter: q };
  }
  if (Number(endedQuarter) === q) {
    return { action: "ignore", quarter: q };
  }
  // A quarter that never started cannot end — this is the 00:00 the timer holds
  // before its opening value arrives. A running clock at zero does count: that is
  // the owner resuming a spent quarter, which is how a parked game gets moving.
  if (Number(armedQuarter) !== q && !isRunning) {
    return { action: "ignore", quarter: q };
  }
  return { action: "end", quarter: q };
};

const cloneLineup = (lineup = []) =>
  Array.isArray(lineup) ? lineup.filter(Boolean).map((entry) => ({ ...entry })) : [];

const cloneSideBucket = (bucket = {}) => ({
  home: Number(bucket?.home || 0),
  away: Number(bucket?.away || 0),
});

const createBasketballPlayerStats = (event = {}) => ({
  playerId: event.playerId,
  teamId: event.teamId,
  points: 0,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  threePointsMade: 0,
  threePointsAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  rebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  technicalFouls: 0,
  flagrantFouls: 0,
  minutesPlayed: 0,
});

const createGameStats = () => ({
  rebounds: { home: 0, away: 0 },
  assists: { home: 0, away: 0 },
  steals: { home: 0, away: 0 },
  blocks: { home: 0, away: 0 },
  turnovers: { home: 0, away: 0 },
  fouls: { home: 0, away: 0 },
  timeouts: { home: 0, away: 0 },
});

const cloneQuarterScores = (scores = {}) => ({
  home: Array.isArray(scores?.home)
    ? scores.home.map((entry) => ({ quarter: Number(entry?.quarter || 0), score: Number(entry?.score || 0) }))
    : [],
  away: Array.isArray(scores?.away)
    ? scores.away.map((entry) => ({ quarter: Number(entry?.quarter || 0), score: Number(entry?.score || 0) }))
    : [],
});

const cloneGameStats = (stats = {}) => {
  const fallback = createGameStats();
  return Object.keys(fallback).reduce((next, key) => {
    next[key] = cloneSideBucket(stats?.[key] || fallback[key]);
    return next;
  }, {});
};

const cloneBasketballSport = (sport = {}) => ({
  ...sport,
  score: cloneSideBucket(sport?.score || {}),
  currentQuarter: Number(sport?.currentQuarter || 1),
  shotClock: Number(sport?.shotClock ?? 24),
  possession: sport?.possession === "away" ? "away" : "home",
  quarterScores: cloneQuarterScores(sport?.quarterScores),
  homeLineup: cloneLineup(sport?.homeLineup),
  awayLineup: cloneLineup(sport?.awayLineup),
  startingHomeLineup: cloneLineup(sport?.startingHomeLineup),
  startingAwayLineup: cloneLineup(sport?.startingAwayLineup),
  substitutions: Array.isArray(sport?.substitutions)
    ? sport.substitutions.filter(Boolean).map((entry) => ({ ...entry }))
    : [],
  events: Array.isArray(sport?.events)
    ? sport.events.filter(Boolean).map((event) => ({ ...event }))
    : [],
  playerStats: Array.isArray(sport?.playerStats)
    ? sport.playerStats.filter(Boolean).map((stat) => ({ ...createBasketballPlayerStats(stat), ...stat }))
    : [],
  gameStats: cloneGameStats(sport?.gameStats),
});

const createReplayBasketballSport = (sport = {}) => {
  const nextSport = cloneBasketballSport(sport);
  nextSport.score = { home: 0, away: 0 };
  nextSport.currentQuarter = 1;
  nextSport.shotClock = 24;
  nextSport.possession = "home";
  nextSport.quarterScores = { home: [], away: [] };
  nextSport.homeLineup = cloneLineup(sport?.startingHomeLineup?.length ? sport.startingHomeLineup : sport?.homeLineup);
  nextSport.awayLineup = cloneLineup(sport?.startingAwayLineup?.length ? sport.startingAwayLineup : sport?.awayLineup);
  nextSport.substitutions = [];
  nextSport.events = [];
  nextSport.playerStats = [];
  nextSport.gameStats = createGameStats();
  nextSport.matchStatus = sport?.events?.length ? "in_progress" : (sport?.matchStatus || "scheduled");
  nextSport.gameState = null;
  return nextSport;
};

const getEventSide = (event = {}, base = {}) =>
  String(event?.teamId) === String(base?.teamId) ? "home" : "away";

const ensureStatBucket = (sport, key) => {
  if (!sport.gameStats) {
    sport.gameStats = createGameStats();
  }
  if (!sport.gameStats[key]) {
    sport.gameStats[key] = { home: 0, away: 0 };
  }
  return sport.gameStats[key];
};

const ensureQuarterScores = (sport, quarter) => {
  const normalizedQuarter = Math.max(1, Number(quarter || sport.currentQuarter || 1));
  if (!sport.quarterScores) {
    sport.quarterScores = { home: [], away: [] };
  }

  ["home", "away"].forEach((side) => {
    if (!Array.isArray(sport.quarterScores[side])) {
      sport.quarterScores[side] = [];
    }
    while (sport.quarterScores[side].length < normalizedQuarter) {
      sport.quarterScores[side].push({ quarter: sport.quarterScores[side].length + 1, score: 0 });
    }
  });

  return normalizedQuarter;
};

const ensurePlayerStats = (sport, event = {}) => {
  if (!event?.playerId || !event?.teamId) return null;
  const normalizedPlayerId = String(event.playerId);
  const normalizedTeamId = String(event.teamId);
  let stats = (sport.playerStats || []).find(
    (entry) => String(entry?.playerId) === normalizedPlayerId && String(entry?.teamId) === normalizedTeamId,
  );
  if (!stats) {
    stats = createBasketballPlayerStats(event);
    sport.playerStats = [...(sport.playerStats || []), stats];
  }
  return stats;
};

const applyBasketballEvent = (sport, rawEvent, base = {}) => {
  const event = {
    ...rawEvent,
    timestamp: rawEvent?.timestamp || new Date().toISOString(),
  };
  if (event._optimisticId) {
    event.optimistic = true;
  }

  const side = getEventSide(event, base);
  const oppositeSide = side === "home" ? "away" : "home";
  const playerStats = ensurePlayerStats(sport, event);

  if (!sport.score) {
    sport.score = { home: 0, away: 0 };
  }

  // Mirror the server: the quarter only ever moves forward, and quarter_transition
  // owns the advance. A stale event.quarter must not pull the game back.
  if (event.eventType === "quarter_transition") {
    sport.currentQuarter = Number(sport.currentQuarter || 1) + 1;
  } else {
    const eventQuarter = Number(event.quarter);
    if (Number.isFinite(eventQuarter) && eventQuarter > Number(sport.currentQuarter || 1)) {
      sport.currentQuarter = eventQuarter;
    }
  }
  event.quarter = Number(sport.currentQuarter || 1);

  const currentQuarter = ensureQuarterScores(sport, sport.currentQuarter);

  const addPoints = (points) => {
    sport.score[side] = Number(sport.score[side] || 0) + points;
    sport.quarterScores[side][currentQuarter - 1].score = Number(sport.quarterScores[side][currentQuarter - 1].score || 0) + points;
    if (playerStats) {
      playerStats.points = Number(playerStats.points || 0) + points;
    }
  };

  switch (event.eventType) {
    case "point_2":
      addPoints(2);
      if (playerStats) {
        playerStats.fieldGoalsMade = Number(playerStats.fieldGoalsMade || 0) + 1;
        playerStats.fieldGoalsAttempted = Number(playerStats.fieldGoalsAttempted || 0) + 1;
      }
      break;
    case "point_2_miss":
      if (playerStats) playerStats.fieldGoalsAttempted = Number(playerStats.fieldGoalsAttempted || 0) + 1;
      break;
    case "point_3":
      addPoints(3);
      if (playerStats) {
        playerStats.fieldGoalsMade = Number(playerStats.fieldGoalsMade || 0) + 1;
        playerStats.fieldGoalsAttempted = Number(playerStats.fieldGoalsAttempted || 0) + 1;
        playerStats.threePointsMade = Number(playerStats.threePointsMade || 0) + 1;
        playerStats.threePointsAttempted = Number(playerStats.threePointsAttempted || 0) + 1;
      }
      break;
    case "point_3_miss":
      if (playerStats) {
        playerStats.fieldGoalsAttempted = Number(playerStats.fieldGoalsAttempted || 0) + 1;
        playerStats.threePointsAttempted = Number(playerStats.threePointsAttempted || 0) + 1;
      }
      break;
    case "free_throw":
      addPoints(1);
      if (playerStats) {
        playerStats.freeThrowsMade = Number(playerStats.freeThrowsMade || 0) + 1;
        playerStats.freeThrowsAttempted = Number(playerStats.freeThrowsAttempted || 0) + 1;
      }
      break;
    case "free_throw_miss":
      if (playerStats) playerStats.freeThrowsAttempted = Number(playerStats.freeThrowsAttempted || 0) + 1;
      break;
    case "rebound":
      if (playerStats) playerStats.rebounds = Number(playerStats.rebounds || 0) + 1;
      ensureStatBucket(sport, "rebounds")[side] += 1;
      break;
    case "offensive_rebound":
      if (playerStats) {
        playerStats.rebounds = Number(playerStats.rebounds || 0) + 1;
        playerStats.offensiveRebounds = Number(playerStats.offensiveRebounds || 0) + 1;
      }
      ensureStatBucket(sport, "rebounds")[side] += 1;
      break;
    case "defensive_rebound":
      if (playerStats) {
        playerStats.rebounds = Number(playerStats.rebounds || 0) + 1;
        playerStats.defensiveRebounds = Number(playerStats.defensiveRebounds || 0) + 1;
      }
      ensureStatBucket(sport, "rebounds")[side] += 1;
      break;
    case "assist":
      if (playerStats) playerStats.assists = Number(playerStats.assists || 0) + 1;
      ensureStatBucket(sport, "assists")[side] += 1;
      break;
    case "steal":
      if (playerStats) playerStats.steals = Number(playerStats.steals || 0) + 1;
      ensureStatBucket(sport, "steals")[side] += 1;
      break;
    case "block":
      if (playerStats) playerStats.blocks = Number(playerStats.blocks || 0) + 1;
      ensureStatBucket(sport, "blocks")[side] += 1;
      break;
    case "turnover":
      if (playerStats) playerStats.turnovers = Number(playerStats.turnovers || 0) + 1;
      ensureStatBucket(sport, "turnovers")[side] += 1;
      break;
    case "foul":
    case "shooting_foul":
      if (playerStats) playerStats.fouls = Number(playerStats.fouls || 0) + 1;
      ensureStatBucket(sport, "fouls")[side] += 1;
      break;
    case "technical_foul":
      if (playerStats) {
        playerStats.fouls = Number(playerStats.fouls || 0) + 1;
        playerStats.technicalFouls = Number(playerStats.technicalFouls || 0) + 1;
      }
      ensureStatBucket(sport, "fouls")[side] += 1;
      break;
    case "flagrant_foul":
      if (playerStats) {
        playerStats.fouls = Number(playerStats.fouls || 0) + 1;
        playerStats.flagrantFouls = Number(playerStats.flagrantFouls || 0) + 1;
      }
      ensureStatBucket(sport, "fouls")[side] += 1;
      break;
    case "and_one":
      addPoints(2);
      if (playerStats) {
        playerStats.fieldGoalsMade = Number(playerStats.fieldGoalsMade || 0) + 1;
        playerStats.fieldGoalsAttempted = Number(playerStats.fieldGoalsAttempted || 0) + 1;
      }
      ensureStatBucket(sport, "fouls")[oppositeSide] += 1;
      break;
    case "timeout":
      ensureStatBucket(sport, "timeouts")[side] += 1;
      break;
    case "substitution": {
      const lineupField = side === "home" ? "homeLineup" : "awayLineup";
      if (Array.isArray(event.nextLineup) && event.nextLineup.length > 0) {
        sport[lineupField] = cloneLineup(event.nextLineup);
      }
      sport.substitutions = [
        ...(sport.substitutions || []),
        {
          playerIn: String(event.relatedPlayerId || ""),
          playerOut: String(event.playerId || ""),
          teamId: event.teamId,
          quarter: Number(event.quarter || sport.currentQuarter || 1),
          minute: Number(event.minute || 0),
          timestamp: event.timestamp || new Date().toISOString(),
        },
      ];
      break;
    }
    case "quarter_transition":
      // Advance and score-slot padding are both handled above.
      break;
    default:
      break;
  }

  if (sport.matchStatus === "scheduled") {
    sport.matchStatus = "in_progress";
  }

  if (event.shotClock !== undefined) {
    sport.shotClock = event.shotClock;
  }

  if (event.possession === "home" || event.possession === "away") {
    sport.possession = event.possession;
  }

  if (event.gameState !== undefined) {
    sport.gameState = event.gameState;
  }

  sport.events = [...(sport.events || []), event];
};

export const applyOptimisticBasketballUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;

  const nextGame = {
    ...prev,
    sport: cloneBasketballSport(prev.sport),
  };

  applyBasketballEvent(nextGame.sport, eventPayload, prev.base);
  return nextGame;
};

export const applyOptimisticBasketballUndo = (prev, options = {}) => {
  if (!prev?.sport || !prev?.base) {
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
  const nextGame = {
    ...prev,
    sport: createReplayBasketballSport(prev.sport),
  };

  events.forEach((event) => {
    applyBasketballEvent(nextGame.sport, event, prev.base);
  });

  if (events.length === 0) {
    nextGame.sport.matchStatus = "scheduled";
    nextGame.sport.gameState = null;
  }

  return { nextGame, removedEvent, removedIndex };
};