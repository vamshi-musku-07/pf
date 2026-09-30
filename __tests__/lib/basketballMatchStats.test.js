import { describe, expect, test } from "@jest/globals";
import {
  aggregateBasketballTeamStats,
  buildComparisonRows,
  buildQuarterFilters,
  buildShootingRows,
  hasAnyBasketballStats,
  percentOf,
  quarterLabel,
} from "@/lib/basketballMatchStats";

const HOME = "home-team";
const AWAY = "away-team";

const events = [
  { eventType: "point_2", teamId: HOME, quarter: 1 },
  { eventType: "point_2_miss", teamId: HOME, quarter: 1 },
  { eventType: "point_3", teamId: HOME, quarter: 2 },
  { eventType: "free_throw", teamId: HOME, quarter: 2 },
  { eventType: "free_throw_miss", teamId: HOME, quarter: 2 },
  { eventType: "and_one", teamId: HOME, quarter: 2 },
  { eventType: "defensive_rebound", teamId: AWAY, quarter: 1 },
  { eventType: "offensive_rebound", teamId: AWAY, quarter: 2 },
  { eventType: "assist", teamId: AWAY, quarter: 2 },
  { eventType: "turnover", teamId: AWAY, quarter: 2 },
  { eventType: "shooting_foul", teamId: AWAY, quarter: 2 },
];

describe("basketballMatchStats", () => {
  test("aggregates shooting splits for both teams", () => {
    const stats = aggregateBasketballTeamStats(events, { homeTeamId: HOME });
    expect(stats.home.points).toBe(8);
    expect(stats.home.twoPointsMade).toBe(2);
    expect(stats.home.twoPointsAttempted).toBe(3);
    expect(stats.home.threePointsMade).toBe(1);
    expect(stats.home.freeThrowsMade).toBe(1);
    expect(stats.home.freeThrowsAttempted).toBe(2);
    expect(stats.home.fieldGoalsMade).toBe(3);
    expect(stats.home.fieldGoalsAttempted).toBe(4);
  });

  test("counts and-one fouls against the defending team", () => {
    const stats = aggregateBasketballTeamStats(events, { homeTeamId: HOME });
    expect(stats.away.fouls).toBe(2);
    expect(stats.home.fouls).toBe(0);
  });

  test("rebound splits roll up into the rebound total", () => {
    const stats = aggregateBasketballTeamStats(events, { homeTeamId: HOME });
    expect(stats.away.rebounds).toBe(2);
    expect(stats.away.defensiveRebounds).toBe(1);
    expect(stats.away.offensiveRebounds).toBe(1);
    expect(stats.away.assists).toBe(1);
    expect(stats.away.turnovers).toBe(1);
  });

  test("quarter filter narrows the aggregate", () => {
    const q1 = aggregateBasketballTeamStats(events, { homeTeamId: HOME, quarter: 1 });
    expect(q1.home.points).toBe(2);
    expect(q1.away.rebounds).toBe(1);
  });

  test("quarter filters always cover four quarters plus overtime played", () => {
    expect(buildQuarterFilters(events, 2).map((f) => f.label)).toEqual([
      "ALL",
      "Q1",
      "Q2",
      "Q3",
      "Q4",
    ]);
    const withOt = buildQuarterFilters([{ eventType: "point_2", quarter: 5 }], 5);
    expect(withOt[withOt.length - 1].label).toBe("OT1");
    expect(quarterLabel(6)).toBe("OT2");
  });

  test("percentages round to whole numbers and guard against zero attempts", () => {
    expect(percentOf(17, 23)).toBe(74);
    expect(percentOf(0, 0)).toBe(0);
  });

  test("shooting and comparison rows expose both sides", () => {
    const stats = aggregateBasketballTeamStats(events, { homeTeamId: HOME });
    const freeThrows = buildShootingRows(stats).find((r) => r.key === "freeThrows");
    expect(freeThrows.home).toEqual({ made: 1, attempted: 2, percent: 50 });

    const rebounds = buildComparisonRows(stats).find((r) => r.key === "rebounds");
    expect(rebounds).toMatchObject({ label: "Rebounds", home: 0, away: 2 });
  });

  test("empty feeds report no stats", () => {
    expect(hasAnyBasketballStats(aggregateBasketballTeamStats([], { homeTeamId: HOME }))).toBe(false);
    expect(hasAnyBasketballStats(aggregateBasketballTeamStats(events, { homeTeamId: HOME }))).toBe(true);
  });
});
