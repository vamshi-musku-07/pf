import { getCricketMatchResult } from "./cricketState";

// ─────────────────────────────────────────────────────────────────────────
// Pure, side-effect-free aggregation of cricket career stats from the list of
// a team's finished games. Everything here is derived from data the app
// already holds (`game.sport.playerStats`, `game.sport.events`, innings totals)
// so it can never desync with the backend or corrupt live scoring — worst case
// it simply returns empty results and the UI hides itself.
// ─────────────────────────────────────────────────────────────────────────

const num = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

// The games list endpoint returns flat base docs (`game.sport` is a string,
// `game.status`, `game._id`), while a fully fetched game is nested under
// `game.base` with `game.sport` holding the sport sub-document. These readers
// tolerate both shapes.
const sportNameOf = (game) => {
  const value = game?.base?.sport != null ? game.base.sport : game?.sport;
  return typeof value === "string" ? value : "";
};

const statusOf = (game) =>
  String(game?.base?.status != null ? game.base.status : game?.status || "");

export const getGameId = (game) =>
  game?._id || game?.base?._id || game?.id || null;

const isCricketGame = (game) => sportNameOf(game).toLowerCase() === "cricket";

const isFinishedGame = (game) => statusOf(game).toLowerCase() === "finished";

export const getFinishedCricketGames = (games) =>
  (Array.isArray(games) ? games : []).filter(
    (game) => isCricketGame(game) && isFinishedGame(game),
  );

/**
 * Balls bowled → conventional overs notation (e.g. 13 balls → 2.1).
 */
export const ballsToOvers = (balls) => {
  const total = num(balls);
  const completed = Math.floor(total / 6);
  const remainder = total % 6;
  return remainder === 0 ? `${completed}` : `${completed}.${remainder}`;
};

const playerIdOf = (player) => {
  if (!player) return "";
  const pid = player._id ?? player.id ?? player.playerId;
  return pid != null ? String(pid) : "";
};

const playerDisplayName = (player) => {
  if (!player) return "";
  const full = typeof player.fullName === "string" ? player.fullName.trim() : "";
  if (full) return full;
  const joined = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return String(player.name || player.playerName || "").trim();
};

/**
 * Build a { playerId -> displayName } map from the team roster first, then
 * fall back to any `playerName` recorded on game events. Roster names win.
 */
export const buildCricketPlayerNameMap = (games, players) => {
  const map = {};

  const remember = (playerId, name, { roster = false } = {}) => {
    const pid = playerId != null ? String(playerId) : "";
    const label = String(name || "").trim();
    if (!pid || !label) return;
    if (roster || !map[pid]) map[pid] = label;
  };

  getFinishedCricketGames(games).forEach((game) => {
    (game?.sport?.events || []).forEach((event) => {
      remember(event?.playerId, event?.playerName);
      remember(event?.relatedPlayerId, event?.relatedPlayerName);
      remember(event?.dismissedPlayerId, event?.dismissedPlayerName);
      remember(event?.fielderId, event?.fielderName);
    });
    (game?.sport?.playerStats || []).forEach((stat) => {
      remember(stat?.playerId, stat?.playerName || stat?.name);
    });
  });

  const roster = [];
  if (Array.isArray(players)) roster.push(...players);
  else if (players && typeof players === "object") {
    if (Array.isArray(players.home)) roster.push(...players.home);
    if (Array.isArray(players.away)) roster.push(...players.away);
  }

  roster.forEach((player) => {
    const pid = playerIdOf(player);
    const name = playerDisplayName(player);
    if (pid && name) remember(pid, name, { roster: true });
  });

  return map;
};

const emptyAggregate = (playerId) => ({
  playerId: String(playerId),
  matches: 0,
  runs: 0,
  balls_faced: 0,
  fours: 0,
  sixes: 0,
  highest_score: 0,
  not_outs: 0,
  innings_batted: 0,
  wickets: 0,
  runs_conceded: 0,
  balls_bowled: 0,
  catches: 0,
  run_outs: 0,
  best_bowling: { wickets: 0, runs: 0 },
});

/**
 * Compare two single-innings bowling figures. Returns true when `candidate`
 * is a better spell than `current` (more wickets, or same wickets for fewer
 * runs).
 */
const isBetterBowling = (candidate, current) => {
  if (candidate.wickets !== current.wickets)
    return candidate.wickets > current.wickets;
  return candidate.runs < current.runs;
};

/**
 * Aggregate every player's career batting & bowling totals for one team across
 * all its finished cricket games. Returns an array of derived stat objects.
 */
export const aggregateCricketPlayerStats = (games, teamId) => {
  const targetTeamId = teamId != null ? String(teamId) : null;
  const byPlayer = new Map();

  getFinishedCricketGames(games).forEach((game) => {
    const playerStats = Array.isArray(game?.sport?.playerStats)
      ? game.sport.playerStats
      : [];

    playerStats.forEach((stat) => {
      if (!stat || stat.playerId == null) return;
      // When a team is specified, only tally that team's players.
      if (targetTeamId && String(stat.teamId || "") !== targetTeamId) return;

      const pid = String(stat.playerId);
      const agg = byPlayer.get(pid) || emptyAggregate(pid);

      const gameRuns = num(stat.runs);
      const gameWickets = num(stat.wickets);
      const gameRunsConceded = num(stat.runs_conceded);
      const gameBallsFaced = num(stat.balls_faced);
      const gameBallsBowled = num(stat.balls_bowled);

      const batted = gameBallsFaced > 0 || gameRuns > 0;
      const bowled = gameBallsBowled > 0 || gameWickets > 0;

      agg.matches += 1;
      agg.runs += gameRuns;
      agg.balls_faced += gameBallsFaced;
      agg.fours += num(stat.fours);
      agg.sixes += num(stat.sixes);
      agg.wickets += gameWickets;
      agg.runs_conceded += gameRunsConceded;
      agg.balls_bowled += gameBallsBowled;
      agg.catches += num(stat.catches);
      agg.run_outs += num(stat.run_outs);
      agg.not_outs += num(stat.not_outs);
      if (batted) agg.innings_batted += 1;
      if (gameRuns > agg.highest_score) agg.highest_score = gameRuns;

      if (bowled) {
        const candidate = { wickets: gameWickets, runs: gameRunsConceded };
        if (isBetterBowling(candidate, agg.best_bowling)) {
          agg.best_bowling = candidate;
        }
      }

      byPlayer.set(pid, agg);
    });
  });

  return Array.from(byPlayer.values()).map((agg) => {
    const strike_rate =
      agg.balls_faced > 0 ? (agg.runs / agg.balls_faced) * 100 : 0;
    const economy =
      agg.balls_bowled > 0 ? agg.runs_conceded / (agg.balls_bowled / 6) : 0;
    const batting_average =
      agg.innings_batted - agg.not_outs > 0
        ? agg.runs / (agg.innings_batted - agg.not_outs)
        : null;
    const bowling_average =
      agg.wickets > 0 ? agg.runs_conceded / agg.wickets : null;
    return {
      ...agg,
      overs_bowled: ballsToOvers(agg.balls_bowled),
      strike_rate,
      economy,
      batting_average,
      bowling_average,
    };
  });
};

/**
 * Win / loss / tie record for a team across its finished cricket games.
 * Games whose result cannot be determined (missing second innings, etc.) are
 * counted as `played` but not attributed to any bucket.
 */
export const computeCricketTeamRecord = (games, teamId) => {
  const targetTeamId = teamId != null ? String(teamId) : "";
  const record = { played: 0, won: 0, lost: 0, tied: 0, undecided: 0 };

  getFinishedCricketGames(games).forEach((game) => {
    record.played += 1;
    const result = getCricketMatchResult(game);
    if (!result?.finished) {
      record.undecided += 1;
      return;
    }
    if (result.tie) {
      record.tied += 1;
      return;
    }
    if (targetTeamId && String(result.winnerTeamId || "") === targetTeamId) {
      record.won += 1;
    } else {
      record.lost += 1;
    }
  });

  const decided = record.won + record.lost;
  record.win_pct = decided > 0 ? (record.won / decided) * 100 : 0;
  return record;
};

const withName = (entry, nameMap) => {
  const pid = entry?.playerId != null ? String(entry.playerId) : "";
  const resolved = nameMap[pid];
  return {
    ...entry,
    name: resolved || (pid ? `Player ${pid.slice(-4)}` : "Unknown"),
  };
};

/**
 * Build the leaderboards shown on the dashboard from aggregated player stats.
 * `limit` caps each board; the strike-rate / economy boards apply sensible
 * minimum-workload thresholds so a single-ball cameo can't top the chart.
 */
export const buildCricketLeaderboards = (aggregated, nameMap = {}, options = {}) => {
  const list = Array.isArray(aggregated) ? aggregated : [];
  const limit = options.limit || 5;
  const minBallsFaced = options.minBallsFaced ?? 12;
  const minBallsBowled = options.minBallsBowled ?? 12;

  const topRunScorers = list
    .filter((p) => p.runs > 0)
    .sort((a, b) => b.runs - a.runs || b.strike_rate - a.strike_rate)
    .slice(0, limit)
    .map((p) => withName(p, nameMap));

  const topWicketTakers = list
    .filter((p) => p.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
    .slice(0, limit)
    .map((p) => withName(p, nameMap));

  const bestStrikeRate = list
    .filter((p) => p.balls_faced >= minBallsFaced && p.runs > 0)
    .sort((a, b) => b.strike_rate - a.strike_rate)
    .slice(0, limit)
    .map((p) => withName(p, nameMap));

  const bestEconomy = list
    .filter((p) => p.balls_bowled >= minBallsBowled)
    .sort((a, b) => a.economy - b.economy)
    .slice(0, limit)
    .map((p) => withName(p, nameMap));

  return { topRunScorers, topWicketTakers, bestStrikeRate, bestEconomy };
};

/**
 * One-shot convenience used by the UI: everything needed to render the cricket
 * stats dashboard, or `null` when there is nothing to show (so the caller can
 * render nothing and leave the existing screen untouched).
 */
export const getCricketStatsSummary = (games, { teamId, players } = {}) => {
  const finished = getFinishedCricketGames(games);
  if (finished.length === 0) return null;

  const nameMap = buildCricketPlayerNameMap(finished, players);
  const aggregated = aggregateCricketPlayerStats(finished, teamId);
  const record = computeCricketTeamRecord(finished, teamId);
  const leaderboards = buildCricketLeaderboards(aggregated, nameMap);

  const hasPlayerStats = aggregated.length > 0;
  if (!hasPlayerStats && record.played === 0) return null;

  return {
    finishedCount: finished.length,
    record,
    players: aggregated
      .map((p) => withName(p, nameMap))
      .sort((a, b) => b.runs - a.runs),
    leaderboards,
    hasPlayerStats,
  };
};
