import {
  ballsToOvers,
  buildCricketPlayerNameMap,
  aggregateCricketPlayerStats,
  computeCricketTeamRecord,
  buildCricketLeaderboards,
  getFinishedCricketGames,
  getCricketStatsSummary,
  getGameId,
} from "@/components/game/hooks/cricketStats";

const HOME = "teamHome";
const AWAY = "teamAway";

// A finished cricket game where HOME batted first and won by runs.
const makeGame = ({
  status = "finished",
  sport = "Cricket",
  playerStats = [],
  innings = [],
  totalOvers = 20,
  events = [],
} = {}) => ({
  base: { sport, status, teamId: HOME, opponentTeamId: AWAY },
  sport: { totalOvers, playerStats, innings, events },
});

describe("ballsToOvers", () => {
  test("converts balls to overs notation", () => {
    expect(ballsToOvers(0)).toBe("0");
    expect(ballsToOvers(6)).toBe("1");
    expect(ballsToOvers(13)).toBe("2.1");
    expect(ballsToOvers(5)).toBe("0.5");
  });
});

describe("getFinishedCricketGames", () => {
  test("keeps only finished cricket games", () => {
    const games = [
      makeGame(),
      makeGame({ status: "live" }),
      makeGame({ sport: "Hockey" }),
      { base: { sport: "Cricket", status: "finished" }, sport: {} },
    ];
    expect(getFinishedCricketGames(games)).toHaveLength(2);
    expect(getFinishedCricketGames(null)).toEqual([]);
  });

  test("tolerates flat base docs from the list endpoint", () => {
    // The /games/team list returns flat docs: sport is a string, status is
    // top-level, and there is no `base` wrapper.
    const flat = [
      { _id: "g1", sport: "Cricket", status: "finished" },
      { _id: "g2", sport: "Cricket", status: "live" },
      { _id: "g3", sport: "Hockey", status: "finished" },
    ];
    expect(getFinishedCricketGames(flat)).toHaveLength(1);
    expect(getFinishedCricketGames(flat)[0]._id).toBe("g1");
  });
});

describe("getGameId", () => {
  test("reads id from flat and nested shapes", () => {
    expect(getGameId({ _id: "flat" })).toBe("flat");
    expect(getGameId({ base: { _id: "nested" } })).toBe("nested");
    expect(getGameId({ id: "alt" })).toBe("alt");
    expect(getGameId(null)).toBeNull();
  });
});

describe("buildCricketPlayerNameMap", () => {
  test("roster names win over event names", () => {
    const games = [
      makeGame({
        events: [
          { playerId: "p1", playerName: "Event Name" },
          { playerId: "p2", playerName: "Only Event" },
        ],
      }),
    ];
    const players = [{ _id: "p1", firstName: "Roster", lastName: "One" }];
    const map = buildCricketPlayerNameMap(games, players);
    expect(map.p1).toBe("Roster One");
    expect(map.p2).toBe("Only Event");
  });

  test("supports { home, away } player shape", () => {
    const map = buildCricketPlayerNameMap(
      [],
      { home: [{ _id: "p1", firstName: "Home", lastName: "Player" }], away: [] },
    );
    expect(map.p1).toBe("Home Player");
  });

  test("supports roster id field from player-service API", () => {
    const map = buildCricketPlayerNameMap(
      [],
      [{ id: "p42", firstName: "Virat", lastName: "Kohli", fullName: "Virat Kohli" }],
    );
    expect(map.p42).toBe("Virat Kohli");
  });
});

describe("aggregateCricketPlayerStats", () => {
  test("sums batting & bowling across games and derives rates", () => {
    const games = [
      makeGame({
        playerStats: [
          {
            playerId: "p1",
            teamId: HOME,
            runs: 50,
            balls_faced: 40,
            fours: 5,
            sixes: 2,
            wickets: 1,
            runs_conceded: 20,
            balls_bowled: 24,
            catches: 1,
          },
        ],
      }),
      makeGame({
        playerStats: [
          {
            playerId: "p1",
            teamId: HOME,
            runs: 30,
            balls_faced: 20,
            fours: 3,
            sixes: 1,
            wickets: 3,
            runs_conceded: 18,
            balls_bowled: 24,
          },
        ],
      }),
    ];

    const [p1] = aggregateCricketPlayerStats(games, HOME);
    expect(p1.matches).toBe(2);
    expect(p1.runs).toBe(80);
    expect(p1.balls_faced).toBe(60);
    expect(p1.fours).toBe(8);
    expect(p1.sixes).toBe(3);
    expect(p1.highest_score).toBe(50);
    expect(p1.wickets).toBe(4);
    expect(p1.runs_conceded).toBe(38);
    expect(p1.balls_bowled).toBe(48);
    // 80 runs off 60 balls = 133.33 SR
    expect(Math.round(p1.strike_rate)).toBe(133);
    // 38 runs in 8 overs = 4.75 economy
    expect(Number(p1.economy.toFixed(2))).toBe(4.75);
    expect(p1.overs_bowled).toBe("8");
    // Best bowling = 3/18 (more wickets beats 1/20)
    expect(p1.best_bowling).toEqual({ wickets: 3, runs: 18 });
  });

  test("filters by team when teamId supplied", () => {
    const games = [
      makeGame({
        playerStats: [
          { playerId: "p1", teamId: HOME, runs: 10, balls_faced: 8 },
          { playerId: "o1", teamId: AWAY, runs: 99, balls_faced: 50 },
        ],
      }),
    ];
    const result = aggregateCricketPlayerStats(games, HOME);
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe("p1");
  });
});

describe("computeCricketTeamRecord", () => {
  const inn = (battingTeamId, total_runs, extra = {}) => ({
    battingTeamId,
    total_runs,
    wickets: 0,
    balls_completed: 120,
    ...extra,
  });

  test("counts a win when home defends successfully", () => {
    const game = makeGame({
      innings: [inn(HOME, 180), inn(AWAY, 150, { wickets: 10 })],
    });
    const record = computeCricketTeamRecord([game], HOME);
    expect(record.played).toBe(1);
    expect(record.won).toBe(1);
    expect(record.lost).toBe(0);
    expect(record.win_pct).toBe(100);
  });

  test("counts a loss when the chase succeeds", () => {
    const game = makeGame({
      innings: [inn(HOME, 150), inn(AWAY, 151, { wickets: 4 })],
    });
    const record = computeCricketTeamRecord([game], HOME);
    expect(record.won).toBe(0);
    expect(record.lost).toBe(1);
  });

  test("counts a tie", () => {
    const game = makeGame({
      innings: [inn(HOME, 150), inn(AWAY, 150, { wickets: 10 })],
    });
    const record = computeCricketTeamRecord([game], HOME);
    expect(record.tied).toBe(1);
  });

  test("marks undecided when result cannot be computed", () => {
    const game = makeGame({ innings: [inn(HOME, 150)] });
    const record = computeCricketTeamRecord([game], HOME);
    expect(record.played).toBe(1);
    expect(record.undecided).toBe(1);
    expect(record.won).toBe(0);
    expect(record.lost).toBe(0);
  });
});

describe("buildCricketLeaderboards", () => {
  const aggregated = [
    { playerId: "a", runs: 100, wickets: 2, balls_faced: 60, balls_bowled: 30, strike_rate: 166, economy: 6 },
    { playerId: "b", runs: 40, wickets: 8, balls_faced: 50, balls_bowled: 48, strike_rate: 80, economy: 4 },
    { playerId: "c", runs: 5, wickets: 0, balls_faced: 3, balls_bowled: 0, strike_rate: 166, economy: 0 },
  ];
  const nameMap = { a: "Alice", b: "Bob", c: "Cara" };

  test("orders run scorers and wicket takers correctly", () => {
    const boards = buildCricketLeaderboards(aggregated, nameMap);
    expect(boards.topRunScorers[0].name).toBe("Alice");
    expect(boards.topWicketTakers[0].name).toBe("Bob");
  });

  test("applies minimum-workload thresholds", () => {
    const boards = buildCricketLeaderboards(aggregated, nameMap, {
      minBallsFaced: 12,
      minBallsBowled: 12,
    });
    // Cara faced only 3 balls → excluded from strike-rate board
    expect(boards.bestStrikeRate.some((p) => p.name === "Cara")).toBe(false);
    // Only players with >=12 balls bowled appear in economy board
    expect(boards.bestEconomy.every((p) => p.balls_bowled >= 12)).toBe(true);
    expect(boards.bestEconomy[0].name).toBe("Bob");
  });
});

describe("getCricketStatsSummary", () => {
  test("returns null when there are no finished cricket games", () => {
    expect(getCricketStatsSummary([], { teamId: HOME })).toBeNull();
    expect(
      getCricketStatsSummary([makeGame({ status: "live" })], { teamId: HOME }),
    ).toBeNull();
  });

  test("assembles record, players and leaderboards", () => {
    const games = [
      makeGame({
        innings: [
          { battingTeamId: HOME, total_runs: 180, wickets: 0, balls_completed: 120 },
          { battingTeamId: AWAY, total_runs: 150, wickets: 10, balls_completed: 120 },
        ],
        playerStats: [
          { playerId: "p1", teamId: HOME, runs: 90, balls_faced: 50 },
        ],
        events: [{ playerId: "p1", playerName: "Star Player" }],
      }),
    ];
    const summary = getCricketStatsSummary(games, {
      teamId: HOME,
      players: [{ id: "p1", firstName: "Star", lastName: "Player" }],
    });
    expect(summary).not.toBeNull();
    expect(summary.finishedCount).toBe(1);
    expect(summary.record.won).toBe(1);
    expect(summary.hasPlayerStats).toBe(true);
    expect(summary.players[0].name).toBe("Star Player");
    expect(summary.leaderboards.topRunScorers[0].runs).toBe(90);
    expect(summary.leaderboards.topRunScorers[0].name).toBe("Star Player");
  });
});
