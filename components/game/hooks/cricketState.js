const cloneGame = (game) => {
  if (!game) return game;
  return JSON.parse(JSON.stringify(game));
};

const WICKET_EVENTS = new Set([
  "wicket",
  "bowled",
  "caught",
  "lbw",
  "run_out",
  "stumped",
  "hit_wicket",
]);

const ODD_RUN_EVENTS = new Set(["single", "triple"]);

const normalizeNumber = (value) => Number(value || 0);

const createEmptyPlayerStats = (playerId, teamId) => ({
  playerId,
  teamId,
  runs: 0,
  balls_faced: 0,
  fours: 0,
  sixes: 0,
  highest_score: 0,
  dot_balls: 0,
  balls_bowled: 0,
  runs_conceded: 0,
  wickets: 0,
  wides: 0,
  no_balls: 0,
  maidens: 0,
  catches: 0,
  run_outs: 0,
  batting_innings: 0,
  not_outs: 0,
  batting_average: 0,
  batting_strike_rate: 0,
  economy_rate: 0,
  overs_bowled: 0,
  bowling_strike_rate: 0,
  bowling_average: 0,
  best_bowling_wickets: 0,
  best_bowling_runs: 0,
  currentInnings: {
    runs: 0,
    balls: 0,
    isOut: false,
  },
});

const createExtrasBreakdown = (breakdown = {}) => ({
  wides: normalizeNumber(breakdown.wides),
  no_balls: normalizeNumber(breakdown.no_balls),
  byes: normalizeNumber(breakdown.byes),
  leg_byes: normalizeNumber(breakdown.leg_byes),
  penalty_runs: normalizeNumber(breakdown.penalty_runs),
});

const ensureScore = (sport) => {
  sport.score = {
    home: normalizeNumber(sport?.score?.home),
    away: normalizeNumber(sport?.score?.away),
  };
};

const createInnings = (sport, base) => {
  const currentInnings = sport.currentInnings || 1;
  const battingTeamId =
    sport.battingTeamId ||
    (currentInnings === 1 ? base?.teamId : base?.opponentTeamId) ||
    base?.teamId ||
    null;
  const bowlingTeamId =
    sport.bowlingTeamId ||
    (currentInnings === 1 ? base?.opponentTeamId : base?.teamId) ||
    base?.opponentTeamId ||
    null;

  return {
    inningsNumber: currentInnings,
    battingTeamId,
    bowlingTeamId,
    total_runs: 0,
    wickets: 0,
    overs_completed: 0,
    balls_completed: 0,
    extras: 0,
    extras_breakdown: createExtrasBreakdown(),
    powerplay_runs: 0,
    powerplay_wickets: 0,
    partnerships: [],
  };
};

const ensureCurrentInnings = (sport, base) => {
  if (!Array.isArray(sport.innings)) {
    sport.innings = [];
  }

  const inningsIndex = Math.max(0, (sport.currentInnings || 1) - 1);
  if (!sport.innings[inningsIndex]) {
    sport.innings[inningsIndex] = createInnings(sport, base);
  }

  const inningsData = sport.innings[inningsIndex];
  inningsData.total_runs = normalizeNumber(inningsData.total_runs);
  inningsData.wickets = normalizeNumber(inningsData.wickets);
  inningsData.overs_completed = normalizeNumber(inningsData.overs_completed);
  inningsData.balls_completed = normalizeNumber(inningsData.balls_completed);
  inningsData.extras = normalizeNumber(inningsData.extras);
  inningsData.extras_breakdown = createExtrasBreakdown(inningsData.extras_breakdown);

  if (!inningsData.battingTeamId) {
    inningsData.battingTeamId = sport.battingTeamId || base?.teamId || null;
  }
  if (!inningsData.bowlingTeamId) {
    inningsData.bowlingTeamId = sport.bowlingTeamId || base?.opponentTeamId || null;
  }

  return inningsData;
};

const getBattingSideKey = (inningsData, base) =>
  String(inningsData?.battingTeamId || "") === String(base?.teamId || "") ? "home" : "away";

const getBattingOrder = (sport, inningsData, base) =>
  getBattingSideKey(inningsData, base) === "home"
    ? sport.homeBattingOrder || []
    : sport.awayBattingOrder || [];

const getPlayingXI = (sport, inningsData, base) =>
  getBattingSideKey(inningsData, base) === "home"
    ? sport.homePlayingXI || []
    : sport.awayPlayingXI || [];

const ensureCurrentBatsmen = (sport, inningsData, base) => {
  if (Array.isArray(sport.currentBatsmen) && sport.currentBatsmen.length > 0) {
    return sport.currentBatsmen;
  }

  const battingOrder = [...getBattingOrder(sport, inningsData, base)]
    .sort((left, right) => normalizeNumber(left?.battingOrder || 99) - normalizeNumber(right?.battingOrder || 99));

  if (battingOrder.length >= 2) {
    sport.currentBatsmen = battingOrder.slice(0, 2).map((batter, index) => ({
      playerId: batter.playerId,
      striker: index === 0,
      runs: normalizeNumber(batter.runs),
      balls: normalizeNumber(batter.balls),
      fours: normalizeNumber(batter.fours),
      sixes: normalizeNumber(batter.sixes),
      battingOrder: normalizeNumber(batter.battingOrder || index + 1),
    }));
  } else if (!Array.isArray(sport.currentBatsmen)) {
    sport.currentBatsmen = [];
  }

  return sport.currentBatsmen;
};

const findOrCreatePlayerStats = (sport, playerId, teamId) => {
  if (!playerId || !teamId) return null;
  if (!Array.isArray(sport.playerStats)) {
    sport.playerStats = [];
  }

  let stats = sport.playerStats.find(
    (entry) => String(entry?.playerId || "") === String(playerId) && String(entry?.teamId || "") === String(teamId),
  );
  if (!stats) {
    stats = createEmptyPlayerStats(playerId, teamId);
    sport.playerStats.push(stats);
  }

  if (!stats.currentInnings) {
    stats.currentInnings = { runs: 0, balls: 0, isOut: false };
  }

  return stats;
};

const updatePlayerRates = (stats) => {
  if (!stats) return;

  const runs = normalizeNumber(stats.runs);
  const ballsFaced = normalizeNumber(stats.balls_faced);
  const runsConceded = normalizeNumber(stats.runs_conceded);
  const ballsBowled = normalizeNumber(stats.balls_bowled);
  const wickets = normalizeNumber(stats.wickets);

  stats.batting_strike_rate = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  stats.economy_rate = ballsBowled > 0 ? (runsConceded / ballsBowled) * 6 : 0;
  stats.overs_bowled = Math.floor(ballsBowled / 6) + ((ballsBowled % 6) / 10);

  if (wickets > 0) {
    stats.bowling_strike_rate = ballsBowled / wickets;
    stats.bowling_average = runsConceded / wickets;
  } else {
    stats.bowling_strike_rate = 0;
    stats.bowling_average = 0;
  }
};

const updateBattingOrderStats = (sport, inningsData, base, playerId, statsDelta = {}) => {
  const battingOrder = getBattingOrder(sport, inningsData, base);
  const batter = battingOrder.find((entry) => String(entry?.playerId || "") === String(playerId));
  if (!batter) return;

  batter.runs = normalizeNumber(batter.runs) + normalizeNumber(statsDelta.runs);
  batter.balls = normalizeNumber(batter.balls) + normalizeNumber(statsDelta.balls);
  batter.fours = normalizeNumber(batter.fours) + normalizeNumber(statsDelta.fours);
  batter.sixes = normalizeNumber(batter.sixes) + normalizeNumber(statsDelta.sixes);
};

const markBatsmanOut = (sport, inningsData, base, playerId) => {
  const battingOrder = getBattingOrder(sport, inningsData, base);
  const batter = battingOrder.find((entry) => String(entry?.playerId || "") === String(playerId));
  if (batter) {
    batter.isOut = true;
  }

  const playingXI = getPlayingXI(sport, inningsData, base);
  const player = playingXI.find((entry) => String(entry?.playerId || "") === String(playerId));
  if (player) {
    player.isOut = true;
    player.didBat = true;
  }
};

const getNextBatsman = (sport, inningsData, base) => {
  const battingOrder = [...getBattingOrder(sport, inningsData, base)]
    .sort((left, right) => normalizeNumber(left?.battingOrder || 99) - normalizeNumber(right?.battingOrder || 99));
  const currentBatsmenIds = new Set((sport.currentBatsmen || []).map((batter) => String(batter?.playerId || "")));

  return battingOrder.find(
    (batter) => !batter?.isOut && !currentBatsmenIds.has(String(batter?.playerId || "")),
  ) || null;
};

const syncScoreFromInnings = (sport, inningsData, base) => {
  if (String(inningsData?.battingTeamId || "") === String(base?.teamId || "")) {
    sport.score.home = normalizeNumber(inningsData.total_runs);
  } else {
    sport.score.away = normalizeNumber(inningsData.total_runs);
  }
};

const swapCurrentBatsmen = (sport) => {
  if (!Array.isArray(sport.currentBatsmen) || sport.currentBatsmen.length !== 2) return;
  sport.currentBatsmen = sport.currentBatsmen.map((batter) => ({
    ...batter,
    striker: !batter.striker,
  }));
};

const buildCurrentBowler = (sport, bowlerPlayerId, overNumber = null) => {
  const bowlerStats = findOrCreatePlayerStats(sport, bowlerPlayerId, sport.bowlingTeamId || sport.currentBowler?.teamId || null);
  return {
    playerId: bowlerPlayerId,
    overNumber: overNumber == null ? normalizeNumber(sport.currentOver) : normalizeNumber(overNumber),
    ballsInOver: 0,
    runsInOver: 0,
    wicketsInOver: 0,
    maidens: normalizeNumber(bowlerStats?.maidens),
  };
};

const applyBatsmanScoring = (sport, inningsData, base, striker, batsmanStats, runsScored) => {
  if (!striker || !batsmanStats) return;

  batsmanStats.runs = normalizeNumber(batsmanStats.runs) + runsScored;
  batsmanStats.balls_faced = normalizeNumber(batsmanStats.balls_faced) + 1;
  batsmanStats.currentInnings.runs = normalizeNumber(batsmanStats.currentInnings.runs) + runsScored;
  batsmanStats.currentInnings.balls = normalizeNumber(batsmanStats.currentInnings.balls) + 1;
  batsmanStats.highest_score = Math.max(normalizeNumber(batsmanStats.highest_score), batsmanStats.currentInnings.runs);

  striker.runs = normalizeNumber(striker.runs) + runsScored;
  striker.balls = normalizeNumber(striker.balls) + 1;

  const statsDelta = { runs: runsScored, balls: 1, fours: 0, sixes: 0 };
  if (runsScored === 4) {
    batsmanStats.fours = normalizeNumber(batsmanStats.fours) + 1;
    striker.fours = normalizeNumber(striker.fours) + 1;
    statsDelta.fours = 1;
  }
  if (runsScored === 6) {
    batsmanStats.sixes = normalizeNumber(batsmanStats.sixes) + 1;
    striker.sixes = normalizeNumber(striker.sixes) + 1;
    statsDelta.sixes = 1;
  }

  updateBattingOrderStats(sport, inningsData, base, striker.playerId, statsDelta);
};

const applyDotBall = (sport, inningsData, base, striker, batsmanStats, bowlerStats) => {
  inningsData.balls_completed += 1;

  if (striker && batsmanStats) {
    batsmanStats.balls_faced = normalizeNumber(batsmanStats.balls_faced) + 1;
    batsmanStats.currentInnings.balls = normalizeNumber(batsmanStats.currentInnings.balls) + 1;
    striker.balls = normalizeNumber(striker.balls) + 1;
    updateBattingOrderStats(sport, inningsData, base, striker.playerId, { balls: 1 });
  }

  if (bowlerStats) {
    bowlerStats.dot_balls = normalizeNumber(bowlerStats.dot_balls) + 1;
    bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
  }
  if (sport.currentBowler) {
    sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
  }
};

const applyWideOrNoBall = (sport, inningsData, bowlerStats, eventType, runsScored) => {
  inningsData.total_runs += runsScored;
  inningsData.extras += runsScored;

  if (eventType === "wide") {
    inningsData.extras_breakdown.wides += runsScored;
    if (bowlerStats) {
      bowlerStats.wides = normalizeNumber(bowlerStats.wides) + 1;
    }
  } else {
    inningsData.extras_breakdown.no_balls += runsScored;
    if (bowlerStats) {
      bowlerStats.no_balls = normalizeNumber(bowlerStats.no_balls) + 1;
    }
  }

  if (bowlerStats) {
    bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + runsScored;
  }
  if (sport.currentBowler) {
    sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + runsScored;
  }
};

const applyByeOrLegBye = (sport, inningsData, bowlerStats, eventType, runsScored) => {
  inningsData.total_runs += runsScored;
  inningsData.extras += runsScored;
  inningsData.balls_completed += 1;
  if (eventType === "bye") {
    inningsData.extras_breakdown.byes += runsScored;
  } else {
    inningsData.extras_breakdown.leg_byes += runsScored;
  }

  if (bowlerStats) {
    bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
  }
  if (sport.currentBowler) {
    sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
  }
};

const applyWicket = (sport, inningsData, base, bowlerStats, eventPayload) => {
  inningsData.wickets += 1;
  const runsCompleted = normalizeNumber(eventPayload.runs);
  if (runsCompleted > 0) {
    inningsData.total_runs += runsCompleted;
  }

  if (!Array.isArray(sport.fallOfWickets)) {
    sport.fallOfWickets = [];
  }
  sport.fallOfWickets.push({
    wicket_number: inningsData.wickets,
    runs: inningsData.total_runs,
    overs: normalizeNumber(inningsData.overs_completed),
    balls: normalizeNumber(inningsData.balls_completed),
    player_out_id: eventPayload.dismissedPlayerId || eventPayload.playerId,
    wicket_type: eventPayload.wicketType || eventPayload.eventType,
    fielder_id: eventPayload.fielderId || null,
  });

  if (bowlerStats && eventPayload.eventType !== "run_out") {
    bowlerStats.wickets = normalizeNumber(bowlerStats.wickets) + 1;
    bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
  } else if (bowlerStats) {
    bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
  }

  if (sport.currentBowler) {
    sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
    if (eventPayload.eventType !== "run_out") {
      sport.currentBowler.wicketsInOver = normalizeNumber(sport.currentBowler.wicketsInOver) + 1;
    }
  }

  if (eventPayload.fielderId) {
    const fielderStats = findOrCreatePlayerStats(sport, eventPayload.fielderId, inningsData.bowlingTeamId);
    if (fielderStats) {
      if (eventPayload.eventType === "caught") {
        fielderStats.catches = normalizeNumber(fielderStats.catches) + 1;
      }
      if (eventPayload.eventType === "run_out" || eventPayload.eventType === "stumped") {
        fielderStats.run_outs = normalizeNumber(fielderStats.run_outs) + 1;
      }
      updatePlayerRates(fielderStats);
    }
  }

  const dismissedPlayerId = eventPayload.dismissedPlayerId || eventPayload.playerId;
  markBatsmanOut(sport, inningsData, base, dismissedPlayerId);

  const dismissedStats = findOrCreatePlayerStats(sport, dismissedPlayerId, inningsData.battingTeamId);
  if (dismissedStats) {
    dismissedStats.currentInnings.isOut = true;
    updatePlayerRates(dismissedStats);
  }

  if (Array.isArray(sport.currentBatsmen) && sport.currentBatsmen.length > 0) {
    const dismissedIndex = sport.currentBatsmen.findIndex(
      (batter) => String(batter?.playerId || "") === String(dismissedPlayerId),
    );
    if (dismissedIndex !== -1) {
      const nextBatsman = getNextBatsman(sport, inningsData, base);
      if (nextBatsman) {
        sport.currentBatsmen[dismissedIndex] = {
          playerId: nextBatsman.playerId,
          striker: !!sport.currentBatsmen[dismissedIndex]?.striker,
          runs: normalizeNumber(nextBatsman.runs),
          balls: normalizeNumber(nextBatsman.balls),
          fours: normalizeNumber(nextBatsman.fours),
          sixes: normalizeNumber(nextBatsman.sixes),
          battingOrder: normalizeNumber(nextBatsman.battingOrder),
        };
      }
    }
  }

  inningsData.balls_completed += 1;
};

const finalizeDelivery = (sport, inningsData, bowlerStats, eventPayload) => {
  if (eventPayload.eventType === "wide" || eventPayload.eventType === "no_ball") {
    inningsData.overs_completed = Math.floor(normalizeNumber(inningsData.balls_completed) / 6);
    return;
  }

  const ballsCompleted = normalizeNumber(inningsData.balls_completed);
  if (ballsCompleted > 0 && ballsCompleted % 6 === 0) {
    inningsData.overs_completed = ballsCompleted / 6;
    swapCurrentBatsmen(sport);

    if (sport.currentBowler) {
      const completedOverRuns = normalizeNumber(sport.currentBowler.runsInOver);
      sport.currentBowler.overNumber = inningsData.overs_completed;
      sport.currentBowler.ballsInOver = 0;
      if (completedOverRuns === 0) {
        sport.currentBowler.maidens = normalizeNumber(sport.currentBowler.maidens) + 1;
        if (bowlerStats) {
          bowlerStats.maidens = normalizeNumber(bowlerStats.maidens) + 1;
        }
      }
      sport.currentBowler.runsInOver = 0;
      sport.currentBowler.wicketsInOver = 0;
    }
    return;
  }

  inningsData.overs_completed = Math.floor(ballsCompleted / 6);
};

const applyStrikeRotation = (sport, eventPayload) => {
  if (!Array.isArray(sport.currentBatsmen) || sport.currentBatsmen.length !== 2) return;
  if (ODD_RUN_EVENTS.has(eventPayload.eventType)) {
    swapCurrentBatsmen(sport);
  }
};

const SCORING_EVENT_TYPES = new Set([
  "dot_ball",
  "single",
  "double",
  "triple",
  "boundary_4",
  "boundary_6",
  "ball",
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
]);

const runsFromEvent = (event) => {
  if (event?.runs != null) return normalizeNumber(event.runs);
  switch (event?.eventType) {
    case "dot_ball":
    case "ball":
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
      return 1;
    case "bye":
    case "leg_bye":
      return normalizeNumber(event?.runs) || 1;
    default:
      return 0;
  }
};

const isLegalDelivery = (event) =>
  event && !["wide", "no_ball"].includes(event.eventType);

export const getCricketInningsStatsFromEvents = (sport, inningsNum = 1) => {
  const events = (sport?.events || []).filter(Boolean);
  const inningsEvents = events.filter(
    (event) => (normalizeNumber(event?.innings) || 1) === inningsNum,
  );

  let totalRuns = 0;
  let ballsCompleted = 0;
  let wickets = 0;

  for (const event of inningsEvents) {
    if (WICKET_EVENTS.has(event.eventType)) {
      wickets += 1;
      continue;
    }
    if (!SCORING_EVENT_TYPES.has(event.eventType)) continue;
    totalRuns += runsFromEvent(event);
    if (isLegalDelivery(event)) {
      ballsCompleted += 1;
    }
  }

  return {
    totalRuns,
    ballsCompleted,
    wickets,
    oversCompleted: Math.floor(ballsCompleted / 6),
  };
};

/**
 * Rebuild innings totals from the event log so total_runs always matches
 * what the "this over" strip shows. Fixes undo/poll races where events and
 * innings.total_runs drift apart at the start of a match.
 */
export const reconcileCricketTotalsFromEvents = (game) => {
  if (!game?.sport || !game?.base) return game;

  const nextGame = cloneGame(game);
  const sport = nextGame.sport;
  const base = nextGame.base;
  ensureScore(sport);

  const events = (sport.events || []).filter(Boolean);
  const savedInnings = sport.currentInnings || 1;
  const maxInnings = Math.max(
    savedInnings,
    ...events.map((event) => normalizeNumber(event?.innings) || 1),
    Array.isArray(sport.innings) ? sport.innings.length : 0,
  );

  for (let inningsNum = 1; inningsNum <= maxInnings; inningsNum += 1) {
    sport.currentInnings = inningsNum;
    const inningsData = ensureCurrentInnings(sport, base);
    const stats = getCricketInningsStatsFromEvents(sport, inningsNum);

    inningsData.total_runs = stats.totalRuns;
    inningsData.balls_completed = stats.ballsCompleted;
    inningsData.overs_completed = stats.oversCompleted;
    inningsData.wickets = stats.wickets;
    syncScoreFromInnings(sport, inningsData, base);
    if (inningsNum === savedInnings) {
      updateMatchStateFromInnings(sport, inningsData);
    }
  }

  sport.currentInnings = savedInnings;
  return nextGame;
};

const SUPER_OVER_MAX_OVERS = 1;
const SUPER_OVER_MAX_WICKETS = 2;
const MAIN_MAX_WICKETS = 10;

export const isSuperOverInnings = (sport, inningsNumber) => {
  const inn = sport?.innings?.[inningsNumber - 1];
  return !!(inn?.isSuperOver || inningsNumber >= 3);
};

/** Per-innings limits: main match vs Super Over (1 over, 2 wickets). */
export const getInningsLimits = (sport, inningsNumber) => {
  if (isSuperOverInnings(sport, inningsNumber)) {
    return {
      maxOvers: SUPER_OVER_MAX_OVERS,
      maxWickets: SUPER_OVER_MAX_WICKETS,
      maxBalls: SUPER_OVER_MAX_OVERS * 6,
      isSuperOver: true,
    };
  }
  const totalOvers = normalizeNumber(sport?.totalOvers) || 20;
  return {
    maxOvers: totalOvers,
    maxWickets: MAIN_MAX_WICKETS,
    maxBalls: totalOvers * 6,
    isSuperOver: false,
  };
};

const isInningsComplete = (inningsData, limits) =>
  normalizeNumber(inningsData?.wickets) >= limits.maxWickets ||
  normalizeNumber(inningsData?.balls_completed) >= limits.maxBalls ||
  normalizeNumber(inningsData?.overs_completed) >= limits.maxOvers;

const resolveSuperOverPairWinner = (firstInnings, secondInnings) => {
  if (!firstInnings || !secondInnings) return null;
  const target = normalizeNumber(firstInnings.total_runs) + 1;
  const chaseRuns = normalizeNumber(secondInnings.total_runs);
  if (chaseRuns >= target) return String(secondInnings.battingTeamId);
  const limits = getInningsLimits({ innings: [{ isSuperOver: true }] }, 3);
  const chaseComplete = isInningsComplete(secondInnings, limits);
  if (!chaseComplete) return null;
  if (chaseRuns === target - 1) return null;
  return String(firstInnings.battingTeamId);
};

const getSuperOverPairs = (innings = []) => {
  const pairs = [];
  for (let i = 2; i < innings.length; i += 2) {
    if (innings[i] && innings[i + 1]) {
      pairs.push([innings[i], innings[i + 1]]);
    }
  }
  return pairs;
};

const buildWinnerResult = (winnerTeamId, homeId, { superOver = false, margin, marginType } = {}) => ({
  finished: true,
  superOver,
  winnerTeamId,
  winnerSide: String(winnerTeamId) === homeId ? "home" : "away",
  margin,
  marginType,
  resultText: superOver
    ? "won (Super Over)"
    : marginType === "wickets"
      ? `won by ${margin} wicket${margin === 1 ? "" : "s"}`
      : `won by ${margin} run${margin === 1 ? "" : "s"}`,
});

const updateMatchStateFromInnings = (sport, inningsData) => {
  const currentInnings = sport.currentInnings || 1;
  const limits = getInningsLimits(sport, currentInnings);
  const inningsEnded = isInningsComplete(inningsData, limits);

  if (currentInnings === 1 && inningsEnded) {
    sport.matchStatus = "innings_break";
    sport.result = {
      ...(sport.result || {}),
      target: normalizeNumber(inningsData.total_runs) + 1,
    };
  } else if (currentInnings === 2) {
    const first = sport.innings?.[0];
    const chaseTarget = normalizeNumber(first?.total_runs) + 1;
    const chaseRuns = normalizeNumber(inningsData.total_runs);
    if (chaseRuns >= chaseTarget) {
      sport.matchStatus = "finished";
    } else if (inningsEnded) {
      const isTied = first && normalizeNumber(first.total_runs) === chaseRuns;
      if (isTied && sport.superOverAllowed) {
        sport.matchStatus = "super_over_break";
      } else {
        sport.matchStatus = "finished";
      }
    }
  } else if (currentInnings >= 3) {
    if (currentInnings % 2 === 1 && inningsEnded) {
      sport.matchStatus = "super_over_break";
      sport.result = {
        ...(sport.result || {}),
        superOverTarget: normalizeNumber(inningsData.total_runs) + 1,
        is_super_over: true,
      };
    } else if (currentInnings % 2 === 0) {
      const prev = sport.innings?.[currentInnings - 2];
      const chaseTarget = normalizeNumber(prev?.total_runs) + 1;
      const chaseRuns = normalizeNumber(inningsData.total_runs);
      if (chaseRuns >= chaseTarget) {
        sport.matchStatus = "finished";
      } else if (inningsEnded) {
        const winnerTeamId = resolveSuperOverPairWinner(prev, inningsData);
        sport.matchStatus = winnerTeamId ? "finished" : (sport.superOverAllowed ? "super_over_break" : "finished");
        if (winnerTeamId) {
          sport.result = { ...(sport.result || {}), is_super_over: true, winner: winnerTeamId };
        }
      }
    }
  }

  sport.currentOver = normalizeNumber(inningsData.overs_completed);
  sport.currentBall = normalizeNumber(inningsData.balls_completed) % 6;
  sport.battingTeamId = inningsData.battingTeamId;
  sport.bowlingTeamId = inningsData.bowlingTeamId;
};

export const applyOptimisticCricketUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;

  const nextGame = cloneGame(prev);
  const sport = nextGame.sport;
  const base = nextGame.base;
  ensureScore(sport);

  const inningsData = ensureCurrentInnings(sport, base);
  ensureCurrentBatsmen(sport, inningsData, base);

  if (!Array.isArray(sport.events)) {
    sport.events = [];
  }
  sport.events.push({
    ...eventPayload,
    optimistic: true,
    pending: eventPayload.pending !== false,
  });

  const striker = Array.isArray(sport.currentBatsmen)
    ? sport.currentBatsmen.find((batter) => batter?.striker)
    : null;
  const strikerStats = striker?.playerId
    ? findOrCreatePlayerStats(sport, striker.playerId, inningsData.battingTeamId)
    : null;

  const bowlerPlayerId = sport.currentBowler?.playerId || (String(eventPayload.teamId || "") === String(inningsData.bowlingTeamId || "") ? eventPayload.playerId : null);
  const bowlerStats = bowlerPlayerId
    ? findOrCreatePlayerStats(sport, bowlerPlayerId, inningsData.bowlingTeamId)
    : null;

  if (!sport.currentBowler && bowlerPlayerId) {
    sport.currentBowler = buildCurrentBowler(sport, bowlerPlayerId, sport.currentOver || 0);
  }

  switch (eventPayload.eventType) {
    case "dot_ball":
      applyDotBall(sport, inningsData, base, striker, strikerStats, bowlerStats);
      break;

    case "single":
      applyBatsmanScoring(sport, inningsData, base, striker, strikerStats, 1);
      inningsData.total_runs += 1;
      inningsData.balls_completed += 1;
      if (bowlerStats) {
        bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + 1;
        bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
      }
      if (sport.currentBowler) {
        sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
        sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + 1;
      }
      break;

    case "double":
      applyBatsmanScoring(sport, inningsData, base, striker, strikerStats, 2);
      inningsData.total_runs += 2;
      inningsData.balls_completed += 1;
      if (bowlerStats) {
        bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + 2;
        bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
      }
      if (sport.currentBowler) {
        sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
        sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + 2;
      }
      break;

    case "triple":
      applyBatsmanScoring(sport, inningsData, base, striker, strikerStats, 3);
      inningsData.total_runs += 3;
      inningsData.balls_completed += 1;
      if (bowlerStats) {
        bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + 3;
        bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
      }
      if (sport.currentBowler) {
        sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
        sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + 3;
      }
      break;

    case "boundary_4":
      applyBatsmanScoring(sport, inningsData, base, striker, strikerStats, 4);
      inningsData.total_runs += 4;
      inningsData.balls_completed += 1;
      if (bowlerStats) {
        bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + 4;
        bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
      }
      if (sport.currentBowler) {
        sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
        sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + 4;
      }
      break;

    case "boundary_6":
      applyBatsmanScoring(sport, inningsData, base, striker, strikerStats, 6);
      inningsData.total_runs += 6;
      inningsData.balls_completed += 1;
      if (bowlerStats) {
        bowlerStats.runs_conceded = normalizeNumber(bowlerStats.runs_conceded) + 6;
        bowlerStats.balls_bowled = normalizeNumber(bowlerStats.balls_bowled) + 1;
      }
      if (sport.currentBowler) {
        sport.currentBowler.ballsInOver = normalizeNumber(sport.currentBowler.ballsInOver) + 1;
        sport.currentBowler.runsInOver = normalizeNumber(sport.currentBowler.runsInOver) + 6;
      }
      break;

    case "wide":
    case "no_ball":
      applyWideOrNoBall(sport, inningsData, bowlerStats, eventPayload.eventType, normalizeNumber(eventPayload.runs) || 1);
      break;

    case "bye":
    case "leg_bye":
      applyByeOrLegBye(sport, inningsData, bowlerStats, eventPayload.eventType, normalizeNumber(eventPayload.runs) || 1);
      break;

    default:
      if (WICKET_EVENTS.has(eventPayload.eventType)) {
        applyWicket(sport, inningsData, base, bowlerStats, eventPayload);
      } else {
        return prev;
      }
      break;
  }

  applyStrikeRotation(sport, eventPayload);
  finalizeDelivery(sport, inningsData, bowlerStats, eventPayload);
  syncScoreFromInnings(sport, inningsData, base);
  updateMatchStateFromInnings(sport, inningsData);

  updatePlayerRates(strikerStats);
  updatePlayerRates(bowlerStats);

  const lastEvent = sport.events[sport.events.length - 1];
  if (lastEvent) {
    if (lastEvent.innings == null) {
      lastEvent.innings = sport.currentInnings || 1;
    }
    if (lastEvent.overNumber == null) {
      lastEvent.overNumber = normalizeNumber(sport.currentOver);
    }
    if (lastEvent.ballNumber == null) {
      lastEvent.ballNumber = normalizeNumber(sport.currentBall);
    }
  }

  return nextGame;
};

export const applyOptimisticCricketSwapStrike = (prev) => {
  if (!prev?.sport?.currentBatsmen || prev.sport.currentBatsmen.length !== 2) return prev;
  const nextGame = cloneGame(prev);
  swapCurrentBatsmen(nextGame.sport);
  return nextGame;
};

export const applyOptimisticCricketChangeBowler = (prev, bowlerPlayerId) => {
  if (!prev?.sport || !prev?.base || !bowlerPlayerId) return prev;
  const nextGame = cloneGame(prev);
  const sport = nextGame.sport;
  const base = nextGame.base;
  const inningsData = ensureCurrentInnings(sport, base);

  sport.bowlingTeamId = inningsData.bowlingTeamId;
  sport.currentBowler = buildCurrentBowler(sport, bowlerPlayerId, sport.currentOver || inningsData.overs_completed || 0);
  return nextGame;
};

export const replayPendingCricketActions = (game, actions = []) => {
  return (actions || []).reduce((nextGame, action) => {
    if (!nextGame) return nextGame;

    if (action?.type === "event" && action.payload) {
      return applyOptimisticCricketUpdate(nextGame, action.payload);
    }

    if (action?.type === "swap_strike") {
      return applyOptimisticCricketSwapStrike(nextGame);
    }

    if (action?.type === "change_bowler" && action.bowlerPlayerId) {
      return applyOptimisticCricketChangeBowler(nextGame, action.bowlerPlayerId);
    }

    return nextGame;
  }, game);
};

// ────────────────────────────────────────────────────────────────────────
// Derived, read-only helpers (Phase 1). These never mutate game state; they
// only compute display values from the existing sport data / event log.
// ────────────────────────────────────────────────────────────────────────

/**
 * Human-friendly limited-overs format label for a given overs count.
 * Purely derived from totalOvers — no persistence is required.
 */
export const getCricketMatchFormatLabel = (totalOvers) => {
  const overs = normalizeNumber(totalOvers);
  if (overs <= 0) return "Custom";
  switch (overs) {
    case 5:
      return "T5";
    case 10:
      return "T10";
    case 15:
      return "T15";
    case 20:
      return "T20";
    case 50:
      return "ODI";
    default:
      return `${overs} Overs`;
  }
};

const FREE_HIT_DELIVERY_TYPES = new Set([
  "dot_ball",
  "single",
  "double",
  "triple",
  "boundary_4",
  "boundary_6",
  "ball",
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "wicket",
  "bowled",
  "caught",
  "lbw",
  "run_out",
  "stumped",
  "hit_wicket",
]);

/**
 * True when the next delivery in the current innings is a free hit.
 *
 * A free hit follows a no-ball and stays in effect until the next *legal*
 * delivery is bowled. Wides in between do not clear it (they are not legal
 * deliveries), so they are skipped while scanning backwards.
 */
export const getCricketFreeHit = (sport) => {
  if (!sport) return false;
  const inningsNum = normalizeNumber(sport.currentInnings) || 1;
  const events = (sport.events || []).filter(Boolean);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if ((normalizeNumber(event?.innings) || 1) !== inningsNum) continue;
    if (!FREE_HIT_DELIVERY_TYPES.has(event?.eventType)) continue;
    if (event.eventType === "wide") continue;
    return event.eventType === "no_ball";
  }
  return false;
};

/**
 * Compute the limited-overs match result from innings data.
 * Supports main match + Super Over eliminator innings.
 */
export const getCricketMatchResult = (game) => {
  const sport = game?.sport;
  const base = game?.base;
  if (!sport || !base) return { finished: false };

  const innings = Array.isArray(sport.innings) ? sport.innings : [];
  const first = innings[0];
  const second = innings[1];
  if (!first || !second) return { finished: false };

  const homeId = String(base.teamId || "");
  const isFinishedFlag =
    sport.matchStatus === "finished" || base.status === "finished";
  const superOverAllowed = !!sport.superOverAllowed;
  const soPairs = getSuperOverPairs(innings);

  // Super Over pairs decided the match
  if (soPairs.length > 0) {
    const [soFirst, soSecond] = soPairs[soPairs.length - 1];
    const soWinner = resolveSuperOverPairWinner(soFirst, soSecond);
    if (soWinner) {
      return buildWinnerResult(soWinner, homeId, { superOver: true });
    }

    const limits = getInningsLimits(sport, soSecond.inningsNumber || 4);
    const chaseTarget = normalizeNumber(soFirst.total_runs) + 1;
    const chaseRuns = normalizeNumber(soSecond.total_runs);
    const chaseComplete =
      isInningsComplete(soSecond, limits) || isFinishedFlag;
    if (chaseComplete && chaseRuns === chaseTarget - 1 && superOverAllowed) {
      return {
        finished: false,
        tie: true,
        needsSuperOver: true,
        superOver: true,
        resultText: "Super Over tied — play again",
      };
    }
    if (chaseComplete && !soWinner && superOverAllowed && sport.matchStatus === "super_over_break") {
      return {
        finished: false,
        tie: true,
        needsSuperOver: true,
        superOver: true,
        resultText: "Super Over tied — play again",
      };
    }
  }

  const totalOvers = normalizeNumber(sport.totalOvers) || 20;
  const mainLimits = getInningsLimits(sport, 2);
  const target = normalizeNumber(first.total_runs) + 1;
  const chaseRuns = normalizeNumber(second.total_runs);
  const chaseWickets = normalizeNumber(second.wickets);
  const chaseBalls = normalizeNumber(second.balls_completed);
  const chaseOversDone = chaseBalls >= totalOvers * 6;
  const chaseAllOut = chaseWickets >= mainLimits.maxWickets;
  const chaseTeamId = second.battingTeamId;
  const defendTeamId = first.battingTeamId;

  if (chaseRuns >= target) {
    const wicketsInHand = Math.max(0, mainLimits.maxWickets - chaseWickets);
    return buildWinnerResult(chaseTeamId, homeId, {
      margin: wicketsInHand,
      marginType: "wickets",
    });
  }

  const chaseComplete = chaseAllOut || chaseOversDone || isFinishedFlag;
  if (chaseComplete) {
    if (chaseRuns === target - 1) {
      if (superOverAllowed && soPairs.length === 0) {
        return {
          finished: false,
          tie: true,
          needsSuperOver: true,
          resultText: "Match tied — Super Over",
        };
      }
      return { finished: true, tie: true, resultText: "Match tied" };
    }
    const runMargin = target - 1 - chaseRuns;
    return buildWinnerResult(defendTeamId, homeId, {
      margin: runMargin,
      marginType: "runs",
    });
  }

  if (
    superOverAllowed &&
    sport.matchStatus === "super_over_break" &&
    !isFinishedFlag
  ) {
    const soActive = innings.length > 2;
    return {
      finished: false,
      tie: true,
      needsSuperOver: true,
      superOver: soActive,
      resultText: soActive && innings.length % 2 === 1
        ? "Super Over — start 2nd innings"
        : soActive
          ? "Super Over tied — play again"
          : "Match tied — Super Over",
    };
  }

  return { finished: false };
};