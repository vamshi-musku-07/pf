import { applyOptimisticBadmintonUpdate } from "@/components/game/hooks/badmintonState";

const buildState = (sportOverrides = {}) => ({
  sport: {
    score: { home: 10, away: 8 },
    games: [],
    result: { homeGamesWon: 0, awayGamesWon: 0, winner: null },
    matchStatus: "in_progress",
    currentGameNumber: 1,
    servingTeam: "home",
    matchType: "doubles",
    serveState: {
      servingTeam: "home",
      serviceCourt: "right",
      servingPlayerId: "h1",
      receivingPlayerId: "a1",
      home: { leftPlayerId: "h2", rightPlayerId: "h1", rotationOrder: ["h1", "h2"] },
      away: { leftPlayerId: "a2", rightPlayerId: "a1", rotationOrder: ["a1", "a2"] },
    },
    activeBreak: { isActive: false },
    ...sportOverrides,
  },
});

describe("badmintonState", () => {
  test("creates the 11-point interval without changing the opponent score", () => {
    const next = applyOptimisticBadmintonUpdate(buildState(), "pointWon", "home", { _id: "h1" });

    expect(next.sport.score).toEqual({ home: 11, away: 8 });
    expect(next.sport.activeBreak).toEqual(expect.objectContaining({ isActive: true, breakType: "mid_game_interval" }));
    expect(next.sport.serveState).toEqual(expect.objectContaining({ servingTeam: "home", serviceCourt: "left" }));
  });

  test("returns the same state for a let replay", () => {
    const prev = buildState();
    const next = applyOptimisticBadmintonUpdate(prev, "let", "home", { _id: "h1" });

    expect(next).toBe(prev);
  });

  test("completes a game and starts the between-games interval", () => {
    const next = applyOptimisticBadmintonUpdate(
      buildState({ score: { home: 20, away: 17 } }),
      "pointWon",
      "home",
      { _id: "h1" },
    );

    expect(next.sport.games).toHaveLength(1);
    expect(next.sport.games[0]).toEqual(expect.objectContaining({ homeScore: 21, awayScore: 17, winner: "home" }));
    expect(next.sport.currentGameNumber).toBe(2);
    expect(next.sport.score).toEqual({ home: 0, away: 0 });
    expect(next.sport.activeBreak).toEqual(expect.objectContaining({ isActive: true, breakType: "between_games" }));
  });
});