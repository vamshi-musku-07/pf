import { normalizeTeamId } from "./playerRoster";

const isObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const normalizeBaseIds = (base) => {
  if (!base) return base;
  return {
    ...base,
    teamId: normalizeTeamId(base.teamId) || base.teamId,
    opponentTeamId: normalizeTeamId(base.opponentTeamId) || base.opponentTeamId,
  };
};

const toSafeNumber = (value, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toPositiveInteger = (value, fallback = 1) => {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
};

export const sanitizeGameEvents = (events) => {
  if (!Array.isArray(events)) return [];

  return events.filter(
    (event) =>
      isObject(event) &&
      typeof event.eventType === "string" &&
      event.eventType.trim().length > 0,
  );
};

const normalizeQuarterScoreEntries = (entries) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter(isObject)
    .map((entry, index) => ({
      ...entry,
      quarter: toPositiveInteger(entry.quarter, index + 1),
      score: toSafeNumber(entry.score),
    }));
};

const normalizeSideBucket = (bucket) => ({
  home: toSafeNumber(bucket?.home),
  away: toSafeNumber(bucket?.away),
});

const normalizeBasketballSport = (sportGame) => {
  const sport = isObject(sportGame) ? { ...sportGame } : {};

  return {
    ...sport,
    currentQuarter: toPositiveInteger(sport.currentQuarter, 1),
    score: {
      home: toSafeNumber(sport.score?.home),
      away: toSafeNumber(sport.score?.away),
    },
    events: sanitizeGameEvents(sport.events),
    playerStats: Array.isArray(sport.playerStats)
      ? sport.playerStats.filter(isObject)
      : [],
    quarterScores: {
      home: normalizeQuarterScoreEntries(sport.quarterScores?.home),
      away: normalizeQuarterScoreEntries(sport.quarterScores?.away),
    },
    gameStats: {
      rebounds: normalizeSideBucket(sport.gameStats?.rebounds),
      assists: normalizeSideBucket(sport.gameStats?.assists),
      steals: normalizeSideBucket(sport.gameStats?.steals),
      blocks: normalizeSideBucket(sport.gameStats?.blocks),
      turnovers: normalizeSideBucket(sport.gameStats?.turnovers),
      fouls: normalizeSideBucket(sport.gameStats?.fouls),
      timeouts: normalizeSideBucket(sport.gameStats?.timeouts),
    },
  };
};

const normalizeSportGame = (sportName, sportGame) => {
  if (sportName === "Basketball") {
    return normalizeBasketballSport(sportGame);
  }

  const sport = isObject(sportGame) ? { ...sportGame } : {};
  return {
    ...sport,
    events: sanitizeGameEvents(sport.events),
  };
};

const maybeReconcileCricketGame = (game) => {
  if (!game?.base || game.base.sport !== "Cricket" || !game.sport) return game;
  // Lazy require avoids circular imports during module init.
  const { reconcileCricketTotalsFromEvents } = require("../components/game/hooks/cricketState");
  return reconcileCricketTotalsFromEvents(game);
};

const maybeDeriveHockeyGame = (game) => {
  if (!game?.base || game.base.sport !== "Hockey" || !game.sport) return game;
  const { deriveHockeyClientGame } = require("../components/game/hooks/hockeyState");
  return deriveHockeyClientGame(game, new Set());
};

export const mergeGamePermissions = (prevGame, nextGame) => {
  if (!nextGame) return nextGame;
  if (nextGame.permissions) return nextGame;
  if (prevGame?.permissions) {
    return { ...nextGame, permissions: prevGame.permissions };
  }
  return nextGame;
};

export const normalizeGameModel = (value) => {
  const normalized = value?.data || value;
  if (!normalized) return null;

  if (normalized.base) {
    const base = normalizeBaseIds(normalized.base || null);
    const sportName = base?.sport || normalized?.sport?.sport || null;

    return maybeDeriveHockeyGame(maybeReconcileCricketGame({
      ...normalized,
      base,
      sport: normalizeSportGame(sportName, normalized.sport),
    }));
  }

  const baseGame = normalizeBaseIds(normalized.baseGame || normalized);
  if (!baseGame) return null;

  const sportGame = normalized.sportGame || normalized.sport || null;
  const sportName = baseGame?.sport || normalized?.sport || null;

  return maybeDeriveHockeyGame(maybeReconcileCricketGame({
    base: baseGame,
    sport: normalizeSportGame(sportName, sportGame),
  }));
};
