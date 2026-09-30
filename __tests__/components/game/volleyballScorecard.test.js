import {
  buildVolleyballScorecard,
  formatVolleyballDiff,
  isVolleyballSetComplete,
  resolveVolleyballSetWinner,
  getVolleyballMinPoints,
} from "../../../components/game/volleyball/volleyballScorecard";

describe("volleyballScorecard", () => {
  test("deciding set needs 15 points", () => {
    expect(getVolleyballMinPoints(5, 5)).toBe(15);
    expect(getVolleyballMinPoints(1, 5)).toBe(25);
    expect(getVolleyballMinPoints(3, 3)).toBe(15);
  });

  test("set complete requires min points and win by 2", () => {
    expect(isVolleyballSetComplete({ setNumber: 1, homeScore: 25, awayScore: 23 })).toBe(true);
    expect(isVolleyballSetComplete({ setNumber: 1, homeScore: 25, awayScore: 24 })).toBe(false);
    expect(isVolleyballSetComplete({ setNumber: 1, homeScore: 24, awayScore: 22 })).toBe(false);
    expect(isVolleyballSetComplete({ setNumber: 5, homeScore: 15, awayScore: 13, winner: null }, 5)).toBe(true);
    expect(isVolleyballSetComplete({ setNumber: 1, winner: "home", homeScore: 10, awayScore: 0 })).toBe(true);
  });

  test("resolve winner from scores when winner field missing", () => {
    expect(resolveVolleyballSetWinner({ setNumber: 1, homeScore: 25, awayScore: 20 })).toBe("home");
    expect(resolveVolleyballSetWinner({ setNumber: 2, homeScore: 22, awayScore: 25 })).toBe("away");
    expect(resolveVolleyballSetWinner({ setNumber: 1, homeScore: 20, awayScore: 18 })).toBe(null);
  });

  test("scorecard P / Diff / PTS match set totals", () => {
    const sport = {
      currentSet: 3,
      totalSets: 5,
      matchStatus: "set_3",
      sets: [
        { setNumber: 1, homeScore: 25, awayScore: 20, winner: "home" },
        { setNumber: 2, homeScore: 22, awayScore: 25, winner: "away" },
        { setNumber: 3, homeScore: 10, awayScore: 8, winner: null },
      ],
    };

    const card = buildVolleyballScorecard(sport, { home: "Volley2", away: "Volley1" });

    expect(card.homeSetsWon).toBe(1);
    expect(card.awaySetsWon).toBe(1);
    expect(card.homePoints).toBe(25 + 22 + 10);
    expect(card.awayPoints).toBe(20 + 25 + 8);
    expect(card.matchScoreLabel).toBe("1 – 1");

    const home = card.rows.find((r) => r.side === "home");
    const away = card.rows.find((r) => r.side === "away");

    expect(home.P).toBe(57);
    expect(away.P).toBe(53);
    expect(home.Diff).toBe(4);
    expect(away.Diff).toBe(-4);
    expect(home.PTS).toBe(1);
    expect(away.PTS).toBe(1);
    expect(formatVolleyballDiff(home.Diff)).toBe("+4");
    expect(formatVolleyballDiff(away.Diff)).toBe("-4");
    expect(card.setColumns).toHaveLength(3);
    expect(card.setColumns[2].live).toBe(true);
    expect(card.setColumns[2].homeScore).toBe(10);
  });

  test("PTS ignores stale result.setsWon and uses set winners", () => {
    const sport = {
      currentSet: 2,
      totalSets: 5,
      matchStatus: "set_2",
      result: { setsWon: { home: 9, away: 9 } },
      sets: [
        { setNumber: 1, homeScore: 25, awayScore: 18, winner: "home" },
        { setNumber: 2, homeScore: 5, awayScore: 3 },
      ],
    };
    const card = buildVolleyballScorecard(sport);
    expect(card.homeSetsWon).toBe(1);
    expect(card.awaySetsWon).toBe(0);
    const home = card.rows.find((r) => r.side === "home");
    expect(home.PTS).toBe(1);
    expect(home.P).toBe(30);
    expect(home.Diff).toBe(25 + 5 - (18 + 3));
  });

  test("empty scheduled match has no fake sets", () => {
    const card = buildVolleyballScorecard({ matchStatus: "scheduled", sets: [], currentSet: 1 });
    expect(card.matchStarted).toBe(false);
    expect(card.setColumns).toHaveLength(0);
    expect(card.homeSetsWon).toBe(0);
    expect(card.awaySetsWon).toBe(0);
  });

  test("infers completed set without winner field", () => {
    const sport = {
      currentSet: 2,
      totalSets: 5,
      matchStatus: "set_2",
      sets: [
        { setNumber: 1, homeScore: 26, awayScore: 24 },
        { setNumber: 2, homeScore: 0, awayScore: 0 },
      ],
    };
    const card = buildVolleyballScorecard(sport);
    expect(card.homeSetsWon).toBe(1);
    expect(card.awaySetsWon).toBe(0);
    expect(card.setColumns[0].complete).toBe(true);
    expect(card.setColumns[0].winner).toBe("home");
  });

  test("leader sorts by PTS then Diff", () => {
    const sport = {
      currentSet: 3,
      totalSets: 5,
      matchStatus: "set_3",
      sets: [
        { setNumber: 1, homeScore: 25, awayScore: 20, winner: "home" },
        { setNumber: 2, homeScore: 25, awayScore: 18, winner: "home" },
        { setNumber: 3, homeScore: 12, awayScore: 15, winner: null },
      ],
    };
    const card = buildVolleyballScorecard(sport, { home: "A", away: "B" });
    expect(card.rows[0].side).toBe("home");
    expect(card.rows[0].PTS).toBe(2);
    expect(card.rows[1].PTS).toBe(0);
  });
});
