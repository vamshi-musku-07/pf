const LEAGUE_STAGES = new Set(["league"]);

const isLeagueFixture = (fixture, format) => {
  if (format === "round_robin" || format === "hybrid") {
    return fixture.stage === "league" || LEAGUE_STAGES.has(fixture.stage) || !fixture.stage;
  }
  return fixture.stage === "league";
};

const isFixtureOpen = (fixture) =>
  fixture.status !== "completed" && fixture.status !== "bye";

/**
 * Build API payload for tournament position explainer from live tournament data.
 */
export function buildTournamentExplainerPayload({
  tournament,
  standings = [],
  fixtures = [],
  focusTeamId,
}) {
  const teamId = String(focusTeamId || "");
  const format = tournament?.format || "round_robin";
  const rankIdx = standings.findIndex((r) => String(r.teamId) === teamId);
  const focusRow = rankIdx >= 0 ? standings[rankIdx] : null;

  if (!focusRow) return null;

  const remainingFixtures = (fixtures || [])
    .filter((f) => isLeagueFixture(f, format) && isFixtureOpen(f))
    .filter(
      (f) =>
        String(f.homeTeamId) === teamId || String(f.awayTeamId) === teamId,
    )
    .map((f) => {
      const isHome = String(f.homeTeamId) === teamId;
      return {
        label: f.label,
        opponent: isHome ? f.awayTeamName : f.homeTeamName,
        homeAway: isHome ? "home" : "away",
        round: f.round,
      };
    });

  const leagueFixtures = (fixtures || []).filter((f) => isLeagueFixture(f, format));
  const leagueComplete =
    leagueFixtures.length > 0 &&
    leagueFixtures.every((f) => f.status === "completed" || f.status === "bye");

  const standingsForPrompt = standings.map((row, idx) => ({
    rank: idx + 1,
    teamId: String(row.teamId),
    teamName: row.teamName,
    points: row.points ?? 0,
    nrr: row.nrr ?? 0,
    played: row.played ?? 0,
    won: row.won ?? 0,
    lost: row.lost ?? 0,
    tied: row.tied ?? 0,
    noResult: row.noResult ?? 0,
  }));

  return {
    tournamentName: tournament?.name,
    format,
    sport: tournament?.sport || "Cricket",
    config: {
      totalOvers: tournament?.config?.totalOvers,
      pointsWin: tournament?.config?.pointsWin,
      pointsTie: tournament?.config?.pointsTie,
      pointsNoResult: tournament?.config?.pointsNoResult,
      matchFormat: tournament?.config?.matchFormat,
    },
    focusTeamId: teamId,
    focusTeamName: focusRow.teamName,
    focusRank: rankIdx + 1,
    focusRow: {
      points: focusRow.points ?? 0,
      nrr: focusRow.nrr ?? 0,
      played: focusRow.played ?? 0,
      won: focusRow.won ?? 0,
      lost: focusRow.lost ?? 0,
      tied: focusRow.tied ?? 0,
      noResult: focusRow.noResult ?? 0,
    },
    standings: standingsForPrompt,
    remainingFixtures,
    leagueComplete,
    playoffsGenerated: !!tournament?.playoffsGenerated,
    playoffTeams: tournament?.config?.playoffTeams ?? 4,
  };
}

export function pickDefaultExplainerTeamId(standings, hintTeamId) {
  if (!standings?.length) return null;
  if (hintTeamId && standings.some((r) => String(r.teamId) === String(hintTeamId))) {
    return String(hintTeamId);
  }
  return String(standings[0].teamId);
}
