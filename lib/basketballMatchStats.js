/**
 * Aggregates basketball team comparison stats from the live event feed.
 * Mirrors the server-side event handling in game-service/controllers/sport/basketball.js
 * so the in-game Stats tab always matches the scoreboard.
 */

const FOUL_TYPES = ["foul", "shooting_foul", "technical_foul", "flagrant_foul"];

const emptySide = () => ({
  points: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  twoPointsMade: 0,
  twoPointsAttempted: 0,
  threePointsMade: 0,
  threePointsAttempted: 0,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  rebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
});

export const quarterLabel = (quarter) => {
  const n = Number(quarter);
  if (!Number.isFinite(n) || n < 1) return "Q1";
  return n <= 4 ? `Q${n}` : `OT${n - 4}`;
};

/** Filter chips for the stats header: ALL plus every quarter that has been reached. */
export const buildQuarterFilters = (events = [], currentQuarter = 1) => {
  const highest = (Array.isArray(events) ? events : []).reduce(
    (max, event) => Math.max(max, Number(event?.quarter) || 0),
    Math.max(1, Number(currentQuarter) || 1),
  );
  const filters = [{ key: "all", label: "ALL", quarter: null }];
  for (let q = 1; q <= Math.max(4, highest); q += 1) {
    filters.push({ key: String(q), label: quarterLabel(q), quarter: q });
  }
  return filters;
};

export const percentOf = (made, attempted) => {
  const a = Number(attempted) || 0;
  if (a <= 0) return 0;
  return Math.round(((Number(made) || 0) / a) * 100);
};

/**
 * @param events sanitized game events (each with eventType, teamId, quarter)
 * @param options.homeTeamId team id that counts as the home side
 * @param options.quarter when set, only events from that quarter are counted
 */
export const aggregateBasketballTeamStats = (events = [], options = {}) => {
  const homeTeamId = String(options.homeTeamId || "");
  const quarter = options.quarter == null ? null : Number(options.quarter);
  const stats = { home: emptySide(), away: emptySide() };

  (Array.isArray(events) ? events : []).forEach((event) => {
    const type = event?.eventType;
    if (!type) return;
    if (quarter != null && Number(event.quarter) !== quarter) return;

    const side = String(event.teamId) === homeTeamId ? "home" : "away";
    const other = side === "home" ? "away" : "home";
    const row = stats[side];

    switch (type) {
      case "point_2":
      case "and_one":
        row.points += 2;
        row.twoPointsMade += 1;
        row.twoPointsAttempted += 1;
        if (type === "and_one") stats[other].fouls += 1;
        break;
      case "point_2_miss":
        row.twoPointsAttempted += 1;
        break;
      case "point_3":
        row.points += 3;
        row.threePointsMade += 1;
        row.threePointsAttempted += 1;
        break;
      case "point_3_miss":
        row.threePointsAttempted += 1;
        break;
      case "free_throw":
        row.points += 1;
        row.freeThrowsMade += 1;
        row.freeThrowsAttempted += 1;
        break;
      case "free_throw_miss":
        row.freeThrowsAttempted += 1;
        break;
      case "rebound":
        row.rebounds += 1;
        break;
      case "offensive_rebound":
        row.rebounds += 1;
        row.offensiveRebounds += 1;
        break;
      case "defensive_rebound":
        row.rebounds += 1;
        row.defensiveRebounds += 1;
        break;
      case "assist":
        row.assists += 1;
        break;
      case "steal":
        row.steals += 1;
        break;
      case "block":
        row.blocks += 1;
        break;
      case "turnover":
        row.turnovers += 1;
        break;
      default:
        if (FOUL_TYPES.includes(type)) row.fouls += 1;
        break;
    }
  });

  ["home", "away"].forEach((side) => {
    const row = stats[side];
    row.fieldGoalsMade = row.twoPointsMade + row.threePointsMade;
    row.fieldGoalsAttempted = row.twoPointsAttempted + row.threePointsAttempted;
  });

  return stats;
};

/** Shooting rows rendered with a made/attempted split and a percentage ring. */
export const buildShootingRows = (stats = {}) => {
  const rows = [
    { key: "freeThrows", label: "Free throws", made: "freeThrowsMade", attempted: "freeThrowsAttempted" },
    { key: "twoPointers", label: "2 pointers", made: "twoPointsMade", attempted: "twoPointsAttempted" },
    { key: "threePointers", label: "3 pointers", made: "threePointsMade", attempted: "threePointsAttempted" },
    { key: "fieldGoals", label: "Field goals", made: "fieldGoalsMade", attempted: "fieldGoalsAttempted" },
  ];
  return rows.map((row) => {
    const home = stats.home || {};
    const away = stats.away || {};
    return {
      key: row.key,
      label: row.label,
      home: {
        made: home[row.made] || 0,
        attempted: home[row.attempted] || 0,
        percent: percentOf(home[row.made], home[row.attempted]),
      },
      away: {
        made: away[row.made] || 0,
        attempted: away[row.attempted] || 0,
        percent: percentOf(away[row.made], away[row.attempted]),
      },
    };
  });
};

/** Counting rows rendered as a two-sided comparison bar. */
export const buildComparisonRows = (stats = {}) => {
  const home = stats.home || {};
  const away = stats.away || {};
  const rows = [
    { key: "rebounds", label: "Rebounds", emphasis: true },
    { key: "defensiveRebounds", label: "Defensive rebounds" },
    { key: "offensiveRebounds", label: "Offensive rebounds" },
    { key: "assists", label: "Assists", emphasis: true },
    { key: "steals", label: "Steals" },
    { key: "blocks", label: "Blocks" },
    { key: "turnovers", label: "Turnovers" },
    { key: "fouls", label: "Fouls" },
  ];
  return rows.map((row) => ({
    ...row,
    home: home[row.key] || 0,
    away: away[row.key] || 0,
  }));
};

export const hasAnyBasketballStats = (stats = {}) => {
  const sum = (side = {}) =>
    Object.values(side).reduce((acc, value) => acc + (Number(value) || 0), 0);
  return sum(stats.home) + sum(stats.away) > 0;
};
