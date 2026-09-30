import { applyOptimisticCricketUpdate } from "@/components/game/hooks/cricketState";

const buildGame = () => ({
  base: { teamId: "H", opponentTeamId: "A", sport: "Cricket" },
  sport: {
    currentInnings: 1,
    totalOvers: 20,
    battingTeamId: "H",
    bowlingTeamId: "A",
    currentOver: 0,
    currentBall: 0,
    score: { home: 0, away: 0 },
    events: [],
    playerStats: [],
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: "H",
        bowlingTeamId: "A",
        total_runs: 0,
        wickets: 0,
        overs_completed: 0,
        balls_completed: 0,
        extras: 0,
      },
    ],
    currentBatsmen: [
      { playerId: "P1", striker: true, runs: 0, balls: 0, fours: 0, sixes: 0, battingOrder: 1 },
      { playerId: "P2", striker: false, runs: 0, balls: 0, fours: 0, sixes: 0, battingOrder: 2 },
    ],
    currentBowler: { playerId: "B1", overNumber: 0, ballsInOver: 0, runsInOver: 0, wicketsInOver: 0, maidens: 0 },
    homeBattingOrder: [
      { playerId: "P1", battingOrder: 1, isOut: false, runs: 0, balls: 0 },
      { playerId: "P2", battingOrder: 2, isOut: false, runs: 0, balls: 0 },
      { playerId: "P3", battingOrder: 3, isOut: false, runs: 0, balls: 0 },
    ],
  },
});

const strikerId = (game) => (game.sport.currentBatsmen.find((b) => b.striker) || {}).playerId;

const score = (game, eventType, runs) =>
  applyOptimisticCricketUpdate(game, {
    eventType,
    playerId: strikerId(game),
    teamId: "H",
    innings: 1,
    runs,
  });

describe("cricket strike rotation (optimistic engine)", () => {
  test("single rotates strike to the non-striker", () => {
    let g = buildGame();
    expect(strikerId(g)).toBe("P1");
    g = score(g, "single", 1);
    expect(strikerId(g)).toBe("P2");
  });

  test("double keeps the same striker", () => {
    let g = buildGame();
    g = score(g, "double", 2);
    expect(strikerId(g)).toBe("P1");
  });

  test("six dot balls (over complete) rotates strike", () => {
    let g = buildGame();
    for (let i = 0; i < 6; i += 1) g = score(g, "dot_ball", 0);
    expect(g.sport.innings[0].overs_completed).toBe(1);
    expect(strikerId(g)).toBe("P2");
  });

  test("single on last ball of over keeps striker (double swap nets out)", () => {
    let g = buildGame();
    for (let i = 0; i < 5; i += 1) g = score(g, "dot_ball", 0);
    expect(strikerId(g)).toBe("P1");
    g = score(g, "single", 1);
    expect(g.sport.innings[0].overs_completed).toBe(1);
    expect(strikerId(g)).toBe("P1");
  });

  test("individual batsman runs accrue to the striker who faced the ball", () => {
    let g = buildGame();
    g = score(g, "single", 1); // P1 faces, scores 1, strike -> P2
    g = score(g, "single", 1); // P2 faces, scores 1, strike -> P1
    const p1 = g.sport.currentBatsmen.find((b) => b.playerId === "P1");
    const p2 = g.sport.currentBatsmen.find((b) => b.playerId === "P2");
    expect(p1.runs).toBe(1);
    expect(p2.runs).toBe(1);
  });
});
