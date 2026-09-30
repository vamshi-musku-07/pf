const SIDE_FIELDS = [
  "score",
  "shots",
  "faceoffs",
  "hits",
  "blockedShots",
  "takeaways",
  "giveaways",
  "penaltyMinutes",
];

const GOAL_TYPES = ["even_strength", "power_play", "short_handed", "empty_net"];
const FULL_STRENGTH_SKATERS = 5;
const MIN_STRENGTH_SKATERS = 3;
const PERIOD_SECONDS = 20 * 60;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const oppositeSide = (side) => (side === "home" ? "away" : "home");

const normalizeSideBucket = (bucket = {}) => ({
  home: toNumber(bucket?.home),
  away: toNumber(bucket?.away),
});

const normalizePowerPlays = (powerPlays = {}) => ({
  home: {
    opportunities: toNumber(powerPlays?.home?.opportunities),
    goals: toNumber(powerPlays?.home?.goals),
  },
  away: {
    opportunities: toNumber(powerPlays?.away?.opportunities),
    goals: toNumber(powerPlays?.away?.goals),
  },
});

const normalizeGoalTypes = (goalTypes = {}) => ({
  home: GOAL_TYPES.reduce((acc, type) => ({ ...acc, [type]: toNumber(goalTypes?.home?.[type]) }), {}),
  away: GOAL_TYPES.reduce((acc, type) => ({ ...acc, [type]: toNumber(goalTypes?.away?.[type]) }), {}),
});

const normalizeOnIceSide = (side = {}) => ({
  rosterPlayerIds: Array.isArray(side?.rosterPlayerIds) ? [...side.rosterPlayerIds].filter(Boolean).map(String) : [],
  skaterIds: Array.isArray(side?.skaterIds) ? [...side.skaterIds].filter(Boolean).map(String) : [],
  goalieId: side?.goalieId ? String(side.goalieId) : null,
  goaliePulled: !!side?.goaliePulled,
  tooManyPlayers: !!side?.tooManyPlayers,
});

const normalizeOnIce = (onIce = {}) => ({
  home: normalizeOnIceSide(onIce?.home),
  away: normalizeOnIceSide(onIce?.away),
});

const getClockSeconds = (gameTime) => {
  if (typeof gameTime === "string") {
    const [minutes = "0", seconds = "0"] = gameTime.split(":");
    return Math.max(0, toNumber(minutes) * 60 + toNumber(seconds));
  }
  return Math.max(0, toNumber(gameTime?.minutes, 20) * 60 + toNumber(gameTime?.seconds));
};

const getElapsedSeconds = (period = 1, gameTime = "20:00") =>
  ((Math.max(1, toNumber(period, 1)) - 1) * PERIOD_SECONDS) + (PERIOD_SECONDS - getClockSeconds(gameTime));

const updateStrength = (sport) => {
  const activePenalties = (sport.activePenalties || []).filter((penalty) => penalty?.isActive && penalty.affectsStrength !== false);
  const homePenalties = activePenalties.filter((penalty) => penalty.teamSide === "home").length;
  const awayPenalties = activePenalties.filter((penalty) => penalty.teamSide === "away").length;
  const home = Math.max(MIN_STRENGTH_SKATERS, FULL_STRENGTH_SKATERS - homePenalties);
  const away = Math.max(MIN_STRENGTH_SKATERS, FULL_STRENGTH_SKATERS - awayPenalties);

  sport.strength = {
    home: { skaters: home },
    away: { skaters: away },
    label: `${home}v${away}`,
  };
};

const ensureIceHockeySport = (sport = {}) => {
  const next = { ...sport };
  SIDE_FIELDS.forEach((field) => {
    next[field] = normalizeSideBucket(next[field]);
  });
  next.powerPlays = normalizePowerPlays(next.powerPlays);
  next.goalTypes = normalizeGoalTypes(next.goalTypes);
  next.periodScores = Array.isArray(next.periodScores) ? [...next.periodScores] : [];
  next.events = Array.isArray(next.events) ? [...next.events] : [];
  next.activePenalties = Array.isArray(next.activePenalties) ? [...next.activePenalties] : [];
  next.onIce = normalizeOnIce(next.onIce);
  return next;
};

const incrementSideField = (sport, field, side, amount) => {
  sport[field] = normalizeSideBucket(sport[field]);
  sport[field][side] = Math.max(0, toNumber(sport[field][side]) + amount);
};

const incrementPowerPlay = (sport, side, field, amount) => {
  sport.powerPlays = normalizePowerPlays(sport.powerPlays);
  sport.powerPlays[side][field] = Math.max(0, toNumber(sport.powerPlays[side][field]) + amount);
};

const incrementGoalType = (sport, side, goalType, amount) => {
  const normalizedType = GOAL_TYPES.includes(goalType) ? goalType : "even_strength";
  sport.goalTypes = normalizeGoalTypes(sport.goalTypes);
  sport.goalTypes[side][normalizedType] = Math.max(0, toNumber(sport.goalTypes[side][normalizedType]) + amount);
};

const incrementPeriodScore = (sport, side, period, amount) => {
  const normalizedPeriod = Math.max(1, toNumber(period, sport.currentPeriod || 1));
  const index = sport.periodScores.findIndex((entry) => Number(entry?.period) === normalizedPeriod);
  const entry = index >= 0
    ? { ...sport.periodScores[index] }
    : { period: normalizedPeriod, home: 0, away: 0 };

  entry.home = toNumber(entry.home);
  entry.away = toNumber(entry.away);
  entry[side] = Math.max(0, toNumber(entry[side]) + amount);

  if (index >= 0) {
    sport.periodScores[index] = entry;
  } else if (amount > 0) {
    sport.periodScores.push(entry);
  }

  if (amount < 0) {
    sport.periodScores = sport.periodScores.filter((periodEntry) => toNumber(periodEntry.home) > 0 || toNumber(periodEntry.away) > 0);
  }
};

const applyLineChange = (sport, side, event) => {
  const currentSide = normalizeOnIceSide(sport.onIce?.[side]);
  let nextSkaters = [...currentSide.skaterIds];
  const outPlayerId = event.outPlayerId ? String(event.outPlayerId) : null;
  const inPlayerId = event.inPlayerId ? String(event.inPlayerId) : null;
  const nextGoalieId = event.goalieId ? String(event.goalieId) : currentSide.goalieId;

  if (outPlayerId) {
    nextSkaters = nextSkaters.filter((playerId) => playerId !== outPlayerId);
  }
  if (inPlayerId && !nextSkaters.includes(inPlayerId) && inPlayerId !== nextGoalieId) {
    nextSkaters.push(inPlayerId);
  }

  sport.onIce[side] = {
    ...currentSide,
    goalieId: nextGoalieId,
    skaterIds: nextSkaters.filter((playerId) => playerId !== nextGoalieId),
  };
};

const applyGoaliePulled = (sport, side) => {
  sport.onIce[side] = {
    ...normalizeOnIceSide(sport.onIce?.[side]),
    goaliePulled: true,
  };
};

const applyGoalieReturn = (sport, side, event) => {
  const currentSide = normalizeOnIceSide(sport.onIce?.[side]);
  const outPlayerId = event.outPlayerId ? String(event.outPlayerId) : null;
  sport.onIce[side] = {
    ...currentSide,
    goaliePulled: false,
    skaterIds: outPlayerId
      ? currentSide.skaterIds.filter((playerId) => playerId !== outPlayerId)
      : currentSide.skaterIds,
  };
};

const createOptimisticPenalty = (event, sport) => {
  const period = Math.max(1, toNumber(event.period, sport.currentPeriod || 1));
  const durationMinutes = Math.max(1, toNumber(event.penaltyDuration, 2));
  const durationSeconds = durationMinutes * 60;
  const gameTime = event.gameTime || sport.periodTime || "20:00";
  const elapsedSeconds = getElapsedSeconds(period, gameTime);

  return {
    penaltyId: event._optimisticId || event.penaltyId || `optimistic-${Date.now()}`,
    playerId: event.playerId || null,
    playerName: event.playerName || null,
    teamId: event.teamId || null,
    teamSide: event.teamSide,
    penaltyType: event.penaltyType || "Minor",
    durationMinutes,
    durationSeconds,
    remainingSeconds: durationSeconds,
    releasableSegments: durationMinutes <= 4 ? Math.max(1, Math.ceil(durationMinutes / 2)) : 0,
    isReleasable: durationMinutes <= 4,
    affectsStrength: !String(event.penaltyType || "").toLowerCase().includes("misconduct"),
    startedPeriod: period,
    startedClockSeconds: getClockSeconds(gameTime),
    startedElapsedSeconds: elapsedSeconds,
    lastUpdatedPeriod: period,
    lastUpdatedClockSeconds: getClockSeconds(gameTime),
    lastUpdatedElapsedSeconds: elapsedSeconds,
    expiresAtElapsedSeconds: elapsedSeconds + durationSeconds,
    isActive: true,
    penaltyStartedAt: new Date().toISOString(),
    _optimisticId: event._optimisticId,
  };
};

const appendOptimisticEvent = (sport, event) => {
  sport.events = [
    ...sport.events,
    {
      ...event,
      _id: event._optimisticId,
      optimistic: true,
      timestamp: event.timestamp || new Date().toISOString(),
    },
  ];
};

const removeOptimisticEvent = (sport, optimisticId) => {
  if (!optimisticId) return;
  sport.events = (sport.events || []).filter((event) => event?._optimisticId !== optimisticId && event?._id !== optimisticId);
};

export const applyOptimisticIceHockeyUpdate = (prev, event) => {
  if (!prev?.sport || !event?.eventType || !event?.teamSide) return prev;

  const side = event.teamSide;
  const next = {
    ...prev,
    sport: ensureIceHockeySport(prev.sport),
  };
  const sport = next.sport;

  sport.currentPeriod = Math.max(1, toNumber(event.period, sport.currentPeriod || 1));
  sport.periodTime = event.gameTime || sport.periodTime || "20:00";

  switch (event.eventType) {
    case "goal":
      incrementSideField(sport, "score", side, 1);
      incrementSideField(sport, "shots", side, 1);
      incrementGoalType(sport, side, event.goalType || "even_strength", 1);
      if (event.goalType === "power_play") incrementPowerPlay(sport, side, "goals", 1);
      incrementPeriodScore(sport, side, sport.currentPeriod, 1);
      break;
    case "shot_on_goal":
      incrementSideField(sport, "shots", side, 1);
      break;
    case "blocked_shot":
      incrementSideField(sport, "blockedShots", side, 1);
      break;
    case "faceoff_won":
      incrementSideField(sport, "faceoffs", side, 1);
      break;
    case "hit":
      incrementSideField(sport, "hits", side, 1);
      break;
    case "takeaway":
      incrementSideField(sport, "takeaways", side, 1);
      break;
    case "giveaway":
      incrementSideField(sport, "giveaways", side, 1);
      break;
    case "penalty": {
      const penaltyDuration = Math.max(1, toNumber(event.penaltyDuration, 2));
      incrementSideField(sport, "penaltyMinutes", side, penaltyDuration);
      const penalty = createOptimisticPenalty(event, sport);
      sport.activePenalties = [...sport.activePenalties, penalty];
      if (penalty.affectsStrength) incrementPowerPlay(sport, oppositeSide(side), "opportunities", 1);
      if (event.playerId) {
        sport.onIce[side] = {
          ...normalizeOnIceSide(sport.onIce?.[side]),
          skaterIds: normalizeOnIceSide(sport.onIce?.[side]).skaterIds.filter((playerId) => playerId !== String(event.playerId)),
        };
      }
      updateStrength(sport);
      break;
    }
    case "line_change":
      applyLineChange(sport, side, event);
      break;
    case "goalie_pulled":
      applyGoaliePulled(sport, side);
      break;
    case "goalie_return":
      applyGoalieReturn(sport, side, event);
      break;
    case "period_break": {
      const currentPeriod = sport.currentPeriod || 1;
      sport.currentPeriod = currentPeriod < 5 ? currentPeriod + 1 : currentPeriod;
      sport.periodTime = sport.currentPeriod >= 5 ? "00:00" : "20:00";
      sport.isOvertime = sport.currentPeriod === 4 || !!sport.isOvertime;
      sport.isShootout = sport.currentPeriod >= 5 || !!sport.isShootout;
      break;
    }
    default:
      break;
  }

  appendOptimisticEvent(sport, event);
  return next;
};

export const rollbackOptimisticIceHockeyUpdate = (prev, event) => {
  if (!prev?.sport || !event?.eventType || !event?.teamSide) return prev;

  const side = event.teamSide;
  const next = {
    ...prev,
    sport: ensureIceHockeySport(prev.sport),
  };
  const sport = next.sport;

  switch (event.eventType) {
    case "goal":
      incrementSideField(sport, "score", side, -1);
      incrementSideField(sport, "shots", side, -1);
      incrementGoalType(sport, side, event.goalType || "even_strength", -1);
      if (event.goalType === "power_play") incrementPowerPlay(sport, side, "goals", -1);
      incrementPeriodScore(sport, side, event.period || sport.currentPeriod || 1, -1);
      break;
    case "shot_on_goal":
      incrementSideField(sport, "shots", side, -1);
      break;
    case "blocked_shot":
      incrementSideField(sport, "blockedShots", side, -1);
      break;
    case "faceoff_won":
      incrementSideField(sport, "faceoffs", side, -1);
      break;
    case "hit":
      incrementSideField(sport, "hits", side, -1);
      break;
    case "takeaway":
      incrementSideField(sport, "takeaways", side, -1);
      break;
    case "giveaway":
      incrementSideField(sport, "giveaways", side, -1);
      break;
    case "penalty": {
      const penaltyDuration = Math.max(1, toNumber(event.penaltyDuration, 2));
      incrementSideField(sport, "penaltyMinutes", side, -penaltyDuration);
      const removedPenalty = (sport.activePenalties || []).find(
        (penalty) => penalty?._optimisticId === event._optimisticId || penalty?.penaltyId === event._optimisticId,
      );
      sport.activePenalties = (sport.activePenalties || []).filter(
        (penalty) => penalty?._optimisticId !== event._optimisticId && penalty?.penaltyId !== event._optimisticId,
      );
      if (removedPenalty?.affectsStrength) incrementPowerPlay(sport, oppositeSide(side), "opportunities", -1);
      updateStrength(sport);
      break;
    }
    case "line_change":
    case "goalie_pulled":
    case "goalie_return":
      if (event._previousOnIce) sport.onIce = normalizeOnIce(event._previousOnIce);
      break;
    case "period_break":
      if (event._previousPeriodState) {
        sport.currentPeriod = event._previousPeriodState.currentPeriod;
        sport.periodTime = event._previousPeriodState.periodTime;
        sport.isOvertime = event._previousPeriodState.isOvertime;
        sport.isShootout = event._previousPeriodState.isShootout;
        sport.matchStatus = event._previousPeriodState.matchStatus;
        sport.result = event._previousPeriodState.result;
      }
      break;
    default:
      break;
  }

  removeOptimisticEvent(sport, event._optimisticId);
  return next;
};
