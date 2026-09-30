import {
  applyOptimisticIceHockeyUpdate,
  rollbackOptimisticIceHockeyUpdate,
} from "@/components/game/hooks/iceHockeyState";

const buildGame = (sportOverrides = {}) => ({
  base: {
    teamId: "home-team",
    opponentTeamId: "away-team",
    status: "live",
    sport: "IceHockey",
  },
  sport: {
    score: { home: 1, away: 1 },
    shots: { home: 9, away: 7 },
    faceoffs: { home: 3, away: 4 },
    hits: { home: 2, away: 1 },
    blockedShots: { home: 1, away: 2 },
    takeaways: { home: 0, away: 1 },
    giveaways: { home: 1, away: 0 },
    penaltyMinutes: { home: 0, away: 2 },
    powerPlays: {
      home: { opportunities: 1, goals: 0 },
      away: { opportunities: 0, goals: 0 },
    },
    goalTypes: {
      home: { even_strength: 1, power_play: 0, short_handed: 0, empty_net: 0 },
      away: { even_strength: 1, power_play: 0, short_handed: 0, empty_net: 0 },
    },
    currentPeriod: 2,
    periodTime: "12:34",
    periodScores: [{ period: 1, home: 1, away: 1 }],
    events: [],
    activePenalties: [],
    onIce: {
      home: {
        rosterPlayerIds: ["h1", "h2", "h3"],
        skaterIds: ["h1", "h2"],
        goalieId: "hg",
        goaliePulled: false,
      },
      away: {
        rosterPlayerIds: ["a1", "a2", "a3"],
        skaterIds: ["a1", "a2"],
        goalieId: "ag",
        goaliePulled: false,
      },
    },
    ...sportOverrides,
  },
});

describe("iceHockeyState", () => {
  test("applies and rolls back an optimistic goal", () => {
    const goalEvent = {
      _optimisticId: "opt-goal-1",
      eventType: "goal",
      teamSide: "home",
      teamId: "home-team",
      playerId: "h1",
      goalType: "power_play",
      period: 2,
      gameTime: "12:34",
    };

    const next = applyOptimisticIceHockeyUpdate(buildGame(), goalEvent);

    expect(next.sport.score).toEqual({ home: 2, away: 1 });
    expect(next.sport.shots).toEqual({ home: 10, away: 7 });
    expect(next.sport.goalTypes.home.power_play).toBe(1);
    expect(next.sport.powerPlays.home.goals).toBe(1);
    expect(next.sport.periodScores).toContainEqual({ period: 2, home: 1, away: 0 });
    expect(next.sport.events[0]).toEqual(expect.objectContaining({ _id: "opt-goal-1", optimistic: true }));

    const rolledBack = rollbackOptimisticIceHockeyUpdate(next, goalEvent);

    expect(rolledBack.sport.score).toEqual({ home: 1, away: 1 });
    expect(rolledBack.sport.shots).toEqual({ home: 9, away: 7 });
    expect(rolledBack.sport.goalTypes.home.power_play).toBe(0);
    expect(rolledBack.sport.powerPlays.home.goals).toBe(0);
    expect(rolledBack.sport.events).toHaveLength(0);
  });

  test("applies and rolls back an optimistic penalty", () => {
    const penaltyEvent = {
      _optimisticId: "opt-penalty-1",
      eventType: "penalty",
      teamSide: "away",
      teamId: "away-team",
      playerId: "a1",
      playerName: "Away One",
      penaltyType: "Minor",
      penaltyDuration: 2,
      period: 2,
      gameTime: "10:00",
    };

    const next = applyOptimisticIceHockeyUpdate(buildGame(), penaltyEvent);

    expect(next.sport.penaltyMinutes).toEqual({ home: 0, away: 4 });
    expect(next.sport.powerPlays.home.opportunities).toBe(2);
    expect(next.sport.activePenalties).toEqual([
      expect.objectContaining({ _optimisticId: "opt-penalty-1", teamSide: "away", remainingSeconds: 120 }),
    ]);
    expect(next.sport.onIce.away.skaterIds).toEqual(["a2"]);

    const rolledBack = rollbackOptimisticIceHockeyUpdate(next, penaltyEvent);

    expect(rolledBack.sport.penaltyMinutes).toEqual({ home: 0, away: 2 });
    expect(rolledBack.sport.powerPlays.home.opportunities).toBe(1);
    expect(rolledBack.sport.activePenalties).toHaveLength(0);
    expect(rolledBack.sport.events).toHaveLength(0);
  });

  test("rolls back on-ice changes from the saved snapshot", () => {
    const previousOnIce = buildGame().sport.onIce;
    const lineChangeEvent = {
      _optimisticId: "opt-line-1",
      eventType: "line_change",
      teamSide: "home",
      teamId: "home-team",
      outPlayerId: "h1",
      inPlayerId: "h3",
      _previousOnIce: previousOnIce,
    };

    const next = applyOptimisticIceHockeyUpdate(buildGame(), lineChangeEvent);

    expect(next.sport.onIce.home.skaterIds).toEqual(["h2", "h3"]);

    const rolledBack = rollbackOptimisticIceHockeyUpdate(next, lineChangeEvent);

    expect(rolledBack.sport.onIce.home.skaterIds).toEqual(["h1", "h2"]);
    expect(rolledBack.sport.events).toHaveLength(0);
  });
});
