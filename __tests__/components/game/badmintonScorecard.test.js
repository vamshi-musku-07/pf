import {
  buildBadmintonPointProgressions,
  buildBadmintonMatchStats,
  buildBadmintonGameTable,
  buildBadmintonScorecard,
} from "../../../components/game/badminton/badmintonScorecard";

describe("badmintonScorecard", () => {
  const base = { teamId: "home-team", opponentTeamId: "away-team" };
  const names = { home: "Falcons", away: "Shuttlers" };

  const sport = {
    matchStatus: "in_progress",
    currentGameNumber: 2,
    score: { home: 5, away: 3 },
    result: { homeGamesWon: 1, awayGamesWon: 0 },
    games: [
      { gameNumber: 1, homeScore: 21, awayScore: 12, winner: "home", isCompleted: true },
    ],
    events: [
      { eventType: "pointWon", teamId: "home-team", gameNumber: 1 },
      { eventType: "pointWon", teamId: "home-team", gameNumber: 1 },
      { eventType: "smash", teamId: "away-team", gameNumber: 1 },
      { eventType: "fault", teamId: "away-team", gameNumber: 1 },
      { eventType: "pointWon", teamId: "home-team", gameNumber: 2 },
      { eventType: "pointWon", teamId: "away-team", gameNumber: 2 },
      { eventType: "pointWon", teamId: "home-team", gameNumber: 2 },
    ],
  };

  test("builds point progressions and awards fault to opponent", () => {
    const { games, matchStarted } = buildBadmintonPointProgressions(sport, base);
    expect(matchStarted).toBe(true);
    const g1 = games.find((g) => g.gameNumber === 1);
    expect(g1.snapshots.length).toBeGreaterThan(1);
    // fault by away → home point
    const afterFault = g1.snapshots.find((s) => s.eventType === "fault");
    expect(afterFault.award).toBe("home");
  });

  test("game table shows 1st/2nd/3rd columns and viewer order", () => {
    const table = buildBadmintonGameTable(sport, names, "home", base);
    expect(table.gameColumns.length).toBeGreaterThanOrEqual(2);
    expect(table.rows[0].side).toBe("home");
    expect(table.rows[0].name).toBe("Falcons");
  });

  test("stats filter ALL vs 1ST", () => {
    const all = buildBadmintonMatchStats(sport, base, "all");
    const first = buildBadmintonMatchStats(sport, base, 1);
    expect(all.setOptions[0].label).toBe("ALL");
    expect(all.home.pointsWon).toBeGreaterThanOrEqual(first.home.pointsWon);
    expect(all.home.smashes + all.away.smashes).toBeGreaterThanOrEqual(1);
  });

  test("scorecard includes expandable detail games", () => {
    const card = buildBadmintonScorecard(sport, names, base, "all", "home");
    expect(card.detailGames.length).toBeGreaterThan(0);
    expect(card.sections[0].rows.map((r) => r.key)).toContain("pointsWon");
    expect(card.leftName).toBe("Falcons");
  });
});
