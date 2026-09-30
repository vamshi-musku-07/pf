// Pure helpers for baseball inning presentation.
// The number of inning columns and the "Inning X of Y" label both come from the
// organizer-configured game length (tournament rules copied onto the live game),
// never a hardcoded 9.

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumInnings = (arr = []) =>
  Array.isArray(arr) ? arr.reduce((s, v) => s + toNum(v), 0) : 0;

/** Default length when a game carries no rules (standalone/friendly baseball). */
const DEFAULT_SCHEDULED_INNINGS = 9;

/** Configured game length, falling back to standard 9 innings. */
const resolveScheduledInnings = (scheduledInnings, fallback = DEFAULT_SCHEDULED_INNINGS) => {
  const n = toNum(scheduledInnings);
  return n > 0 ? Math.max(1, Math.trunc(n)) : fallback;
};

/**
 * How many inning columns to render: the configured length, expanded if the game
 * has run into extra innings or already recorded more innings than scheduled.
 */
const resolveInningColumns = ({
  homeByInning = [],
  awayByInning = [],
  currentInning,
  scheduledInnings,
  fallbackScheduled = 0,
} = {}) =>
  Math.max(
    Array.isArray(homeByInning) ? homeByInning.length : 0,
    Array.isArray(awayByInning) ? awayByInning.length : 0,
    toNum(currentInning),
    resolveScheduledInnings(scheduledInnings, fallbackScheduled),
    1,
  );

/** "▲ Inning 2 of 7", or "▼ Inning 8 · Extra" once past regulation. */
const formatInningStatus = ({ currentInning, scheduledInnings, inningHalf } = {}) => {
  const inning = Math.max(1, toNum(currentInning) || 1);
  const scheduled = resolveScheduledInnings(scheduledInnings);
  const arrow = inningHalf === "bottom" ? "▼" : "▲";
  const suffix = inning > scheduled ? " · Extra" : ` of ${scheduled}`;
  return `${arrow} Inning ${inning}${suffix}`;
};

/** Build line-score props from a tournament fixture.result (completed or live). */
const buildLineScoreFromFixture = (fixture = {}) => {
  const res = fixture.result || {};
  return {
    homeName: fixture.homeTeamName || res.home?.teamName || "Home",
    awayName: fixture.awayTeamName || res.away?.teamName || "Away",
    homeByInning: res.home?.byInning || res.byInning?.home || [],
    awayByInning: res.away?.byInning || res.byInning?.away || [],
    homeRuns: res.home?.runs,
    awayRuns: res.away?.runs,
    homeHits: res.home?.hits,
    awayHits: res.away?.hits,
    homeErrors: res.home?.errors,
    awayErrors: res.away?.errors,
    scheduledInnings: res.scheduledInnings ?? fixture.scheduledInnings,
    statusLabel: res.finishMethod || (fixture.status === "completed" ? "Final" : null),
  };
};

/** Build line-score props from a live BaseballGame-shaped object. */
const buildLineScoreFromGame = (game = {}, { homeName, awayName } = {}) => {
  const score = game.score || {};
  const stats = game.gameStats || {};
  return {
    homeName: homeName || game.homeTeamName || "Home",
    awayName: awayName || game.awayTeamName || "Away",
    homeByInning: score.byInning?.home || [],
    awayByInning: score.byInning?.away || [],
    homeRuns: score.home ?? stats.home?.runs,
    awayRuns: score.away ?? stats.away?.runs,
    homeHits: stats.home?.hits,
    awayHits: stats.away?.hits,
    homeErrors: stats.home?.errors,
    awayErrors: stats.away?.errors,
    currentInning: game.currentInning || score.inning,
    scheduledInnings: game.rules?.scheduledInnings ?? game.scheduledInnings,
    isTop: game.isTopInning !== false && game.half !== "bottom",
    statusLabel:
      game.status === "finished" || game.status === "completed"
        ? game.finishMethod || game.resultType || "Final"
        : game.status === "live"
          ? formatInningStatus({
              currentInning: game.currentInning || score.inning,
              scheduledInnings: game.rules?.scheduledInnings ?? game.scheduledInnings,
              inningHalf: game.half,
            })
          : null,
  };
};

module.exports = {
  DEFAULT_SCHEDULED_INNINGS,
  toNum,
  sumInnings,
  resolveScheduledInnings,
  resolveInningColumns,
  formatInningStatus,
  buildLineScoreFromFixture,
  buildLineScoreFromGame,
};
