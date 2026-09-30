import {
  buildTennisSetTable,
  buildTennisMatchStats,
  buildTennisScorecard,
  formatTennisDiff,
} from "../../../components/game/tennis/tennisScorecard";

describe("tennisScorecard", () => {
  const base = { teamId: "home-team", opponentTeamId: "away-team" };
  const names = { home: "Oliynykova", away: "Romero" };

  test("formats Diff like SofaScore", () => {
    expect(formatTennisDiff(4)).toBe("+4");
    expect(formatTennisDiff(-2)).toBe("-2");
    expect(formatTennisDiff(0)).toBe("0");
  });

  test("set table P / Diff / PTS from completed + live sets", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 3,
      score: { home: 1, away: 1 },
      currentGameScore: { home: 2, away: 1 },
      sets: [
        { setNumber: 1, homeGames: 7, awayGames: 6, winner: "home", isTiebreaker: true },
        { setNumber: 2, homeGames: 3, awayGames: 6, winner: "away" },
      ],
    };

    const table = buildTennisSetTable(sport, names);
    expect(table.setColumns).toHaveLength(3);
    expect(table.setColumns[2].live).toBe(true);
    expect(table.homeSetsWon).toBe(1);
    expect(table.awaySetsWon).toBe(1);

    const home = table.rows.find((r) => r.side === "home");
    const away = table.rows.find((r) => r.side === "away");
    expect(home.P).toBe(7 + 3 + 2);
    expect(away.P).toBe(6 + 6 + 1);
    expect(home.Diff).toBe((7 + 3 + 2) - (6 + 6 + 1));
    expect(away.Diff).toBe(-home.Diff);
    expect(home.PTS).toBe(1);
    expect(away.PTS).toBe(1);
  });

  test("match stats award double_fault point to opponent", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 1,
      currentGameScore: { home: 0, away: 0 },
      sets: [],
      events: [
        { eventType: "ace", teamId: "home-team", setNumber: 1 },
        { eventType: "pointWon", teamId: "home-team", setNumber: 1 },
        { eventType: "double_fault", teamId: "home-team", setNumber: 1 },
        { eventType: "winner", teamId: "away-team", setNumber: 1 },
        { eventType: "let", teamId: "home-team", setNumber: 1 },
      ],
    };

    const stats = buildTennisMatchStats(sport, base, "all");
    expect(stats.home.aces).toBe(1);
    expect(stats.home.doubleFaults).toBe(1);
    expect(stats.home.pointsWon).toBe(2); // ace + pointWon
    expect(stats.away.pointsWon).toBe(2); // DF award + winner
    expect(stats.away.winners).toBe(1);
  });

  test("set filter isolates events to one set", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 2,
      currentGameScore: { home: 1, away: 0 },
      score: { home: 1, away: 0 },
      sets: [{ setNumber: 1, homeGames: 6, awayGames: 4, winner: "home" }],
      events: [
        { eventType: "ace", teamSide: "home", setNumber: 1 },
        { eventType: "ace", teamSide: "home", setNumber: 1 },
        { eventType: "ace", teamSide: "away", setNumber: 2 },
      ],
    };

    const set1 = buildTennisMatchStats(sport, base, 1);
    expect(set1.home.aces).toBe(2);
    expect(set1.away.aces).toBe(0);
    expect(set1.home.gamesWon).toBe(6);
    expect(set1.away.gamesWon).toBe(4);
    expect(set1.home.setsWon).toBe(1);

    const set2 = buildTennisMatchStats(sport, base, 2);
    expect(set2.home.aces).toBe(0);
    expect(set2.away.aces).toBe(1);
    expect(set2.home.gamesWon).toBe(1);
    expect(set2.away.gamesWon).toBe(0);
  });

  test("scorecard combines table + sections", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 1,
      currentGameScore: { home: 3, away: 2 },
      sets: [],
      events: [{ eventType: "ace", teamSide: "home", setNumber: 1 }],
    };
    const card = buildTennisScorecard(sport, names, base, "all");
    expect(card.matchStarted).toBe(true);
    expect(card.sections.length).toBeGreaterThan(0);
    expect(card.stats.setOptions[0].id).toBe("all");
    expect(card.stats.home.aces).toBe(1);
  });

  test("rows follow userSide order (your team left)", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 1,
      currentGameScore: { home: 1, away: 3 },
      score: { home: 0, away: 1 },
      sets: [{ setNumber: 1, homeGames: 2, awayGames: 6, winner: "away" }],
    };
    const asHome = buildTennisSetTable(sport, names, "home");
    expect(asHome.rows[0].side).toBe("home");
    expect(asHome.rows[0].name).toBe("Oliynykova");
    expect(asHome.rows[1].side).toBe("away");

    const asAway = buildTennisSetTable(sport, names, "away");
    expect(asAway.rows[0].side).toBe("away");
    expect(asAway.rows[0].name).toBe("Romero");
    expect(asAway.rows[1].side).toBe("home");
    expect(asAway.rows[1].name).toBe("Oliynykova");
  });

  test("stat bars left/right match userSide", () => {
    const sport = {
      matchStatus: "in_progress",
      currentSetNumber: 1,
      currentGameScore: { home: 0, away: 0 },
      sets: [],
      events: [
        { eventType: "ace", teamSide: "away", setNumber: 1 },
        { eventType: "ace", teamSide: "away", setNumber: 1 },
        { eventType: "pointWon", teamSide: "home", setNumber: 1 },
      ],
    };
    const card = buildTennisScorecard(sport, names, base, "all", "away");
    expect(card.leftName).toBe("Romero");
    expect(card.rightName).toBe("Oliynykova");
    expect(card.leftStats.aces).toBe(2);
    expect(card.rightStats.aces).toBe(0);
    expect(card.sections[0].rows.find((r) => r.key === "aces").left).toBe(2);
  });

  test("scheduled match still shows live Set 1 at 0-0", () => {
    const table = buildTennisSetTable({ matchStatus: "scheduled", sets: [], currentSetNumber: 1, currentGameScore: { home: 0, away: 0 } });
    expect(table.matchStarted).toBe(true);
    expect(table.setColumns).toHaveLength(1);
    expect(table.setColumns[0].homeGames).toBe(0);
    expect(table.setColumns[0].live).toBe(true);
  });
});
