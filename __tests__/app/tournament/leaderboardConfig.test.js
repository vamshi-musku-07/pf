const { test } = require("node:test");
const assert = require("node:assert");
const {
  buildTournamentPlayerNameMap,
  buildTournamentPlayerProfileMap,
  buildNameMapFromLeaderboard,
  buildProfileMapFromLeaderboard,
  mergePlayerNameMaps,
  mergeProfileMaps,
  resolvePlayerDisplayName,
  resolvePlayerProfileImage,
  buildLeaderboardSections,
  hasLeaderboardData,
  sortPlayersForStats,
  formatBattingSummary,
  formatBowlingSummary,
  formatFieldingSummary,
} = require("../../../features/tournament/leaderboardConfig");

test("buildTournamentPlayerNameMap resolves roster names", () => {
  const map = buildTournamentPlayerNameMap([
    { _id: "p1", firstName: "Virat", lastName: "Kohli" },
    { id: "p2", fullName: "Jasprit Bumrah" },
  ]);
  assert.strictEqual(map.p1, "Virat Kohli");
  assert.strictEqual(map.p2, "Jasprit Bumrah");
});

test("resolvePlayerDisplayName falls back to short id", () => {
  assert.strictEqual(resolvePlayerDisplayName("abc12345", {}), "Player 2345");
  assert.strictEqual(resolvePlayerDisplayName("p1", { p1: "Star" }), "Star");
});

test("resolvePlayerDisplayName prefers playerName on row", () => {
  assert.strictEqual(
    resolvePlayerDisplayName("p1", {}, "", { playerId: "p1", playerName: "Rohit Sharma" }),
    "Rohit Sharma",
  );
});

test("buildNameMapFromLeaderboard handles null leaderboard", () => {
  assert.deepStrictEqual(buildNameMapFromLeaderboard(null), {});
  assert.deepStrictEqual(buildProfileMapFromLeaderboard(null), {});
});

test("buildNameMapFromLeaderboard merges nameMap and player rows", () => {
  const map = buildNameMapFromLeaderboard({
    nameMap: { p1: "From Map" },
    players: [{ playerId: "p2", playerName: "From Row" }],
  });
  assert.strictEqual(map.p1, "From Map");
  assert.strictEqual(map.p2, "From Row");
});

test("mergePlayerNameMaps overlays later maps", () => {
  const merged = mergePlayerNameMaps({ p1: "A" }, { p2: "B" }, { p1: "Override" });
  assert.deepStrictEqual(merged, { p1: "Override", p2: "B" });
});

test("buildTournamentPlayerNameMap maps userId", () => {
  const map = buildTournamentPlayerNameMap([{ _id: "p1", userId: "u9", firstName: "MS", lastName: "Dhoni" }]);
  assert.strictEqual(map.p1, "MS Dhoni");
  assert.strictEqual(map.u9, "MS Dhoni");
});

test("buildTournamentPlayerProfileMap maps player images", () => {
  const map = buildTournamentPlayerProfileMap([
    { _id: "p1", playerimage: "https://cdn/a.jpg" },
    { id: "p2", profilePicture: "https://cdn/b.jpg", userId: "u2" },
  ]);
  assert.strictEqual(map.p1, "https://cdn/a.jpg");
  assert.strictEqual(map.p2, "https://cdn/b.jpg");
  assert.strictEqual(map.u2, "https://cdn/b.jpg");
});

test("resolvePlayerProfileImage prefers row image then map", () => {
  assert.strictEqual(
    resolvePlayerProfileImage("p1", {}, { playerId: "p1", profileImage: "https://row" }),
    "https://row",
  );
  assert.strictEqual(resolvePlayerProfileImage("p1", { p1: "https://map" }), "https://map");
});

test("buildLeaderboardSections formats bat and mvp rows", () => {
  const leaderboards = {
    topRunScorers: [{ playerId: "p1", teamId: "t1", teamName: "Lions", runs: 120, strike_rate: 145 }],
    mvp: [{ playerId: "p1", teamId: "t1", teamName: "Lions", mvpPoints: 88, runs: 120, wickets: 2 }],
  };
  const nameMap = { p1: "Alex" };
  const profileMap = { p1: "https://cdn/alex.jpg" };
  const bat = buildLeaderboardSections("Bat", leaderboards, nameMap, profileMap);
  assert.strictEqual(bat[0].key, "topRunScorers");
  assert.strictEqual(bat[0].rows[0].name, "Alex");
  assert.strictEqual(bat[0].rows[0].profileImage, "https://cdn/alex.jpg");
  assert.strictEqual(bat[0].rows[0].primary, "120");

  const mvp = buildLeaderboardSections("MVP", leaderboards, nameMap, profileMap);
  assert.strictEqual(mvp[0].rows[0].primary, "88");
  assert.match(mvp[0].rows[0].secondary, /120 runs/);
});

test("buildLeaderboardSections formats football goals rows", () => {
  const leaderboards = {
    topGoalScorers: [{ playerId: "p1", teamId: "t1", teamName: "United", goals: 5, assists: 2 }],
  };
  const sections = buildLeaderboardSections("Goals", leaderboards, { p1: "Messi" }, {}, "Football");
  assert.strictEqual(sections[0].key, "topGoalScorers");
  assert.strictEqual(sections[0].rows[0].primary, "5");
  assert.match(sections[0].rows[0].secondary, /2 assists/);
});

test("hasLeaderboardData detects empty boards", () => {
  assert.strictEqual(hasLeaderboardData({}), false);
  assert.strictEqual(hasLeaderboardData({ topRunScorers: [] }), false);
  assert.strictEqual(hasLeaderboardData({ topRunScorers: [{ runs: 1 }] }), true);
});

test("sortPlayersForStats orders by runs wickets mvp and economy", () => {
  const players = [
    { playerId: "a", runs: 40, wickets: 1, mvpPoints: 50, economy: 8 },
    { playerId: "b", runs: 80, wickets: 0, mvpPoints: 70, economy: 6 },
    { playerId: "c", runs: 60, wickets: 3, mvpPoints: 90, economy: 7 },
  ];
  assert.strictEqual(sortPlayersForStats(players, "runs")[0].playerId, "b");
  assert.strictEqual(sortPlayersForStats(players, "wickets")[0].playerId, "c");
  assert.strictEqual(sortPlayersForStats(players, "mvpPoints")[0].playerId, "c");
  assert.strictEqual(sortPlayersForStats(players, "economy")[0].playerId, "b");
});

test("format summaries for stats rows", () => {
  const player = {
    runs: 45,
    balls_faced: 30,
    batting_average: 22.5,
    strike_rate: 150,
    wickets: 2,
    overs_bowled: "4.0",
    economy: 6.5,
    best_bowling: { wickets: 2, runs: 18 },
    catches: 1,
    stumpings: 1,
    run_outs: 0,
  };
  assert.match(formatBattingSummary(player), /45 \(30\)/);
  assert.match(formatBowlingSummary(player), /2 wkts/);
  assert.match(formatFieldingSummary(player), /1 ct/);
});

test("filterLeaderboardByTeam and filterPlayersByTeam scope to one team", () => {
  const { filterLeaderboardByTeam, filterPlayersByTeam, resolveTeamFilterLabel } = require("../../../features/tournament/leaderboardConfig");
  const leaderboards = {
    topRunScorers: [
      { playerId: "p1", teamId: "t1", runs: 50 },
      { playerId: "p2", teamId: "t2", runs: 80 },
    ],
  };
  const players = [
    { playerId: "p1", teamId: "t1", runs: 50 },
    { playerId: "p2", teamId: "t2", runs: 80 },
  ];
  const filteredBoards = filterLeaderboardByTeam(leaderboards, "t2");
  assert.strictEqual(filteredBoards.topRunScorers.length, 1);
  assert.strictEqual(filteredBoards.topRunScorers[0].playerId, "p2");

  const filteredPlayers = filterPlayersByTeam(players, "t1");
  assert.strictEqual(filteredPlayers.length, 1);
  assert.strictEqual(filteredPlayers[0].playerId, "p1");

  assert.strictEqual(filterLeaderboardByTeam(leaderboards, null).topRunScorers.length, 2);
  assert.strictEqual(resolveTeamFilterLabel([{ teamId: "t1", teamName: "Lions" }], "t1"), "Lions");
  assert.strictEqual(resolveTeamFilterLabel([{ teamId: "t1", teamName: "Lions" }], null), "All teams");
});
