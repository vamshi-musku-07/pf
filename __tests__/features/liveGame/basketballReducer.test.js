import { describe, expect, test } from "@jest/globals";
import { handlers } from "@/features/liveGame/reducers/basketball";
import { LEGACY } from "@/features/liveGame/events/eventTypes";

const apply = handlers[LEGACY.BASKETBALL];

const gameAt = (currentQuarter) => ({
  base: { teamId: "home-team", opponentTeamId: "away-team" },
  sport: {
    currentQuarter,
    score: { home: 0, away: 0 },
    quarterScores: { home: [], away: [] },
    events: [],
  },
});

const event = (body) => ({ payload: { body } });

describe("liveGame basketball reducer — quarter handling", () => {
  test("quarter_transition advances the quarter", () => {
    const next = apply(gameAt(1), event({ eventType: "quarter_transition", quarter: 1 }));
    expect(next.sport.currentQuarter).toBe(2);
  });

  test("a stale event quarter cannot pull the game back", () => {
    // Panel still believes it is Q1 because the transition has not synced yet.
    const next = apply(
      gameAt(2),
      event({ eventType: "point_2", teamSide: "home", quarter: 1 }),
    );

    expect(next.sport.currentQuarter).toBe(2);
    expect(next.sport.quarterScores.home[1].score).toBe(2);
    expect(next.sport.quarterScores.home[0].score).toBe(0);
  });

  test("points land in the resolved quarter and the feed is stamped to match", () => {
    const next = apply(
      gameAt(3),
      event({ eventType: "point_3", teamSide: "away", quarter: 1 }),
    );

    expect(next.sport.score.away).toBe(3);
    expect(next.sport.quarterScores.away[2].score).toBe(3);
    expect(next.sport.events[0].quarter).toBe(3);
  });

  test("a client ahead of the stored quarter pulls it forward", () => {
    const next = apply(
      gameAt(2),
      event({ eventType: "point_2", teamSide: "home", quarter: 3 }),
    );

    expect(next.sport.currentQuarter).toBe(3);
    expect(next.sport.quarterScores.home[2].score).toBe(2);
  });

  test("quarter is capped so a bad payload cannot run away", () => {
    const next = apply(
      gameAt(4),
      event({ eventType: "point_2", teamSide: "home", quarter: 99 }),
    );

    expect(next.sport.currentQuarter).toBe(8);
  });

  test("a full quarter walk keeps score buckets aligned", () => {
    let game = gameAt(1);
    const tap = (body) => {
      game = apply(game, event(body));
    };

    tap({ eventType: "point_2", teamSide: "home", quarter: 1 });
    tap({ eventType: "quarter_transition", quarter: 1 });
    tap({ eventType: "point_3", teamSide: "home", quarter: 1 }); // stale stamp
    tap({ eventType: "quarter_transition", quarter: 2 });
    tap({ eventType: "free_throw", teamSide: "away", quarter: 3 });

    expect(game.sport.currentQuarter).toBe(3);
    expect(game.sport.score).toEqual({ home: 5, away: 1 });
    expect(game.sport.quarterScores.home.map((q) => q.score)).toEqual([2, 3, 0]);
    expect(game.sport.quarterScores.away.map((q) => q.score)).toEqual([0, 0, 1]);
  });
});
