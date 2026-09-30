import {
  aggregateFootballEventStats,
  buildFootballMatchComparisonStats,
} from "@/components/game/hooks/footballMatchComparisonStats";
import {
  buildCricketMatchComparisonStats,
  buildCricketStatPeriods,
} from "@/components/game/hooks/cricketMatchComparisonStats";

describe("footballMatchComparisonStats", () => {
  const homeTeamId = "home1";
  const events = [
    { eventType: "shot_on_target", teamId: "home1", period: 1 },
    { eventType: "shot_off_target", teamId: "away1", period: 1 },
    { eventType: "corner", teamId: "home1", period: 1 },
    { eventType: "goal", teamId: "away1", period: 2 },
    { eventType: "foul", teamId: "home1", period: 2 },
    { eventType: "yellow_card", teamId: "away1", period: 2 },
    { eventType: "save", teamId: "home1", period: 2 },
  ];

  test("aggregates by period", () => {
    const first = aggregateFootballEventStats(events, homeTeamId, 1);
    expect(first.total_shots).toEqual({ home: 1, away: 1 });
    expect(first.corners).toEqual({ home: 1, away: 0 });
    expect(first.goals).toEqual({ home: 0, away: 0 });

    const second = aggregateFootballEventStats(events, homeTeamId, 2);
    expect(second.goals).toEqual({ home: 0, away: 1 });
    expect(second.fouls).toEqual({ home: 1, away: 0 });
    expect(second.yellow_cards).toEqual({ home: 0, away: 1 });
    expect(second.saves).toEqual({ home: 1, away: 0 });
  });

  test("buildFootballMatchComparisonStats uses matchStats on ALL", () => {
    const sport = {
      matchStats: {
        possession: { home: 62, away: 38 },
        total_shots: { home: 8, away: 3 },
        shots_on_target: { home: 4, away: 1 },
        corners: { home: 5, away: 2 },
        fouls: { home: 7, away: 9 },
        offsides: { home: 0, away: 0 },
        yellow_cards: { home: 1, away: 2 },
        red_cards: { home: 0, away: 0 },
      },
      events,
      playerStats: [],
    };
    const all = buildFootballMatchComparisonStats({ sport, homeTeamId, period: "all" });
    expect(all.possession).toEqual({ home: 62, away: 38 });
    expect(all.rows.find((r) => r.key === "total_shots")).toMatchObject({ home: 8, away: 3 });

    const first = buildFootballMatchComparisonStats({ sport, homeTeamId, period: 1 });
    expect(first.rows.find((r) => r.key === "corners")).toMatchObject({ home: 1, away: 0 });
  });
});

describe("cricketMatchComparisonStats", () => {
  const sport = {
    currentInnings: 2,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: "home1",
        bowlingTeamId: "away1",
        total_runs: 145,
        wickets: 6,
        overs_completed: 20,
        extras: 12,
      },
      {
        inningsNumber: 2,
        battingTeamId: "away1",
        bowlingTeamId: "home1",
        total_runs: 120,
        wickets: 4,
        overs_completed: 18,
        extras: 8,
      },
    ],
    playerStats: [
      { teamId: "home1", fours: 10, sixes: 4, dot_balls: 30 },
      { teamId: "away1", fours: 8, sixes: 2, dot_balls: 40 },
    ],
    events: [
      { eventType: "boundary_4", innings: 1 },
      { eventType: "boundary_6", innings: 1 },
      { eventType: "dot_ball", innings: 1 },
    ],
  };

  test("ALL aggregates both innings by batting/bowling side", () => {
    const all = buildCricketMatchComparisonStats({
      sport,
      homeTeamId: "home1",
      awayTeamId: "away1",
      period: "all",
    });
    expect(all.rows.find((r) => r.key === "runs")).toMatchObject({ home: 145, away: 120 });
    expect(all.rows.find((r) => r.key === "wickets_taken")).toMatchObject({ home: 4, away: 6 });
    expect(all.possessionLabel).toBe("Run share");
    expect(all.possession.home + all.possession.away).toBe(100);
  });

  test("innings filter uses that innings only", () => {
    const inn1 = buildCricketMatchComparisonStats({
      sport,
      homeTeamId: "home1",
      awayTeamId: "away1",
      period: 1,
    });
    expect(inn1.rows.find((r) => r.key === "runs")).toMatchObject({ home: 145, away: 0 });
    expect(inn1.rows.find((r) => r.key === "fours")?.home).toBe(1);
  });

  test("buildCricketStatPeriods includes ALL and innings", () => {
    const periods = buildCricketStatPeriods(sport);
    expect(periods.map((p) => p.key)).toEqual(["all", "1", "2"]);
  });
});
