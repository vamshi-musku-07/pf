const DEFAULT_HOCKEY_MATCH_FORMAT = {
  structureType: "quarters",
  periodCount: 4,
  periodDurationMinutes: 15,
  label: null,
};

const HOCKEY_QUARTER_SECONDS = 15 * 60;
const MAX_ON_FIELD_PLAYERS = 11;

const CARD_DURATIONS = {
  green_card: 2 * 60,
  yellow_card: 5 * 60,
  red_card: null,
};

const toId = (value) => (value == null ? null : String(value));

const uniqueIds = (values = []) => Array.from(new Set((values || []).filter(Boolean).map((value) => String(value))));

const cloneSideBucket = (bucket = {}) => ({
  home: Number(bucket?.home || 0),
  away: Number(bucket?.away || 0),
});

const createEmptyCards = () => ({
  home: { green: 0, yellow: 0, red: 0 },
  away: { green: 0, yellow: 0, red: 0 },
});

const createEmptyLineups = () => ({
  home: { onFieldPlayerIds: [], benchPlayerIds: [] },
  away: { onFieldPlayerIds: [], benchPlayerIds: [] },
});

const createHockeyPlayerStats = (event = {}) => ({
  playerId: event.playerId,
  teamId: event.teamId,
  goals: 0,
  penaltyCorners: 0,
  penaltyStrokes: 0,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
  substitutions: 0,
  fouls: 0,
  freeHits: 0,
  saves: 0,
  shotsMissed: 0,
  longCorners: 0,
  sixteenYardHits: 0,
  minutesPlayed: 0,
});

const cloneHockeyPlayerStats = (stats = {}) => ({
  ...createHockeyPlayerStats(stats),
  ...stats,
  playerId: stats?.playerId ?? null,
  teamId: stats?.teamId ?? null,
});

const normalizeHockeyMatchFormat = (matchFormat) => {
  if (!matchFormat) return { ...DEFAULT_HOCKEY_MATCH_FORMAT };

  if (typeof matchFormat === "string") {
    const normalized = matchFormat.toLowerCase();
    if (normalized === "halves_35" || normalized === "2_halves") {
      return { structureType: "halves", periodCount: 2, periodDurationMinutes: 35, label: "2 halves" };
    }
    if (normalized === "quarters_15" || normalized === "4_quarters") {
      return { ...DEFAULT_HOCKEY_MATCH_FORMAT, label: "4 quarters" };
    }
    return { ...DEFAULT_HOCKEY_MATCH_FORMAT, label: matchFormat };
  }

  const structureType = matchFormat.structureType === "halves" ? "halves" : "quarters";
  const defaultCount = structureType === "halves" ? 2 : 4;
  const periodCount = Math.max(1, Number(matchFormat.periodCount) || defaultCount);
  const periodDurationMinutes = Math.max(1, Number(matchFormat.periodDurationMinutes) || 15);

  return {
    structureType,
    periodCount,
    periodDurationMinutes,
    label: matchFormat.label || null,
  };
};

const getHockeyPeriodDurationSeconds = (sport = {}) => {
  const matchFormat = normalizeHockeyMatchFormat(sport?.matchFormat);
  return Math.max(60, matchFormat.periodDurationMinutes * 60);
};

const getDefaultClockForFormat = (sport = {}) => {
  const durationSeconds = getHockeyPeriodDurationSeconds(sport);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const parseClockSeconds = (gameTime, fallbackSeconds = HOCKEY_QUARTER_SECONDS) => {
  if (typeof gameTime === "string") {
    const [minutesText = "0", secondsText = "0"] = gameTime.split(":");
    const minutes = Number.parseInt(minutesText, 10);
    const seconds = Number.parseInt(secondsText, 10);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.max(0, minutes * 60 + seconds);
    }
  }

  if (gameTime && typeof gameTime === "object") {
    const minutes = Number(gameTime.minutes);
    const seconds = Number(gameTime.seconds);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.max(0, minutes * 60 + seconds);
    }
  }

  return fallbackSeconds;
};

const formatClock = (gameTime, fallbackSeconds = HOCKEY_QUARTER_SECONDS) => {
  const totalSeconds = parseClockSeconds(gameTime, fallbackSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getElapsedSeconds = (quarter, gameTime, periodDurationSeconds = HOCKEY_QUARTER_SECONDS) => {
  const normalizedQuarter = Math.max(1, Number(quarter) || 1);
  const remainingSeconds = parseClockSeconds(gameTime, periodDurationSeconds);
  return ((normalizedQuarter - 1) * periodDurationSeconds) + (periodDurationSeconds - remainingSeconds);
};

const cloneEvent = (event = {}) => ({
  ...event,
  rosterSnapshot: event?.rosterSnapshot
    ? {
        homePlayerIds: uniqueIds(event.rosterSnapshot.homePlayerIds),
        awayPlayerIds: uniqueIds(event.rosterSnapshot.awayPlayerIds),
      }
    : undefined,
});

const cloneHockeySport = (sport = {}) => ({
  ...sport,
  matchFormat: normalizeHockeyMatchFormat(sport?.matchFormat),
  score: cloneSideBucket(sport?.score),
  currentQuarter: Number(sport?.currentQuarter || sport?.currentPeriod || 1),
  currentPeriod: Number(sport?.currentPeriod || sport?.currentQuarter || 1),
  quarterTime: sport?.quarterTime || sport?.periodTime || getDefaultClockForFormat(sport),
  periodTime: sport?.periodTime || sport?.quarterTime || getDefaultClockForFormat(sport),
  isOvertime: !!sport?.isOvertime,
  quarterScores: {
    home: Array.isArray(sport?.quarterScores?.home) ? sport.quarterScores.home.map((entry) => ({ quarter: Number(entry?.quarter || 0), goals: Number(entry?.goals || 0) })) : [],
    away: Array.isArray(sport?.quarterScores?.away) ? sport.quarterScores.away.map((entry) => ({ quarter: Number(entry?.quarter || 0), goals: Number(entry?.goals || 0) })) : [],
  },
  cards: {
    home: {
      green: Number(sport?.cards?.home?.green || 0),
      yellow: Number(sport?.cards?.home?.yellow || 0),
      red: Number(sport?.cards?.home?.red || 0),
    },
    away: {
      green: Number(sport?.cards?.away?.green || 0),
      yellow: Number(sport?.cards?.away?.yellow || 0),
      red: Number(sport?.cards?.away?.red || 0),
    },
  },
  penaltyCorners: cloneSideBucket(sport?.penaltyCorners),
  penaltyStrokes: cloneSideBucket(sport?.penaltyStrokes),
  possession: sport?.possession || "neutral",
  lineups: {
    home: {
      onFieldPlayerIds: uniqueIds(sport?.lineups?.home?.onFieldPlayerIds),
      benchPlayerIds: uniqueIds(sport?.lineups?.home?.benchPlayerIds),
    },
    away: {
      onFieldPlayerIds: uniqueIds(sport?.lineups?.away?.onFieldPlayerIds),
      benchPlayerIds: uniqueIds(sport?.lineups?.away?.benchPlayerIds),
    },
  },
  activeSuspensions: Array.isArray(sport?.activeSuspensions) ? sport.activeSuspensions.map((suspension) => ({ ...suspension })) : [],
  events: Array.isArray(sport?.events) ? sport.events.filter(Boolean).map(cloneEvent) : [],
  playerStats: Array.isArray(sport?.playerStats) ? sport.playerStats.map(cloneHockeyPlayerStats) : [],
  result: sport?.result || null,
});

const createReplaySport = (sport = {}, savedLineups = null) => {
  const nextSport = cloneHockeySport(sport);
  const defaultClock = getDefaultClockForFormat(nextSport);

  nextSport.score = { home: 0, away: 0 };
  nextSport.currentQuarter = 1;
  nextSport.currentPeriod = 1;
  nextSport.quarterTime = defaultClock;
  nextSport.periodTime = defaultClock;
  nextSport.isOvertime = false;
  nextSport.quarterScores = { home: [], away: [] };
  nextSport.cards = createEmptyCards();
  nextSport.penaltyCorners = { home: 0, away: 0 };
  nextSport.penaltyStrokes = { home: 0, away: 0 };
  nextSport.possession = "neutral";
  // savedLineups: the server-committed lineup is NOT stored in the events array —
  // it is persisted separately via updateHockeyLineupAPI. Passing it here lets
  // replays start from the correct on-field/bench split instead of an empty
  // slate, which would falsely trigger the lineup-setup modal after an undo.
  nextSport.lineups = savedLineups
    ? {
        home: { onFieldPlayerIds: uniqueIds(savedLineups.home?.onFieldPlayerIds || []), benchPlayerIds: uniqueIds(savedLineups.home?.benchPlayerIds || []) },
        away: { onFieldPlayerIds: uniqueIds(savedLineups.away?.onFieldPlayerIds || []), benchPlayerIds: uniqueIds(savedLineups.away?.benchPlayerIds || []) },
      }
    : createEmptyLineups();
  nextSport.activeSuspensions = [];
  nextSport.result = null;
  nextSport.playerStats = [];
  nextSport.events = [];

  return nextSport;
};

const getTeamSide = (baseGame, teamId) =>
  String(teamId) === String(baseGame?.teamId) ? "home" : "away";

const createRosterSnapshot = (event = {}) => ({
  homePlayerIds: uniqueIds(event?.rosterSnapshot?.homePlayerIds),
  awayPlayerIds: uniqueIds(event?.rosterSnapshot?.awayPlayerIds),
});

const getEventTeamSide = (event, baseGame) => {
  if (event?.teamSide === "home" || event?.teamSide === "away") {
    return event.teamSide;
  }

  const normalizedTeamId = toId(event?.teamId);
  if (!normalizedTeamId) return null;
  if (normalizedTeamId === toId(baseGame?.teamId)) return "home";
  if (normalizedTeamId === toId(baseGame?.opponentTeamId)) return "away";
  return null;
};

const mergeRosterIntoLineups = (sport, rosterSnapshot) => {
  [["home", uniqueIds(rosterSnapshot?.homePlayerIds)], ["away", uniqueIds(rosterSnapshot?.awayPlayerIds)]].forEach(([side, sideRoster]) => {
    if (!sideRoster.length) return;

    const lineup = sport.lineups?.[side] || { onFieldPlayerIds: [], benchPlayerIds: [] };
    const onFieldPlayerIds = uniqueIds(lineup.onFieldPlayerIds);
    const benchPlayerIds = uniqueIds(lineup.benchPlayerIds);
    const knownIds = new Set([...onFieldPlayerIds, ...benchPlayerIds]);

    if (!onFieldPlayerIds.length && !benchPlayerIds.length) {
      lineup.onFieldPlayerIds = sideRoster.slice(0, MAX_ON_FIELD_PLAYERS);
      lineup.benchPlayerIds = sideRoster.slice(MAX_ON_FIELD_PLAYERS);
      sport.lineups[side] = lineup;
      return;
    }

    sideRoster.forEach((playerId) => {
      if (!knownIds.has(playerId)) benchPlayerIds.push(playerId);
    });

    lineup.onFieldPlayerIds = onFieldPlayerIds;
    lineup.benchPlayerIds = uniqueIds(benchPlayerIds.filter((playerId) => !onFieldPlayerIds.includes(playerId)));
    sport.lineups[side] = lineup;
  });
};

const findOrCreatePlayerStats = (sport, event = {}) => {
  if (!event?.playerId) return null;

  let playerStats = sport.playerStats.find(
    (stat) => toId(stat.playerId) === toId(event.playerId) && toId(stat.teamId) === toId(event.teamId),
  );

  if (!playerStats) {
    playerStats = createHockeyPlayerStats(event);
    sport.playerStats.push(playerStats);
  }

  return playerStats;
};

const getPlayerStats = (sport, playerId, teamId) =>
  sport.playerStats.find(
    (stat) => toId(stat.playerId) === toId(playerId) && toId(stat.teamId) === toId(teamId),
  ) || null;

const removeFromArray = (values = [], playerId) => values.filter((value) => toId(value) !== toId(playerId));

const createSuspensionKey = (event, context) => {
  const teamId = toId(event?.teamId) || "team";
  const playerId = toId(event?.playerId) || "player";
  const cardType = String(event?.eventType || "card");
  const quarter = Number(context?.quarter || 1);
  const elapsedSeconds = Number(context?.elapsedSeconds || 0);
  const clockSeconds = Number(parseClockSeconds(context?.gameTime) || 0);
  const optimisticOrTimestamp = event?._optimisticId || event?.timestamp || "live";

  return [cardType, teamId, playerId, quarter, elapsedSeconds, clockSeconds, optimisticOrTimestamp].join(":");
};

const hasActiveSuspension = (sport, playerId) =>
  sport.activeSuspensions.some(
    (suspension) => suspension.isActive && toId(suspension.playerId) === toId(playerId),
  );

const syncSuspensions = (sport, currentQuarter, currentGameTime) => {
  const nowMs = Date.now();
  const currentElapsedSeconds = getElapsedSeconds(currentQuarter, currentGameTime, getHockeyPeriodDurationSeconds(sport));
  const currentClockSeconds = parseClockSeconds(currentGameTime, getHockeyPeriodDurationSeconds(sport));

  sport.activeSuspensions.forEach((suspension) => {
    if (!suspension?.isActive || suspension.isPermanent || suspension.expiresAtElapsedSeconds == null) return;

    // Prefer wall-clock expiry when suspensionStartedAt is available
    if (suspension.suspensionStartedAt && suspension.durationSeconds != null) {
      const startMs = new Date(suspension.suspensionStartedAt).getTime();
      if (Number.isFinite(startMs) && Math.floor((nowMs - startMs) / 1000) < suspension.durationSeconds) return;
    } else {
      if (currentElapsedSeconds < suspension.expiresAtElapsedSeconds) return;
    }

    suspension.isActive = false;
    suspension.releasedQuarter = currentQuarter;
    suspension.releasedClockSeconds = currentClockSeconds;
    suspension.releasedElapsedSeconds = currentElapsedSeconds;
    suspension.returnedToBench = true;

    const lineup = sport.lineups?.[suspension.teamSide];
    if (!lineup) return;

    const playerId = toId(suspension.playerId);
    const onFieldPlayerIds = uniqueIds(lineup.onFieldPlayerIds);
    const benchPlayerIds = uniqueIds(lineup.benchPlayerIds);

    if (!onFieldPlayerIds.includes(playerId) && !benchPlayerIds.includes(playerId)) {
      benchPlayerIds.push(playerId);
    }

    lineup.onFieldPlayerIds = onFieldPlayerIds;
    lineup.benchPlayerIds = uniqueIds(benchPlayerIds.filter((entry) => !onFieldPlayerIds.includes(entry)));
  });
};

const getAllowedOnFieldCount = (sport, teamSide) => {
  const activePenaltyCount = sport.activeSuspensions.filter(
    (suspension) => suspension.isActive && suspension.teamSide === teamSide,
  ).length;
  return Math.max(0, MAX_ON_FIELD_PLAYERS - activePenaltyCount);
};

const getLastMeaningfulEvent = (sport, options = {}) => {
  const history = sport?.events || [];
  const startIndex = options.excludeCurrent ? history.length - 2 : history.length - 1;
  for (let index = startIndex; index >= 0; index -= 1) {
    const candidate = history[index];
    if (!candidate || ["undo", "possession_change", "period_end", "quarter_break"].includes(candidate.eventType)) continue;
    return candidate;
  }
  return null;
};

const getEventContext = (sport, event, baseGame) => {
  const quarter = Number(event.quarter || event.period || sport.currentQuarter || sport.currentPeriod || 1);
  const periodDurationSeconds = getHockeyPeriodDurationSeconds(sport);
  const gameTime = event.gameTime
    || sport.quarterTime
    || sport.periodTime
    || (baseGame?.timerState ? formatClock(baseGame.timerState, periodDurationSeconds) : getDefaultClockForFormat(sport));

  return {
    quarter,
    gameTime,
    elapsedSeconds: getElapsedSeconds(quarter, gameTime, periodDurationSeconds),
    periodDurationSeconds,
  };
};

const applyHockeyEvent = (sport, rawEvent, baseGame, options = {}) => {
  const event = cloneEvent(rawEvent);
  event.eventType = event?.eventType === "quarter_break" ? "period_end" : event?.eventType;

  const rosterSnapshot = createRosterSnapshot(event);
  mergeRosterIntoLineups(sport, rosterSnapshot);

  const context = getEventContext(sport, event, baseGame);
  syncSuspensions(sport, context.quarter, context.gameTime);
  sport.currentQuarter = context.quarter;
  sport.currentPeriod = context.quarter;
  sport.quarterTime = formatClock(context.gameTime, context.periodDurationSeconds);
  sport.periodTime = sport.quarterTime;

  const teamSide = getTeamSide(baseGame, event.teamId);
  const playerStats = findOrCreatePlayerStats(sport, event);

  if (["goal", "possession_change", "penalty_corner", "penalty_stroke"].includes(event.eventType)) {
    sport.possession = event.eventType === "goal" ? "neutral" : teamSide;
  }

  switch (event.eventType) {
    case "goal": {
      const quarter = sport.currentQuarter || 1;
      if (playerStats) playerStats.goals += 1;
      sport.score[teamSide] += 1;

      let quarterScore = sport.quarterScores[teamSide].find((entry) => entry.quarter === quarter);
      if (!quarterScore) {
        quarterScore = { quarter, goals: 0 };
        sport.quarterScores[teamSide].push(quarterScore);
      }
      quarterScore.goals += 1;
      break;
    }

    case "penalty_corner":
      if (playerStats) playerStats.penaltyCorners += 1;
      sport.penaltyCorners[teamSide] += 1;
      break;

    case "penalty_stroke":
      if (playerStats) playerStats.penaltyStrokes += 1;
      sport.penaltyStrokes[teamSide] += 1;
      break;

    case "foul":
      if (playerStats) playerStats.fouls += 1;
      break;

    case "free_hit":
      if (playerStats) playerStats.freeHits += 1;
      sport.possession = teamSide;
      break;

    case "save":
      if (playerStats) playerStats.saves += 1;
      break;

    case "shot_missed":
      if (playerStats) playerStats.shotsMissed += 1;
      break;

    case "long_corner":
      if (playerStats) playerStats.longCorners += 1;
      sport.possession = teamSide;
      break;

    case "sixteen_yard_hit":
      if (playerStats) playerStats.sixteenYardHits += 1;
      sport.possession = teamSide;
      break;

    case "green_card":
    case "yellow_card":
    case "red_card": {
      const nowMs = Date.now();
      // Resolve the wall-clock timestamp for this card.
      // Priority: (1) explicit suspensionStartedAt on event, (2) event.timestamp
      // (when the card was recorded), (3) now (live fresh event).
      // Using event.timestamp as fallback means old events stored before
      // suspensionStartedAt was added to the schema still get a meaningful
      // reference time and won't resurrect with a fresh 2-min timer on replay.
      const suspStartedAtRaw = event.suspensionStartedAt
        || (event.timestamp
          ? (typeof event.timestamp === "string" ? event.timestamp : new Date(event.timestamp).toISOString())
          : null)
        || new Date().toISOString();
      const startMs = new Date(suspStartedAtRaw).getTime();
      const durationSec = CARD_DURATIONS[event.eventType];

      // Defense-in-depth: if the wall-clock has already elapsed this card's
      // duration, mark it inactive immediately so it never flashes during replay.
      const isAlreadyExpired = durationSec != null
        && Number.isFinite(startMs)
        && Math.floor((nowMs - startMs) / 1000) >= durationSec;

      const lineup = sport.lineups[teamSide];
      const playerId = toId(event.playerId);
      if (playerId) {
        if (isAlreadyExpired) {
          // Card is already over — player should be in bench, not removed from field.
          // Only add to bench if they aren't tracked anywhere (avoids duplicate entries).
          const onField = uniqueIds(lineup.onFieldPlayerIds);
          const bench = uniqueIds(lineup.benchPlayerIds);
          if (!onField.includes(playerId) && !bench.includes(playerId)) {
            bench.push(playerId);
            lineup.benchPlayerIds = uniqueIds(bench.filter((p) => !onField.includes(p)));
          }
        } else {
          // Timed cards: leave the field and serve from the bench — never drop from both lists.
          // Red cards: remove from field and bench (expelled); eligibility is tracked via activeSuspensions.
          lineup.onFieldPlayerIds = removeFromArray(lineup.onFieldPlayerIds, playerId);
          if (event.eventType === "red_card") {
            lineup.benchPlayerIds = removeFromArray(lineup.benchPlayerIds, playerId);
          } else {
            const bench = uniqueIds(lineup.benchPlayerIds);
            if (!bench.includes(playerId)) bench.push(playerId);
            lineup.benchPlayerIds = uniqueIds(bench.filter((entry) => !lineup.onFieldPlayerIds.includes(entry)));
          }
        }
      }

      if (playerStats) {
        if (event.eventType === "green_card") playerStats.greenCards += 1;
        if (event.eventType === "yellow_card") playerStats.yellowCards += 1;
        if (event.eventType === "red_card") playerStats.redCards += 1;
      }

      const cardBucket = event.eventType === "green_card"
        ? "green"
        : event.eventType === "yellow_card"
          ? "yellow"
          : "red";
      sport.cards[teamSide][cardBucket] += 1;

      const suspension = {
        suspensionKey: createSuspensionKey(event, context),
        playerId,
        teamId: toId(event.teamId),
        teamSide,
        cardType: event.eventType,
        durationSeconds: durationSec,
        startedQuarter: context.quarter,
        startedClockSeconds: parseClockSeconds(context.gameTime),
        startedElapsedSeconds: context.elapsedSeconds,
        expiresAtElapsedSeconds: durationSec == null ? null : context.elapsedSeconds + durationSec,
        isActive: !isAlreadyExpired,
        isPermanent: durationSec == null,
        suspensionStartedAt: suspStartedAtRaw,
        returnedToBench: isAlreadyExpired,
        ...(isAlreadyExpired && {
          releasedQuarter: context.quarter,
          releasedClockSeconds: parseClockSeconds(context.gameTime),
          releasedElapsedSeconds: context.elapsedSeconds,
        }),
      };

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        const remaining = isAlreadyExpired ? 0 : (durationSec ? Math.max(0, durationSec - Math.floor((nowMs - startMs) / 1000)) : null);
        console.log(
          `[HockeyCard][applyEvent] ${event.eventType} player=${playerId}`,
          `startedAt=${suspStartedAtRaw} remaining=${remaining}s`,
          `isAlreadyExpired=${isAlreadyExpired} isReplay=${!!options?.isReplay}`,
        );
      }

      sport.activeSuspensions.push(suspension);
      break;
    }

    case "substitution": {
      const lineup = sport.lineups[teamSide];
      const outPlayerId = event.outPlayerId != null ? toId(event.outPlayerId) : (event.inPlayerId ? null : toId(event.playerId));
      const inPlayerId = toId(event.inPlayerId);
      let onFieldPlayerIds = uniqueIds(lineup.onFieldPlayerIds);
      let benchPlayerIds = uniqueIds(lineup.benchPlayerIds);

      if (outPlayerId) {
        onFieldPlayerIds = removeFromArray(onFieldPlayerIds, outPlayerId);
        if (!hasActiveSuspension(sport, outPlayerId)) {
          benchPlayerIds.push(outPlayerId);
        }

        const outStats = getPlayerStats(sport, outPlayerId, event.teamId);
        if (outStats) outStats.substitutions += 1;
      }

      if (inPlayerId && !onFieldPlayerIds.includes(inPlayerId) && !hasActiveSuspension(sport, inPlayerId)) {
        if (onFieldPlayerIds.length < getAllowedOnFieldCount(sport, teamSide)) {
          benchPlayerIds = removeFromArray(benchPlayerIds, inPlayerId);
          onFieldPlayerIds.push(inPlayerId);

          const incomingEvent = { ...event, playerId: inPlayerId };
          const inStats = getPlayerStats(sport, inPlayerId, event.teamId) || findOrCreatePlayerStats(sport, incomingEvent);
          if (inStats) inStats.substitutions += 1;
        }
      }

      lineup.onFieldPlayerIds = uniqueIds(onFieldPlayerIds);
      lineup.benchPlayerIds = uniqueIds(benchPlayerIds.filter((playerId) => !lineup.onFieldPlayerIds.includes(playerId)));
      break;
    }

    case "period_end":
      if ((sport.currentQuarter || 1) < (sport.matchFormat?.periodCount || DEFAULT_HOCKEY_MATCH_FORMAT.periodCount)) {
        sport.currentQuarter = (sport.currentQuarter || 1) + 1;
        sport.currentPeriod = sport.currentQuarter;
      }
      sport.quarterTime = getDefaultClockForFormat(sport);
      sport.periodTime = sport.quarterTime;
      break;

    case "undo": {
      const historyToReplay = (sport.events || [])
        .slice(0, -1)
        .filter((pastEvent) => pastEvent && pastEvent.eventType !== "undo")
        .map(cloneEvent);
      const replayed = replayHockeySport(sport, historyToReplay, baseGame);
      Object.assign(sport, replayed);
      break;
    }

    default:
      break;
  }

  if (event.eventType === "penalty_stroke" && !options?.skipPenaltyStrokeCheck) {
    getLastMeaningfulEvent(sport, { excludeCurrent: true });
  }
};

const replayHockeySport = (sport, rawEvents = [], baseGame, savedLineups = null) => {
  const nextSport = createReplaySport(sport, savedLineups);
  const eventsToReplay = (rawEvents || [])
    .filter(Boolean)
    .filter((event) => event.eventType !== "undo")
    .map(cloneEvent);

  eventsToReplay.forEach((event) => {
    nextSport.events.push(event);
    applyHockeyEvent(nextSport, event, baseGame, { isReplay: true, skipPenaltyStrokeCheck: true });
  });

  return nextSport;
};

const replayHockeyGame = (prev, rawEvents = [], savedLineups = null) => {
  if (!prev?.sport || !prev?.base) return prev;

  return {
    ...prev,
    sport: replayHockeySport(prev.sport, rawEvents, prev.base, savedLineups),
  };
};

/**
 * Wall-clock identity for undo / card tombstones.
 * Includes suspensionStartedAt / timestamp / optimistic id so two cards for the
 * same player are distinct tombstone keys.
 */
export const getHockeyEventLooseFingerprint = (event) => {
  if (!event) return "";
  const issuedAt = event.suspensionStartedAt
    || event.timestamp
    || event._optimisticId
    || "";
  return [
    event.eventType || "",
    event.teamId || "",
    event.playerId || "",
    event.quarter ?? event.period ?? 1,
    event.gameTime ?? "",
    String(issuedAt),
  ].map((value) => String(value)).join("|");
};

/**
 * Content identity for optimistic ↔ server dedup (NO issuedAt).
 * Not unique alone when the clock is frozen — prefer clientEventId matching,
 * and only fall back to content keys among server events after baselineEventCount.
 */
const normalizeHockeyGameTimeForFingerprint = (gameTime) => {
  if (gameTime == null || gameTime === "") return "";
  if (typeof gameTime === "string") return gameTime.trim();
  if (typeof gameTime === "object") {
    const minutes = Number(gameTime.minutes);
    const seconds = Number(gameTime.seconds);
    if (!Number.isFinite(minutes) && !Number.isFinite(seconds)) return "";
    return `${String(Math.max(0, minutes || 0)).padStart(2, "0")}:${String(Math.max(0, seconds || 0)).padStart(2, "0")}`;
  }
  return String(gameTime);
};

export const getHockeyEventContentFingerprint = (event) => {
  if (!event) return "";
  return [
    event.eventType || "",
    event.teamId || "",
    event.playerId || "",
    event.quarter ?? event.period ?? 1,
    normalizeHockeyGameTimeForFingerprint(event.gameTime),
  ].map((value) => String(value)).join("|");
};

export const getHockeyClientEventId = (eventOrAction) => {
  if (!eventOrAction) return "";
  if (typeof eventOrAction === "string") return eventOrAction;
  return String(
    eventOrAction.clientEventId
      || eventOrAction._optimisticId
      || eventOrAction.id
      || eventOrAction.payload?.clientEventId
      || eventOrAction.payload?._optimisticId
      || "",
  );
};

/**
 * Find a server event index that proves `action` has landed.
 * Prefer exact clientEventId; else content-match only among events appended
 * after the action's baselineEventCount (so an earlier identical goal is ignored).
 */
export const findCommittedHockeyServerEventIndex = (
  action,
  serverEvents = [],
  claimedIndexes = null,
) => {
  if (!action?.payload) return -1;
  const events = serverEvents || [];
  const claimed = claimedIndexes instanceof Set ? claimedIndexes : null;
  const clientEventId = getHockeyClientEventId(action);

  if (clientEventId) {
    for (let i = 0; i < events.length; i += 1) {
      if (claimed?.has(i)) continue;
      const serverId = getHockeyClientEventId(events[i]);
      if (serverId && serverId === clientEventId) return i;
    }
  }

  const fingerprint = getHockeyEventContentFingerprint(action.payload);
  if (!fingerprint) return -1;
  const baseline = Math.max(0, Number(action.baselineEventCount) || 0);
  for (let i = baseline; i < events.length; i += 1) {
    if (claimed?.has(i)) continue;
    if (getHockeyEventContentFingerprint(events[i]) === fingerprint) return i;
  }
  return -1;
};

/**
 * Drop pending event actions that are already present on the server snapshot.
 * Keeps undo actions and any event that has not yet landed (stale hydrate must
 * still be able to re-apply optimistic score).
 */
export const pruneCommittedHockeyPendingActions = (actions = [], serverEvents = []) => {
  const claimed = new Set();
  return (actions || []).filter((action) => {
    if (!action) return false;
    if (action.type !== "event" || !action.payload) return true;
    const matchedIndex = findCommittedHockeyServerEventIndex(action, serverEvents, claimed);
    if (matchedIndex < 0) return true;
    claimed.add(matchedIndex);
    return false;
  });
};

/** Lineups seed for event replay — mirrors server getReplaySeedLineups. */
export const getHockeyReplaySeedLineups = (sport = {}, eventsToReplay = []) => {
  const hasReplayRosterSnapshots = (eventsToReplay || []).some(
    (event) => event?.rosterSnapshot?.homePlayerIds?.length || event?.rosterSnapshot?.awayPlayerIds?.length,
  );
  const hasStoredInitialLineups = !!(
    sport?.initialLineups?.home?.onFieldPlayerIds?.length
    || sport?.initialLineups?.away?.onFieldPlayerIds?.length
  );

  if (hasStoredInitialLineups) {
    return {
      home: {
        onFieldPlayerIds: uniqueIds(sport.initialLineups.home?.onFieldPlayerIds || []),
        benchPlayerIds: uniqueIds(sport.initialLineups.home?.benchPlayerIds || []),
      },
      away: {
        onFieldPlayerIds: uniqueIds(sport.initialLineups.away?.onFieldPlayerIds || []),
        benchPlayerIds: uniqueIds(sport.initialLineups.away?.benchPlayerIds || []),
      },
    };
  }

  if (hasReplayRosterSnapshots) {
    return createEmptyLineups();
  }

  return {
    home: {
      onFieldPlayerIds: uniqueIds(sport?.lineups?.home?.onFieldPlayerIds || []),
      benchPlayerIds: uniqueIds(sport?.lineups?.home?.benchPlayerIds || []),
    },
    away: {
      onFieldPlayerIds: uniqueIds(sport?.lineups?.away?.onFieldPlayerIds || []),
      benchPlayerIds: uniqueIds(sport?.lineups?.away?.benchPlayerIds || []),
    },
  };
};

export const filterHockeyEventsForReplay = (events = [], suppressedFingerprints = null) => {
  const suppressed = suppressedFingerprints instanceof Set ? suppressedFingerprints : new Set();
  if (!suppressed.size) return (events || []).filter(Boolean);
  return (events || []).filter((event) => {
    if (!event) return false;
    return !suppressed.has(getHockeyEventLooseFingerprint(event));
  });
};

const buildHockeyReplayEventList = (events = [], eventPayload = null, suppressedFingerprints = null) => {
  const filtered = filterHockeyEventsForReplay(events, suppressedFingerprints);
  if (!eventPayload) return filtered;
  // Only skip re-appending the exact same optimistic action. Content-identity
  // dedup belongs in replayPendingHockeyActions (multiset) — using it here
  // would drop a second rapid goal that shares gameTime with a server goal.
  if (eventPayload._optimisticId) {
    const hasSameOptimistic = filtered.some(
      (event) => event && event._optimisticId === eventPayload._optimisticId,
    );
    if (hasSameOptimistic) return filtered;
  }
  return [...filtered, eventPayload];
};

export const rebuildHockeyGameFromEvents = (prev, rawEvents = [], savedLineups = null, suppressedFingerprints = null) => {
  if (!prev?.sport || !prev?.base) return prev;
  const events = filterHockeyEventsForReplay(rawEvents, suppressedFingerprints);
  return replayHockeyGame(prev, events, savedLineups);
};

export const applyOptimisticHockeyUpdate = (prev, eventPayload, options = {}) => {
  if (!prev?.sport || !eventPayload) return prev;
  const rawEvents = buildHockeyReplayEventList(
    prev.sport.events || [],
    eventPayload,
    options.suppressedFingerprints,
  );
  const seedLineups = options.savedLineups
    ?? getHockeyReplaySeedLineups(prev.sport, prev.sport.events || []);
  return replayHockeyGame(prev, rawEvents, seedLineups);
};

export const applyOptimisticHockeyUndo = (prev, options = {}) => {
  if (!prev?.sport) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const teamSide = options?.teamSide || null;
  const events = filterHockeyEventsForReplay(prev.sport.events || [], options.suppressedFingerprints);
  let removedIndex = -1;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.eventType === "undo") continue;
    if (!teamSide || getEventTeamSide(event, prev.base) === teamSide) {
      removedIndex = index;
      break;
    }
    // teamSide is specified but this event belongs to the other team — keep scanning backward
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const undoTarget = removedIndex >= 0 ? events[removedIndex] : null;
    console.log(
      `[HockeyUndo][applyUndo] teamSide=${teamSide || "any"} found=${removedIndex >= 0}`,
      undoTarget
        ? `target: ${undoTarget.eventType} player=${undoTarget.playerId} team=${undoTarget.teamSide || "?"} idx=${removedIndex}`
        : "nothing to undo",
      `eventHistory=[${events.map((e) => e?.eventType || "?").join(",")}]`,
    );
  }

  if (removedIndex < 0) {
    return { nextGame: prev, removedEvent: null, removedIndex: -1 };
  }

  const [removedEvent] = events.splice(removedIndex, 1);
  const seedLineups = options.savedLineups
    ?? getHockeyReplaySeedLineups(prev.sport, prev.sport.events || []);
  return {
    nextGame: replayHockeyGame(prev, events, seedLineups),
    removedEvent,
    removedIndex,
  };
};

export function deriveHockeyClientGame(game, suppressedFingerprints = new Set()) {
  if (!game?.base || game?.base?.sport !== "Hockey" || !game?.sport) return game;
  const rawEvents = game.sport.events || [];
  const seedLineups = getHockeyReplaySeedLineups(game.sport, rawEvents);
  const derived = rebuildHockeyGameFromEvents(
    game,
    rawEvents,
    seedLineups,
    suppressedFingerprints,
  );

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const { logHockeyCardDebug } = require("@/lib/hockeyTombstones");
    logHockeyCardDebug("derive.client", {
      tombstones: [...suppressedFingerprints],
      cardEvents: (rawEvents || [])
        .filter((e) => ["green_card", "yellow_card", "red_card"].includes(e?.eventType))
        .map((e) => getHockeyEventLooseFingerprint(e)),
      activeCards: (derived?.sport?.activeSuspensions || [])
        .filter((s) => s.isActive)
        .map((s) => `${s.cardType}:${s.playerId}`),
      homeOnField: derived?.sport?.lineups?.home?.onFieldPlayerIds?.length ?? 0,
      homeBench: derived?.sport?.lineups?.home?.benchPlayerIds?.length ?? 0,
    });
  }

  return derived;
}

export const replayPendingHockeyActions = (game, actions = [], options = {}) => {
  const rawEvents = game?.sport?.events || [];
  const seedLineups = options.savedLineups ?? getHockeyReplaySeedLineups(game?.sport, rawEvents);
  const replayOptions = {
    savedLineups: seedLineups,
    suppressedFingerprints: options.suppressedFingerprints,
  };

  let nextGame = deriveHockeyClientGame(game, options.suppressedFingerprints);

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const { logHockeyCardDebug } = require("@/lib/hockeyTombstones");
    logHockeyCardDebug("replayPending.start", {
      pending: (actions || []).map((action) => `${action.type}:${action.id}`),
      tombstones: [...(options.suppressedFingerprints || [])],
      activeCards: (nextGame?.sport?.activeSuspensions || [])
        .filter((s) => s.isActive)
        .map((s) => `${s.cardType}:${s.playerId}`),
    });
  }

  // Claimed server event indexes already matched to a pending action.
  // Prevents a new goal at a frozen clock from being treated as the previous goal.
  const claimedServerIndexes = new Set();

  return (actions || []).reduce((accumulator, action) => {
    if (!accumulator) return accumulator;
    if (action?.type === "undo") {
      // Undo is applied optimistically via tombstones + deriveHockeyClientGame.
      // Pending undo actions only drive removeLastEventAPI — never strip another event here.
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        const { logHockeyCardDebug } = require("@/lib/hockeyTombstones");
        logHockeyCardDebug("replayPending.skipUndo", {
          teamSide: action.teamSide || null,
          activeCards: (accumulator?.sport?.activeSuspensions || [])
            .filter((s) => s.isActive)
            .map((s) => `${s.cardType}:${s.playerId}`),
        });
      }
      return accumulator;
    }
    if (action?.type === "event" && action.payload) {
      const matchedIndex = findCommittedHockeyServerEventIndex(
        action,
        accumulator?.sport?.events || [],
        claimedServerIndexes,
      );
      if (matchedIndex >= 0) {
        claimedServerIndexes.add(matchedIndex);
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log(
            `[HockeyReplay][DEDUP] skipping already-committed ${action.payload.eventType}`,
            `player=${action.payload.playerId} side=${action.payload.teamSide}`,
            `quarter=${action.payload.quarter} time=${action.payload.gameTime}`,
            `pendingId=${action.id} matchedServerIndex=${matchedIndex}`,
          );
        }
        return accumulator;
      }

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        const isCardEvent = ["green_card", "yellow_card", "red_card"].includes(action.payload.eventType);
        if (isCardEvent) {
          console.log(
            `[HockeyReplay] replaying pending card event ${action.payload.eventType}`,
            `player=${action.payload.playerId} side=${action.payload.teamSide}`,
            `serverEventCount=${(accumulator?.sport?.events || []).length}`,
          );
        }
      }

      return applyOptimisticHockeyUpdate(accumulator, action.payload, replayOptions);
    }
    return accumulator;
  }, nextGame);
};

export const getHockeyActiveCardSummary = (sport) => ({
  activeCards: (sport?.activeSuspensions || [])
    .filter((s) => s.isActive)
    .map((s) => `${s.cardType}:${s.playerId}`),
  cardEvents: (sport?.events || [])
    .filter((e) => ["green_card", "yellow_card", "red_card"].includes(e?.eventType))
    .map((e) => `${e.eventType}:${e.playerId}`),
});