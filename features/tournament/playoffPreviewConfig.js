// Client-side playoff preview — mirrors game-service tournament-engine logic
// so Manage tab can show qualifiers even if the preview API is unreachable.

const { getLeaguePhaseProgress } = require("./nextStageConfig");

const BALLS_PER_OVER = 6;

const sortDivisions = (divisions = []) =>
  [...divisions].sort((a, b) => (a.order || 0) - (b.order || 0));

const formatWinPercentage = (won = 0, lost = 0) => {
  const denom = Number(won) + Number(lost);
  if (denom <= 0) return 0;
  return Math.round((Number(won) / denom) * 1000) / 1000;
};

const compareStandingsRows = (a, b, sport = "cricket") => {
  const sportName = String(sport || "").toLowerCase();
  if (sportName === "basketball") {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    const pdA = a.pointDiff ?? ((a.pointsFor || 0) - (a.pointsAgainst || 0));
    const pdB = b.pointDiff ?? ((b.pointsFor || 0) - (b.pointsAgainst || 0));
    if (pdB !== pdA) return pdB - pdA;
    if ((b.pointsFor || 0) !== (a.pointsFor || 0)) return (b.pointsFor || 0) - (a.pointsFor || 0);
    if ((a.pointsAgainst || 0) !== (b.pointsAgainst || 0)) return (a.pointsAgainst || 0) - (b.pointsAgainst || 0);
    return (a.teamName || "").localeCompare(b.teamName || "");
  }
  if (sportName === "baseball") {
    const pctA = a.winPercentage ?? formatWinPercentage(a.won, a.lost);
    const pctB = b.winPercentage ?? formatWinPercentage(b.won, b.lost);
    if (pctB !== pctA) return pctB - pctA;
    const rdA = a.runDifferential ?? (a.runsScored || 0) - (a.runsAllowed || 0);
    const rdB = b.runDifferential ?? (b.runsScored || 0) - (b.runsAllowed || 0);
    if (rdB !== rdA) return rdB - rdA;
    if ((b.runsScored || 0) !== (a.runsScored || 0)) return (b.runsScored || 0) - (a.runsScored || 0);
    if ((a.runsAllowed || 0) !== (b.runsAllowed || 0)) return (a.runsAllowed || 0) - (b.runsAllowed || 0);
    return (a.teamName || "").localeCompare(b.teamName || "");
  }
  if (b.points !== a.points) return b.points - a.points;
  if (b.nrr !== a.nrr) return b.nrr - a.nrr;
  if (b.won !== a.won) return b.won - a.won;
  return (a.teamName || "").localeCompare(b.teamName || "");
};

const sortStandingsRows = (rows, sport = "cricket") =>
  [...(rows || [])].sort((a, b) => compareStandingsRows(a, b, sport));

const effectiveBallsForNrr = (side, quotaBalls) => {
  const balls = side?.balls || 0;
  const wickets = side?.wickets || 0;
  const allOut = !!(side?.allOut || wickets >= 10);
  if (balls > 0) return allOut && quotaBalls > 0 ? quotaBalls : balls;
  if ((side?.runs || 0) <= 0) return 0;
  return quotaBalls;
};

const computeNrr = (runsScored, ballsFaced, runsConceded, ballsBowled) => {
  const rr = ballsFaced ? (runsScored * BALLS_PER_OVER) / ballsFaced : 0;
  const rrAgainst = ballsBowled ? (runsConceded * BALLS_PER_OVER) / ballsBowled : 0;
  const nrr = rr - rrAgainst;
  return Number.isFinite(nrr) ? Math.round(nrr * 1000) / 1000 : 0;
};

/** Recompute division standings from completed league fixtures (matches server engine). */
const recomputeStandings = (teams, fixtures, config = {}, sport = "cricket") => {
  const sportName = String(sport || "").toLowerCase();
  const isBaseball = sportName === "baseball";
  const isBasketball = sportName === "basketball";
  const cfg = {
    totalOvers: config.totalOvers || 20,
    pointsWin: config.pointsWin ?? (isBaseball ? 1 : isBasketball ? 2 : 2),
    pointsTie: config.pointsTie ?? (isBaseball ? 0.5 : isBasketball ? 0 : 1),
    pointsLoss: config.pointsLoss ?? 0,
    pointsNoResult: config.pointsNoResult ?? (isBaseball || isBasketball ? 0 : 1),
  };
  const quotaBalls = cfg.totalOvers * BALLS_PER_OVER;
  const rows = new Map();

  for (const t of teams || []) {
    rows.set(String(t.teamId), {
      teamId: String(t.teamId),
      teamName: t.teamName || "",
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsScored: 0,
      ballsFaced: 0,
      runsConceded: 0,
      ballsBowled: 0,
      runsAllowed: 0,
      runDifferential: 0,
      winPercentage: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      nrr: 0,
    });
  }

  for (const fx of [...(fixtures || [])].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))) {
    const res = fx.result;
    if (!res || fx.status !== "completed") continue;
    const homeId = String(res.home?.teamId || fx.homeTeamId || "");
    const awayId = String(res.away?.teamId || fx.awayTeamId || "");
    const homeRow = rows.get(homeId);
    const awayRow = rows.get(awayId);
    if (!homeRow || !awayRow) continue;

    homeRow.played += 1;
    awayRow.played += 1;

    if (!res.isNoResult) {
      if (isBaseball) {
        homeRow.runsScored += res.home?.runs || 0;
        homeRow.runsAllowed += res.away?.runs || 0;
        awayRow.runsScored += res.away?.runs || 0;
        awayRow.runsAllowed += res.home?.runs || 0;
      } else if (isBasketball) {
        homeRow.pointsFor += res.home?.points || 0;
        homeRow.pointsAgainst += res.away?.points || 0;
        awayRow.pointsFor += res.away?.points || 0;
        awayRow.pointsAgainst += res.home?.points || 0;
      } else {
        const homeBalls = effectiveBallsForNrr(res.home, quotaBalls);
        const awayBalls = effectiveBallsForNrr(res.away, quotaBalls);
        homeRow.runsScored += res.home?.runs || 0;
        homeRow.ballsFaced += homeBalls;
        homeRow.runsConceded += res.away?.runs || 0;
        homeRow.ballsBowled += awayBalls;
        awayRow.runsScored += res.away?.runs || 0;
        awayRow.ballsFaced += awayBalls;
        awayRow.runsConceded += res.home?.runs || 0;
        awayRow.ballsBowled += homeBalls;
      }
    }

    if (res.isNoResult) {
      homeRow.noResult += 1;
      awayRow.noResult += 1;
      homeRow.points += cfg.pointsNoResult;
      awayRow.points += cfg.pointsNoResult;
    } else if (res.isTie || !res.winnerTeamId) {
      homeRow.tied += 1;
      awayRow.tied += 1;
      homeRow.points += cfg.pointsTie;
      awayRow.points += cfg.pointsTie;
    } else {
      const winnerId = String(res.winnerTeamId);
      const winnerRow = winnerId === homeId ? homeRow : awayRow;
      const loserRow = winnerId === homeId ? awayRow : homeRow;
      winnerRow.won += 1;
      loserRow.lost += 1;
      winnerRow.points += cfg.pointsWin;
      loserRow.points += cfg.pointsLoss;
    }
  }

  return [...rows.values()].map((row) => ({
    ...row,
    runDifferential: (row.runsScored || 0) - (row.runsAllowed || row.runsConceded || 0),
    winPercentage: formatWinPercentage(row.won, row.lost),
    pointDiff: (row.pointsFor || 0) - (row.pointsAgainst || 0),
    nrr: isBaseball || isBasketball
      ? 0
      : computeNrr(row.runsScored, row.ballsFaced, row.runsConceded, row.ballsBowled),
  }));
};

const recomputeAllDivisionStandings = (teams, fixtures, config = {}, divisions = [], sport = "cricket") => {
  const leagueFixtures = (fixtures || []).filter((f) => f.stage === "league");
  const divList =
    divisions?.length > 0
      ? divisions
      : [{ id: "main", teamIds: (teams || []).map((t) => String(t.teamId)) }];

  const result = {};
  for (const div of divList) {
    const divId = String(div.id || "main");
    const divTeamIdSet = new Set((div.teamIds || []).map(String));
    const divTeams = (teams || []).filter((t) => divTeamIdSet.has(String(t.teamId)));
    const divFixtures = leagueFixtures.filter(
      (f) => String(f.divisionId || "main") === divId,
    );
    result[divId] = recomputeStandings(divTeams, divFixtures, config, sport);
  }
  return result;
};

const resolveStandingsForPreview = (tournament = {}, fixtures = [], standingsByDivision = {}) => {
  const completedLeague = (fixtures || []).filter(
    (f) => f.stage === "league" && (f.status === "completed" || f.status === "bye"),
  );
  if (!completedLeague.length) return standingsByDivision || {};

  const recomputed = recomputeAllDivisionStandings(
    tournament.teams || [],
    completedLeague,
    tournament.config || {},
    tournament.divisions || [],
    tournament.sport,
  );
  const hasData = Object.values(recomputed).some((rows) => rows?.length);
  return hasData ? recomputed : standingsByDivision || {};
};

const pickQualifyingRows = (table, count, sport = "cricket") => {
  const ranked = sortStandingsRows(table, sport);
  const played = ranked.filter((row) => row.played > 0);
  const pool = played.length ? played : ranked;
  return pool.slice(0, Math.max(0, count));
};

const seedQualifiersInterleaved = (qualifiersByDivision = []) => {
  const maxRank = qualifiersByDivision.reduce(
    (max, entry) => Math.max(max, entry.teams?.length || 0),
    0,
  );
  const seeded = [];
  for (let rank = 0; rank < maxRank; rank += 1) {
    for (const entry of qualifiersByDivision) {
      const row = entry.teams?.[rank];
      if (row?.teamId) seeded.push(String(row.teamId));
    }
  }
  return seeded;
};

const resolveHybridPlayoffConfig = (config = {}, divisionCount = 1) => {
  const playoffTeams = Math.max(2, Number(config.playoffTeams) || 4);
  const qualifiersPerDivision = Math.max(0, Number(config.qualifiersPerDivision) || 0);
  const usePerDivision =
    divisionCount > 1 &&
    (qualifiersPerDivision > 0 || config.playoffSeeding === "per_division");
  const perDiv =
    qualifiersPerDivision > 0
      ? qualifiersPerDivision
      : usePerDivision
        ? Math.max(1, Math.floor(playoffTeams / divisionCount))
        : 0;

  return {
    playoffTeams,
    qualifiersPerDivision: perDiv,
    mode:
      divisionCount <= 1
        ? "single_division"
        : perDiv > 0
          ? "per_division"
          : "global",
  };
};

const selectHybridPlayoffQualifiers = (standingsByDivision = {}, divisions = [], config = {}, sport = "cricket") => {
  const divList =
    divisions?.length > 0
      ? sortDivisions(divisions)
      : [{ id: "main", name: "Division 1", order: 1, teamIds: [] }];

  const resolved = resolveHybridPlayoffConfig(config, divList.length);
  const tables = standingsByDivision || {};

  if (resolved.mode === "single_division") {
    const div = divList[0];
    const table = tables[div.id] || tables.main || [];
    const picked = pickQualifyingRows(table, resolved.playoffTeams, sport);
    return {
      mode: resolved.mode,
      teamIds: picked.map((r) => String(r.teamId)),
      qualifiers: [{ divisionId: div.id, divisionName: div.name, teams: picked }],
      playoffTeams: resolved.playoffTeams,
      qualifiersPerDivision: 0,
    };
  }

  if (resolved.mode === "per_division") {
    const qualifiers = [];
    for (const div of divList) {
      const table = tables[div.id] || [];
      const picked = pickQualifyingRows(table, resolved.qualifiersPerDivision, sport);
      if (!picked.length) {
        return {
          error: `${div.name || div.id} has no standings — cannot pick playoff qualifiers`,
          mode: resolved.mode,
          teamIds: [],
          qualifiers: [],
        };
      }
      qualifiers.push({
        divisionId: div.id,
        divisionName: div.name,
        teams: picked,
      });
    }
    const teamIds = seedQualifiersInterleaved(qualifiers);
    if (teamIds.length < 2) {
      return {
        error: "Not enough qualified teams for playoffs (need at least 2)",
        mode: resolved.mode,
        teamIds: [],
        qualifiers,
      };
    }
    return {
      mode: resolved.mode,
      teamIds,
      qualifiers,
      playoffTeams: resolved.playoffTeams,
      qualifiersPerDivision: resolved.qualifiersPerDivision,
    };
  }

  const combined = sortStandingsRows(Object.values(tables).flat(), sport);
  const picked = pickQualifyingRows(combined, resolved.playoffTeams, sport);
  if (picked.length < 2) {
    return {
      error: "Not enough teams in combined standings for playoffs",
      mode: resolved.mode,
      teamIds: [],
      qualifiers: [],
    };
  }
  return {
    mode: resolved.mode,
    teamIds: picked.map((r) => String(r.teamId)),
    qualifiers: [],
    playoffTeams: resolved.playoffTeams,
    qualifiersPerDivision: 0,
  };
};

const summarizeKnockoutBracket = (teamIds = []) => {
  const n = Array.isArray(teamIds) ? teamIds.length : 0;
  if (n < 2) return null;
  let size = 1;
  while (size < n) size *= 2;
  const rounds = [];
  let teamsInRound = size;
  while (teamsInRound > 1) {
    if (teamsInRound <= 2) rounds.push("Final");
    else if (teamsInRound <= 4) rounds.push("Semifinal");
    else if (teamsInRound <= 8) rounds.push("Quarterfinal");
    else rounds.push("Round of 16");
    teamsInRound = Math.floor(teamsInRound / 2);
  }
  return {
    qualifierCount: n,
    bracketSize: size,
    byeCount: size - n,
    rounds: [...rounds].reverse(),
  };
};

const buildLocalPlayoffPreview = (tournament = {}, fixtures = [], standingsByDivision = {}) => {
  const leagueProgress = getLeaguePhaseProgress(fixtures);
  const divisions = tournament.divisions?.length
    ? tournament.divisions
    : [{ id: "main", name: "Division 1", order: 1, teamIds: (tournament.teams || []).map((t) => t.teamId) }];

  const standings = resolveStandingsForPreview(tournament, fixtures, standingsByDivision);

  const selection = selectHybridPlayoffQualifiers(
    standings,
    divisions,
    tournament.config || {},
    tournament.sport,
  );

  const nameById = new Map(
    (tournament.teams || []).map((t) => [String(t.teamId), t.teamName || "Team"]),
  );

  const isBaseball = String(tournament.sport || "").toLowerCase() === "baseball";
  const qualifiers = (selection.qualifiers || []).map((q) => ({
    divisionId: q.divisionId,
    divisionName: q.divisionName,
    teams: (q.teams || []).map((row, idx) => ({
      teamId: String(row.teamId),
      teamName: row.teamName || nameById.get(String(row.teamId)) || "Team",
      points: row.points ?? 0,
      nrr: row.nrr ?? 0,
      winPercentage: row.winPercentage ?? 0,
      runDifferential: row.runDifferential ?? 0,
      pointsFor: row.pointsFor ?? 0,
      pointsAgainst: row.pointsAgainst ?? 0,
      pointDiff: row.pointDiff ?? 0,
      rank: idx + 1,
    })),
  }));

  const seedOrder = (selection.teamIds || []).map((tid, idx) => ({
    seed: idx + 1,
    teamId: String(tid),
    teamName: nameById.get(String(tid)) || "Team",
  }));

  const bracketSummary =
    (selection.teamIds || []).length >= 2
      ? summarizeKnockoutBracket(selection.teamIds)
      : null;

  const ready =
    leagueProgress.complete &&
    !selection.error &&
    (selection.teamIds || []).length >= 2;

  const qpd = selection.qualifiersPerDivision || tournament.config?.qualifiersPerDivision || 0;
  const allTeamsAdvance =
    selection.mode === "per_division" &&
    qpd > 0 &&
    divisions.every((div) => (div.teamIds || []).length <= qpd);

  const isFootball = String(tournament.sport || "").toLowerCase() === "football";
  const isVolleyball = String(tournament.sport || "").toLowerCase() === "volleyball";
  const isBasketball = String(tournament.sport || "").toLowerCase() === "basketball";
  const unit = isFootball || isVolleyball || isBasketball ? "group" : isBaseball ? "pool" : "division";

  return {
    ready,
    leagueProgress,
    seedingMode: selection.mode,
    qualifiers,
    seedOrder,
    bracketSummary,
    qualifiersPerDivision: selection.qualifiersPerDivision,
    playoffTeams: selection.playoffTeams,
    allTeamsAdvance,
    sport: tournament.sport,
    advanceHint: allTeamsAdvance
      ? `Each ${unit} has only ${qpd} team${qpd === 1 ? "" : "s"}, so everyone advances. Edit tournament → set Top 1 per ${unit} to send only ${unit} winners.`
      : null,
    error:
      selection.error ||
      (leagueProgress.complete
        ? null
        : `${leagueProgress.remaining} ${unit} match(es) remaining`),
    source: "local",
  };
};

const extractApiError = (error, fallback = "Could not load preview") => {
  const data = error?.response?.data;
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
  if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return "Network error — showing standings-based preview";
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message.trim();
  return fallback;
};

module.exports = {
  buildLocalPlayoffPreview,
  extractApiError,
};
