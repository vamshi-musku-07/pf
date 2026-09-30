const { test } = require("node:test");
const assert = require("node:assert");

const formatFixtureDateTime = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return null;
  }
};

const getTeamLeagueFixtures = (fixtures = [], teamId) => {
  const tid = String(teamId);
  return (fixtures || [])
    .filter((f) => f.stage === "league")
    .filter((f) => String(f.homeTeamId) === tid || String(f.awayTeamId) === tid)
    .filter((f) => f.status === "completed" || f.status === "bye");
};

const describeTeamMatchResult = (fixture, teamId) => {
  const tid = String(teamId);
  const isHome = String(fixture.homeTeamId) === tid;
  const opponentName = isHome
    ? fixture.awayTeamName || fixture.awaySource || "Opponent"
    : fixture.homeTeamName || fixture.homeSource || "Opponent";

  if (fixture.status === "bye") {
    return { fixture, opponentName, outcome: "BYE", summary: "Bye", margin: "", gameId: null };
  }

  const res = fixture.result;
  if (!res) {
    return { fixture, opponentName, outcome: "?", summary: `vs ${opponentName}`, margin: "", gameId: fixture.gameId };
  }
  if (res.isNoResult) {
    return { fixture, opponentName, outcome: "NR", summary: `vs ${opponentName}`, margin: res.margin || "No result", gameId: fixture.gameId };
  }
  if (res.isTie || !res.winnerTeamId) {
    return { fixture, opponentName, outcome: "T", summary: `vs ${opponentName}`, margin: res.margin || "Tie", gameId: fixture.gameId };
  }
  const won = String(res.winnerTeamId) === tid;
  return {
    fixture,
    opponentName,
    outcome: won ? "W" : "L",
    summary: won ? `Beat ${opponentName}` : `Lost to ${opponentName}`,
    margin: res.margin || (won ? "Won" : "Lost"),
    gameId: fixture.gameId,
    scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
  };
};

const buildTeamMatchHistory = (fixtures = [], teamId) =>
  getTeamLeagueFixtures(fixtures, teamId)
    .map((fixture) => describeTeamMatchResult(fixture, teamId))
    .sort((a, b) => (b.fixture?.matchNumber || 0) - (a.fixture?.matchNumber || 0));

const mergeTeamsWithStandings = (teams = [], standings = []) => {
  const byId = Object.fromEntries((standings || []).map((row) => [String(row.teamId), row]));
  return (teams || []).map((team) => ({
    ...team,
    stats: byId[String(team.teamId)] || null,
  }));
};

const sortTeamsForDisplay = (teams = [], standings = []) => {
  const rank = new Map((standings || []).map((row, idx) => [String(row.teamId), idx]));
  return [...teams].sort((a, b) => {
    const ra = rank.get(String(a.teamId));
    const rb = rank.get(String(b.teamId));
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return (a.teamName || "").localeCompare(b.teamName || "");
  });
};

test("getTeamLeagueFixtures: only completed league matches for team", () => {
  const fixtures = [
    { stage: "league", status: "completed", homeTeamId: "A", awayTeamId: "B", matchNumber: 1 },
    { stage: "league", status: "pending", homeTeamId: "A", awayTeamId: "C", matchNumber: 2 },
    { stage: "quarterfinal", status: "completed", homeTeamId: "A", awayTeamId: "D", matchNumber: 3 },
    { stage: "league", status: "completed", homeTeamId: "B", awayTeamId: "A", matchNumber: 4 },
  ];
  const list = getTeamLeagueFixtures(fixtures, "A");
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual(list.map((f) => f.matchNumber), [1, 4]);
});

test("describeTeamMatchResult: win with margin", () => {
  const fixture = {
    _id: "fx1",
    matchNumber: 2,
    homeTeamId: "A",
    homeTeamName: "Alpha",
    awayTeamId: "B",
    awayTeamName: "Beta",
    status: "completed",
    gameId: "game1",
    result: {
      winnerTeamId: "A",
      isTie: false,
      isNoResult: false,
      margin: "25 runs",
      home: { runs: 160, wickets: 6 },
      away: { runs: 135, wickets: 10 },
    },
  };
  const entry = describeTeamMatchResult(fixture, "A");
  assert.strictEqual(entry.outcome, "W");
  assert.strictEqual(entry.opponentName, "Beta");
  assert.strictEqual(entry.margin, "25 runs");
  assert.strictEqual(entry.gameId, "game1");
});

test("describeTeamMatchResult: loss and no-result", () => {
  const loss = describeTeamMatchResult(
    {
      homeTeamId: "A",
      awayTeamId: "B",
      awayTeamName: "Beta",
      status: "completed",
      result: { winnerTeamId: "B", isTie: false, isNoResult: false, margin: "3 wickets" },
    },
    "A",
  );
  assert.strictEqual(loss.outcome, "L");

  const nr = describeTeamMatchResult(
    {
      homeTeamId: "A",
      awayTeamId: "B",
      awayTeamName: "Beta",
      status: "completed",
      result: { isNoResult: true, margin: "Abandoned" },
    },
    "A",
  );
  assert.strictEqual(nr.outcome, "NR");
});

test("buildTeamMatchHistory sorts newest match first", () => {
  const fixtures = [
    {
      _id: "1",
      stage: "league",
      status: "completed",
      matchNumber: 1,
      homeTeamId: "A",
      awayTeamId: "B",
      awayTeamName: "B",
      result: { winnerTeamId: "A", isTie: false, isNoResult: false },
    },
    {
      _id: "2",
      stage: "league",
      status: "completed",
      matchNumber: 3,
      homeTeamId: "C",
      awayTeamId: "A",
      homeTeamName: "C",
      result: { winnerTeamId: "A", isTie: false, isNoResult: false, margin: "5 runs" },
    },
  ];
  const history = buildTeamMatchHistory(fixtures, "A");
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].fixture.matchNumber, 3);
  assert.strictEqual(history[1].fixture.matchNumber, 1);
});

test("mergeTeamsWithStandings and sortTeamsForDisplay", () => {
  const teams = [
    { teamId: "B", teamName: "Beta" },
    { teamId: "A", teamName: "Alpha" },
  ];
  const standings = [
    { teamId: "A", points: 4, played: 2, won: 2, lost: 0, nrr: 1.2 },
    { teamId: "B", points: 2, played: 2, won: 1, lost: 1, nrr: 0.1 },
  ];
  const merged = mergeTeamsWithStandings(teams, standings);
  assert.strictEqual(merged.find((t) => t.teamId === "A").stats.points, 4);
  const sorted = sortTeamsForDisplay(merged, standings);
  assert.strictEqual(sorted[0].teamId, "A");
  assert.strictEqual(sorted[1].teamId, "B");
});
