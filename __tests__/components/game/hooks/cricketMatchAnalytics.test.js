import {
  buildOverByOverRuns,
  buildWormSeries,
  buildManhattanData,
  buildWagonWheelZones,
  buildPartnershipTimeline,
  buildMatchPhaseStats,
  buildMatchInsights,
  compareCricketPlayers,
  buildPlayerNameMap,
} from "@/components/game/hooks/cricketMatchAnalytics";

const events = [
  { eventType: "single", innings: 1, overNumber: 1, ballNumber: 1, runs: 1 },
  { eventType: "boundary_4", innings: 1, overNumber: 1, ballNumber: 2, runs: 4 },
  { eventType: "boundary_6", innings: 1, overNumber: 1, ballNumber: 3, runs: 6, shotDirection: "leg" },
  { eventType: "dot_ball", innings: 1, overNumber: 1, ballNumber: 4, runs: 0 },
  { eventType: "single", innings: 1, overNumber: 1, ballNumber: 5, runs: 1 },
  { eventType: "wicket", innings: 1, overNumber: 1, ballNumber: 6 },
  { eventType: "double", innings: 1, overNumber: 2, ballNumber: 1, runs: 2, shotDirection: "off" },
  { eventType: "boundary_4", innings: 1, overNumber: 2, ballNumber: 2, runs: 4, shotDirection: "straight" },
];

describe("cricketMatchAnalytics", () => {
  test("buildOverByOverRuns groups runs by over", () => {
    const overs = buildOverByOverRuns(events, 1);
    expect(overs.find((o) => o.over === 1)?.runs).toBe(12);
    expect(overs.find((o) => o.over === 2)?.runs).toBe(6);
  });

  test("buildWormSeries returns cumulative runs", () => {
    const worm = buildWormSeries(events, 1, 5);
    expect(worm[0]).toEqual({ over: 0, runs: 0 });
    expect(worm[worm.length - 1].runs).toBeGreaterThanOrEqual(18);
  });

  test("buildManhattanData matches over-by-over runs", () => {
    expect(buildManhattanData(events, 1)).toEqual(buildOverByOverRuns(events, 1));
  });

  test("buildWagonWheelZones maps shotDirection and distributes runs", () => {
    const zones = buildWagonWheelZones(events, 1);
    expect(zones.leg.runs).toBeGreaterThan(0);
    expect(zones.off.runs + zones.straight.runs + zones.leg.runs).toBeGreaterThan(0);
  });

  test("buildPartnershipTimeline splits on wickets", () => {
    const timeline = buildPartnershipTimeline(events, 1, {});
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    expect(timeline[0].runs).toBe(12);
  });

  test("buildMatchPhaseStats splits powerplay and death", () => {
    const phases = buildMatchPhaseStats(events, 1, 5);
    expect(phases.powerplay.runs).toBeGreaterThan(0);
    expect(phases.death).toBeDefined();
  });

  test("buildMatchInsights returns recap bullets", () => {
    const sport = {
      events,
      totalOvers: 5,
      innings: [{ inningsNumber: 1, total_runs: 18, wickets: 1 }],
    };
    const insights = buildMatchInsights(sport, { inningsNum: 1 });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toMatch(/Innings total/);
  });

  test("compareCricketPlayers picks winners per metric", () => {
    const rows = compareCricketPlayers(
      { matches: 5, runs: 120, battingAverage: 40, strikeRate: 130, wickets: 2, economy: 8, fours: 10, sixes: 4 },
      { matches: 5, runs: 80, battingAverage: 26, strikeRate: 110, wickets: 8, economy: 6, fours: 6, sixes: 2 },
    );
    const runsRow = rows.find((r) => r.label === "Runs");
    expect(runsRow.winner).toBe("a");
    const econRow = rows.find((r) => r.label === "Economy");
    expect(econRow.winner).toBe("b");
  });

  test("buildPlayerNameMap accepts { home, away } player shape from GameScreen", () => {
    const map = buildPlayerNameMap({
      home: [{ _id: "p1", firstName: "Alex", lastName: "Smith" }],
      away: [{ _id: "p2", firstName: "Jordan", lastName: "Lee" }],
    });
    expect(map.p1).toBe("Alex Smith");
    expect(map.p2).toBe("Jordan Lee");
  });
});
