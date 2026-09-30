const DEFAULT_MATCH_STATS = {
  total_shots: { home: 0, away: 0 },
  shots_on_target: { home: 0, away: 0 },
  corners: { home: 0, away: 0 },
  fouls: { home: 0, away: 0 },
  offsides: { home: 0, away: 0 },
  yellow_cards: { home: 0, away: 0 },
  red_cards: { home: 0, away: 0 },
  passes: { home: 0, away: 0 },
  pass_accuracy: { home: 0, away: 0 },
};

const SHOT_EVENTS = new Set([
  "goal",
  "shot",
  "shot_on_target",
  "shot_off_target",
  "shot_blocked",
  "penalty_scored",
  "penalty_missed",
]);

const cloneSideBucket = (bucket = {}) => ({
  home: Number(bucket?.home || 0),
  away: Number(bucket?.away || 0),
});

const cloneMatchStats = (stats = {}) => {
  return Object.keys(DEFAULT_MATCH_STATS).reduce((next, key) => {
    next[key] = cloneSideBucket(stats?.[key] || DEFAULT_MATCH_STATS[key]);
    return next;
  }, {});
};

const cloneResult = (result = {}) => ({
  ...result,
  is_extra_time: !!result?.is_extra_time,
  is_penalties: !!result?.is_penalties,
  penalties_score: cloneSideBucket(result?.penalties_score || {}),
});

const cloneLineup = (lineup = []) =>
  Array.isArray(lineup) ? lineup.filter(Boolean).map((entry) => ({ ...entry })) : [];

const createFootballPlayerStats = (event = {}) => ({
  playerId: event.playerId,
  teamId: event.teamId,
  goals: 0,
  assists: 0,
  shots: 0,
  shots_on_target: 0,
  shots_off_target: 0,
  passes: 0,
  passes_completed: 0,
  tackles: 0,
  tackles_won: 0,
  interceptions: 0,
  fouls: 0,
  yellow_cards: 0,
  red_cards: 0,
  saves: 0,
  corners: 0,
  offsides: 0,
  clearances: 0,
  blocks: 0,
  dribbles: 0,
  dribbles_success: 0,
  crosses: 0,
  key_passes: 0,
  chances_created: 0,
  big_chances: 0,
  big_chances_missed: 0,
  aerial_duels: 0,
  aerial_duels_won: 0,
  hit_woodwork: 0,
  penalties: 0,
  penalties_scored: 0,
  penalties_missed: 0,
  through_balls: 0,
  long_balls: 0,
  fouls_committed: 0,
  fouls_suffered: 0,
  turnovers: 0,
  dispossessed: 0,
  punches: 0,
  catches: 0,
  claims: 0,
  goals_conceded: 0,
  clean_sheets: 0,
  minutes_played: 0,
  distance_covered: 0,
  sprints: 0,
  goal_contributions: 0,
  free_kicks: 0,
});

const clonePlayerStats = (stats = {}) => ({
  ...createFootballPlayerStats(stats),
  ...stats,
});

const cloneFootballSport = (sport = {}) => ({
  ...sport,
  score: {
    home: Number(sport?.score?.home || 0),
    away: Number(sport?.score?.away || 0),
    home_ht: Number(sport?.score?.home_ht || 0),
    away_ht: Number(sport?.score?.away_ht || 0),
  },
  currentMinute: Number(sport?.currentMinute || 0),
  currentSecond: Number(sport?.currentSecond || 0),
  currentPeriod: Number(sport?.currentPeriod || 1),
  matchStatus: sport?.matchStatus || "scheduled",
  addedTime: Number(sport?.addedTime || 0),
  homeLineup: cloneLineup(sport?.homeLineup),
  awayLineup: cloneLineup(sport?.awayLineup),
  substitutions: Array.isArray(sport?.substitutions)
    ? sport.substitutions.filter(Boolean).map((entry) => ({ ...entry }))
    : [],
  matchStats: cloneMatchStats(sport?.matchStats),
  events: Array.isArray(sport?.events)
    ? sport.events.filter(Boolean).map((event) => ({ ...event }))
    : [],
  playerStats: Array.isArray(sport?.playerStats)
    ? sport.playerStats.filter(Boolean).map(clonePlayerStats)
    : [],
  result: cloneResult(sport?.result),
});

const getEventSide = (event = {}, base = {}) =>
  String(event?.teamId) === String(base?.teamId) ? "home" : "away";

const incrementStat = (stats, key, amount = 1) => {
  if (!stats) return;
  stats[key] = Number(stats[key] || 0) + amount;
};

const decrementStat = (stats, key, amount = 1) => {
  if (!stats) return;
  stats[key] = Math.max(0, Number(stats[key] || 0) - amount);
};

const ensureMatchBucket = (sport, key) => {
  if (!sport.matchStats) {
    sport.matchStats = cloneMatchStats();
  }
  if (!sport.matchStats[key]) {
    sport.matchStats[key] = cloneSideBucket();
  }
  return sport.matchStats[key];
};

const ensureResult = (sport) => {
  if (!sport.result) {
    sport.result = cloneResult();
  }
  if (!sport.result.penalties_score) {
    sport.result.penalties_score = cloneSideBucket();
  }
  return sport.result;
};

const ensurePlayerStats = (sport, event = {}) => {
  if (!event?.playerId || !event?.teamId) return null;
  const normalizedPlayerId = String(event.playerId);
  const normalizedTeamId = String(event.teamId);
  let stats = (sport.playerStats || []).find(
    (entry) => String(entry?.playerId) === normalizedPlayerId && String(entry?.teamId) === normalizedTeamId,
  );
  if (!stats) {
    stats = createFootballPlayerStats(event);
    sport.playerStats = [...(sport.playerStats || []), stats];
  }
  return stats;
};

const updateMatchClock = (sport, event = {}) => {
  if (event.minute !== undefined) sport.currentMinute = Number(event.minute || 0);
  if (event.second !== undefined) sport.currentSecond = Number(event.second || 0);
  if (event.period !== undefined) {
    sport.currentPeriod = Number(event.period || 1);
    switch (sport.currentPeriod) {
      case 1:
        sport.matchStatus = "first_half";
        break;
      case 2:
        sport.matchStatus = "second_half";
        break;
      case 3:
        sport.matchStatus = "extra_time";
        break;
      default:
        break;
    }
  }
};

const findOrCreateLineupSlot = (lineup, playerId, defaults = {}) => {
  let idx = lineup.findIndex((player) => String(player?.playerId) === String(playerId));
  if (idx === -1) {
    lineup.push({
      playerId: String(playerId),
      position: defaults.position ?? null,
      jerseyNumber: defaults.jerseyNumber ?? null,
      isSubstitute: !!defaults.isSubstitute,
      startingMinute: defaults.startingMinute ?? 0,
      substitutionMinute: defaults.substitutionMinute ?? null,
    });
    idx = lineup.length - 1;
  }
  return idx;
};

export const applyFootballLineupSwap = (sport, side, playerOutId, playerInId, options = {}) => {
  if (!sport || !playerOutId || !playerInId) return false;

  const lineupField = side === "home" ? "homeLineup" : "awayLineup";
  let lineup = cloneLineup(sport[lineupField]);
  const minute = Number(options.minute ?? sport.currentMinute ?? 0);

  if (lineup.length === 0 && Array.isArray(options.bootstrapLineup) && options.bootstrapLineup.length > 0) {
    lineup = options.bootstrapLineup.map((slot) => ({ ...slot }));
  }

  const outIdx = findOrCreateLineupSlot(lineup, playerOutId, {
    isSubstitute: false,
    substitutionMinute: null,
    startingMinute: 0,
  });
  const inIdx = findOrCreateLineupSlot(lineup, playerInId, {
    isSubstitute: true,
    substitutionMinute: null,
    startingMinute: minute,
  });

  const period = Number(options.period ?? sport.currentPeriod ?? 1);
  const teamId = options.teamId || lineup[outIdx]?.teamId || lineup[inIdx]?.teamId || null;

  const outSlot = lineup[outIdx] || {};
  const inSlot = lineup[inIdx] || {};

  lineup[outIdx] = {
    ...outSlot,
    isSubstitute: false,
    substitutionMinute: minute,
  };
  // Incoming player inherits the vacated pitch slot
  lineup[inIdx] = {
    ...inSlot,
    isSubstitute: false,
    startingMinute: inSlot?.startingMinute ?? minute,
    substitutionMinute: null,
    position: outSlot.position ?? inSlot.position ?? null,
    slotKey: outSlot.slotKey ?? inSlot.slotKey ?? null,
    isGoalkeeper: !!(
      outSlot.isGoalkeeper
      || outSlot.position === "GK"
      || outSlot.slotKey === "GK"
    ),
  };

  sport[lineupField] = lineup;

  if (options.recordSubstitution !== false) {
    sport.substitutions = [
      ...(sport.substitutions || []),
      {
        playerIn: String(playerInId),
        playerOut: String(playerOutId),
        teamId,
        minute,
        period,
        timestamp: options.timestamp || new Date().toISOString(),
      },
    ];
  }

  return true;
};

const applyFootballSubstitution = (sport, event, side) => {
  applyFootballLineupSwap(sport, side, event.playerId, event.relatedPlayerId, {
    minute: event.minute,
    period: event.period,
    teamId: event.teamId,
    timestamp: event.timestamp,
    recordSubstitution: true,
  });
};

const applyFootballEvent = (sport, rawEvent, base) => {
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

  if (SHOT_EVENTS.has(event.eventType) && !event.isShootoutPenalty) {
    incrementStat(ensureMatchBucket(sport, "total_shots"), side);
  }

  switch (event.eventType) {
    case "goal": {
      incrementStat(playerStats, "goals");
      incrementStat(playerStats, "shots");
      incrementStat(playerStats, "shots_on_target");
      playerStats.goal_contributions = Number(playerStats.goals || 0) + Number(playerStats.assists || 0);

      if (event.relatedPlayerId) {
        const assistStats = ensurePlayerStats(sport, {
          playerId: event.relatedPlayerId,
          teamId: event.teamId,
        });
        incrementStat(assistStats, "assists");
        incrementStat(assistStats, "key_passes");
        incrementStat(assistStats, "chances_created");
        assistStats.goal_contributions = Number(assistStats.goals || 0) + Number(assistStats.assists || 0);
      }

      incrementStat(sport.score, side);
      incrementStat(ensureMatchBucket(sport, "shots_on_target"), side);
      break;
    }
    case "own_goal":
      incrementStat(sport.score, oppositeSide);
      break;
    case "assist":
      incrementStat(playerStats, "assists");
      incrementStat(playerStats, "key_passes");
      incrementStat(playerStats, "chances_created");
      playerStats.goal_contributions = Number(playerStats.goals || 0) + Number(playerStats.assists || 0);
      break;
    case "shot_on_target":
      incrementStat(playerStats, "shots");
      incrementStat(playerStats, "shots_on_target");
      incrementStat(ensureMatchBucket(sport, "shots_on_target"), side);
      break;
    case "shot":
    case "shot_off_target":
      incrementStat(playerStats, "shots");
      incrementStat(playerStats, "shots_off_target");
      break;
    case "corner":
      incrementStat(playerStats, "corners");
      incrementStat(ensureMatchBucket(sport, "corners"), side);
      break;
    case "foul":
    case "foul_committed":
      incrementStat(playerStats, "fouls_committed");
      incrementStat(playerStats, "fouls");
      incrementStat(ensureMatchBucket(sport, "fouls"), side);
      break;
    case "yellow_card":
      incrementStat(playerStats, "yellow_cards");
      incrementStat(ensureMatchBucket(sport, "yellow_cards"), side);
      break;
    case "second_yellow":
      incrementStat(playerStats, "yellow_cards");
      incrementStat(playerStats, "red_cards");
      incrementStat(ensureMatchBucket(sport, "yellow_cards"), side);
      incrementStat(ensureMatchBucket(sport, "red_cards"), side);
      break;
    case "red_card":
      incrementStat(playerStats, "red_cards");
      incrementStat(ensureMatchBucket(sport, "red_cards"), side);
      break;
    case "offside":
      incrementStat(playerStats, "offsides");
      incrementStat(ensureMatchBucket(sport, "offsides"), side);
      break;
    case "penalty_scored": {
      if (event.isShootoutPenalty) {
        const result = ensureResult(sport);
        result.is_penalties = true;
        incrementStat(result.penalties_score, side);
        break;
      }
      incrementStat(playerStats, "penalties");
      incrementStat(playerStats, "penalties_scored");
      incrementStat(playerStats, "goals");
      incrementStat(playerStats, "shots");
      incrementStat(playerStats, "shots_on_target");
      incrementStat(sport.score, side);
      break;
    }
    case "penalty_missed": {
      if (event.isShootoutPenalty) {
        const result = ensureResult(sport);
        result.is_penalties = true;
        break;
      }
      incrementStat(playerStats, "penalties");
      incrementStat(playerStats, "penalties_missed");
      incrementStat(playerStats, "shots");
      break;
    }
    case "save":
    case "gk_save":
      incrementStat(playerStats, "saves");
      break;
    case "free_kick":
      incrementStat(playerStats, "free_kicks");
      break;
    case "tackle":
    case "tackle_won":
      incrementStat(playerStats, "tackles");
      incrementStat(playerStats, "tackles_won");
      break;
    case "interception":
      incrementStat(playerStats, "interceptions");
      break;
    case "clearance":
      incrementStat(playerStats, "clearances");
      break;
    case "block":
      incrementStat(playerStats, "blocks");
      break;
    case "substitution":
      applyFootballSubstitution(sport, event, side);
      break;
    default:
      break;
  }

  updateMatchClock(sport, event);
  sport.events = [...(sport.events || []), event];
};

export const applyOptimisticFootballUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;

  const nextGame = {
    ...prev,
    sport: cloneFootballSport(prev.sport),
  };
  applyFootballEvent(nextGame.sport, eventPayload, prev.base);
  return nextGame;
};

const isSecondYellowRedCard = (event) =>
  event?.eventType === "red_card"
  && (event?.reason === "second_yellow" || event?.isSecondYellow === true);

const isLinkedSecondYellow = (event, redEvent) =>
  event?.eventType === "yellow_card"
  && (event?.secondYellow === true || event?.isSecondYellow === true)
  && String(event?.playerId) === String(redEvent?.playerId)
  && String(event?.teamId) === String(redEvent?.teamId);

const applySingleFootballUndo = (prev, options = {}) => {
  if (!prev?.sport || !prev?.base) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const teamSide = options?.teamSide || null;
  const nextGame = {
    ...prev,
    sport: cloneFootballSport(prev.sport),
  };
  const events = [...(nextGame.sport.events || [])];
  let removedIndex = -1;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.eventType === "undo") continue;
    if (!teamSide || getEventSide(event, nextGame.base) === teamSide) {
      removedIndex = index;
    }
    break;
  }

  if (removedIndex < 0) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const [removedEvent] = events.splice(removedIndex, 1);
  nextGame.sport.events = events;

  const side = getEventSide(removedEvent, nextGame.base);
  const oppositeSide = side === "home" ? "away" : "home";
  const playerStats = (nextGame.sport.playerStats || []).find(
    (entry) => String(entry?.playerId) === String(removedEvent.playerId) && String(entry?.teamId) === String(removedEvent.teamId),
  );
  const relatedStats = removedEvent.relatedPlayerId
    ? (nextGame.sport.playerStats || []).find(
        (entry) => String(entry?.playerId) === String(removedEvent.relatedPlayerId) && String(entry?.teamId) === String(removedEvent.teamId),
      )
    : null;

  switch (removedEvent.eventType) {
    case "goal":
      decrementStat(playerStats, "goals");
      decrementStat(playerStats, "shots");
      decrementStat(playerStats, "shots_on_target");
      if (playerStats) {
        playerStats.goal_contributions = Number(playerStats.goals || 0) + Number(playerStats.assists || 0);
      }
      decrementStat(relatedStats, "assists");
      decrementStat(relatedStats, "key_passes");
      decrementStat(relatedStats, "chances_created");
      if (relatedStats) {
        relatedStats.goal_contributions = Number(relatedStats.goals || 0) + Number(relatedStats.assists || 0);
      }
      decrementStat(nextGame.sport.score, side);
      decrementStat(ensureMatchBucket(nextGame.sport, "total_shots"), side);
      decrementStat(ensureMatchBucket(nextGame.sport, "shots_on_target"), side);
      break;
    case "own_goal":
      decrementStat(nextGame.sport.score, oppositeSide);
      break;
    case "shot_on_target":
      decrementStat(playerStats, "shots");
      decrementStat(playerStats, "shots_on_target");
      decrementStat(ensureMatchBucket(nextGame.sport, "total_shots"), side);
      decrementStat(ensureMatchBucket(nextGame.sport, "shots_on_target"), side);
      break;
    case "shot":
    case "shot_off_target":
      decrementStat(playerStats, "shots");
      decrementStat(playerStats, "shots_off_target");
      decrementStat(ensureMatchBucket(nextGame.sport, "total_shots"), side);
      break;
    case "corner":
      decrementStat(playerStats, "corners");
      decrementStat(ensureMatchBucket(nextGame.sport, "corners"), side);
      break;
    case "foul":
    case "foul_committed":
      decrementStat(playerStats, "fouls_committed");
      decrementStat(playerStats, "fouls");
      decrementStat(ensureMatchBucket(nextGame.sport, "fouls"), side);
      break;
    case "yellow_card":
      decrementStat(playerStats, "yellow_cards");
      decrementStat(ensureMatchBucket(nextGame.sport, "yellow_cards"), side);
      break;
    case "second_yellow":
      decrementStat(playerStats, "yellow_cards");
      decrementStat(playerStats, "red_cards");
      decrementStat(ensureMatchBucket(nextGame.sport, "yellow_cards"), side);
      decrementStat(ensureMatchBucket(nextGame.sport, "red_cards"), side);
      break;
    case "red_card":
      decrementStat(playerStats, "red_cards");
      decrementStat(ensureMatchBucket(nextGame.sport, "red_cards"), side);
      break;
    case "offside":
      decrementStat(playerStats, "offsides");
      decrementStat(ensureMatchBucket(nextGame.sport, "offsides"), side);
      break;
    case "penalty_scored":
      if (removedEvent.isShootoutPenalty) {
        decrementStat(ensureResult(nextGame.sport).penalties_score, side);
        break;
      }
      decrementStat(playerStats, "penalties");
      decrementStat(playerStats, "penalties_scored");
      decrementStat(playerStats, "goals");
      decrementStat(playerStats, "shots");
      decrementStat(playerStats, "shots_on_target");
      decrementStat(nextGame.sport.score, side);
      decrementStat(ensureMatchBucket(nextGame.sport, "total_shots"), side);
      decrementStat(ensureMatchBucket(nextGame.sport, "shots_on_target"), side);
      break;
    case "penalty_missed":
      if (removedEvent.isShootoutPenalty) {
        break;
      }
      decrementStat(playerStats, "penalties");
      decrementStat(playerStats, "penalties_missed");
      decrementStat(playerStats, "shots");
      decrementStat(ensureMatchBucket(nextGame.sport, "total_shots"), side);
      break;
    case "save":
    case "gk_save":
      decrementStat(playerStats, "saves");
      break;
    case "free_kick":
      decrementStat(playerStats, "free_kicks");
      break;
    case "substitution": {
      if (Array.isArray(nextGame.sport.substitutions) && nextGame.sport.substitutions.length > 0) {
        nextGame.sport.substitutions = nextGame.sport.substitutions.slice(0, -1);
      }
      const lineupField = side === "home" ? "homeLineup" : "awayLineup";
      const lineup = cloneLineup(nextGame.sport[lineupField]);
      const outIdx = lineup.findIndex((player) => String(player?.playerId) === String(removedEvent.playerId));
      const inIdx = lineup.findIndex((player) => String(player?.playerId) === String(removedEvent.relatedPlayerId));
      if (outIdx !== -1) {
        lineup[outIdx] = {
          ...lineup[outIdx],
          isSubstitute: false,
          substitutionMinute: null,
        };
      }
      if (inIdx !== -1) {
        lineup[inIdx] = {
          ...lineup[inIdx],
          isSubstitute: true,
          substitutionMinute: null,
        };
      }
      nextGame.sport[lineupField] = lineup;
      break;
    }
    default:
      break;
  }

  const previousEvent = nextGame.sport.events[nextGame.sport.events.length - 1];
  nextGame.sport.currentMinute = Number(previousEvent?.minute ?? 0);
  nextGame.sport.currentSecond = Number(previousEvent?.second ?? 0);
  nextGame.sport.currentPeriod = Number(previousEvent?.period ?? 1);
  if (!nextGame.sport.events.length) {
    nextGame.sport.matchStatus = "scheduled";
  }

  return {
    nextGame,
    removedEvent,
    removedIndex,
  };
};

export const applyOptimisticFootballUndo = (prev, options = {}) => {
  const firstUndo = applySingleFootballUndo(prev, options);
  if (!firstUndo?.removedEvent) {
    return firstUndo;
  }

  if (!isSecondYellowRedCard(firstUndo.removedEvent)) {
    return firstUndo;
  }

  const secondUndo = applySingleFootballUndo(firstUndo.nextGame, options);
  if (!secondUndo?.removedEvent || !isLinkedSecondYellow(secondUndo.removedEvent, firstUndo.removedEvent)) {
    return firstUndo;
  }

  return {
    nextGame: secondUndo.nextGame,
    removedEvent: firstUndo.removedEvent,
    removedIndex: firstUndo.removedIndex,
    cascadeRemovedEvent: secondUndo.removedEvent,
  };
};