import {
  getCricketMatchFormatLabel,
  getCricketFreeHit,
  getCricketMatchResult,
  getInningsLimits,
} from "@/components/game/hooks/cricketState";

describe("getCricketMatchFormatLabel", () => {
  test("maps common over counts to named formats", () => {
    expect(getCricketMatchFormatLabel(5)).toBe("T5");
    expect(getCricketMatchFormatLabel(10)).toBe("T10");
    expect(getCricketMatchFormatLabel(15)).toBe("T15");
    expect(getCricketMatchFormatLabel(20)).toBe("T20");
    expect(getCricketMatchFormatLabel(50)).toBe("ODI");
  });

  test("falls back to an overs label for custom counts", () => {
    expect(getCricketMatchFormatLabel(30)).toBe("30 Overs");
    expect(getCricketMatchFormatLabel("40")).toBe("40 Overs");
  });

  test("handles missing / invalid values", () => {
    expect(getCricketMatchFormatLabel(0)).toBe("Custom");
    expect(getCricketMatchFormatLabel(undefined)).toBe("Custom");
    expect(getCricketMatchFormatLabel(null)).toBe("Custom");
  });
});

describe("getCricketFreeHit", () => {
  const sportWith = (events, currentInnings = 1) => ({ currentInnings, events });

  test("is false when there are no deliveries", () => {
    expect(getCricketFreeHit(sportWith([]))).toBe(false);
    expect(getCricketFreeHit(null)).toBe(false);
  });

  test("is true immediately after a no-ball", () => {
    const sport = sportWith([
      { eventType: "single", innings: 1 },
      { eventType: "no_ball", innings: 1 },
    ]);
    expect(getCricketFreeHit(sport)).toBe(true);
  });

  test("stays active through a following wide", () => {
    const sport = sportWith([
      { eventType: "no_ball", innings: 1 },
      { eventType: "wide", innings: 1 },
    ]);
    expect(getCricketFreeHit(sport)).toBe(true);
  });

  test("clears after the next legal delivery", () => {
    const sport = sportWith([
      { eventType: "no_ball", innings: 1 },
      { eventType: "boundary_4", innings: 1 },
    ]);
    expect(getCricketFreeHit(sport)).toBe(false);
  });

  test("only considers the current innings", () => {
    const sport = sportWith(
      [
        { eventType: "no_ball", innings: 1 },
        { eventType: "dot_ball", innings: 2 },
      ],
      2,
    );
    expect(getCricketFreeHit(sport)).toBe(false);
  });
});

describe("getInningsLimits", () => {
  test("main innings use full quota and 10 wickets", () => {
    const limits = getInningsLimits({ totalOvers: 20, innings: [{}, {}] }, 2);
    expect(limits.maxOvers).toBe(20);
    expect(limits.maxWickets).toBe(10);
    expect(limits.isSuperOver).toBe(false);
  });

  test("super over innings use 1 over and 2 wickets", () => {
    const limits = getInningsLimits({ totalOvers: 20, innings: [{}, {}, { isSuperOver: true }] }, 3);
    expect(limits.maxOvers).toBe(1);
    expect(limits.maxWickets).toBe(2);
    expect(limits.isSuperOver).toBe(true);
  });
});

describe("getCricketMatchResult", () => {
  const buildGame = ({
    first,
    second,
    extraInnings = [],
    homeId = "H",
    awayId = "A",
    totalOvers = 20,
    matchStatus,
    status,
    superOverAllowed = false,
  }) => ({
    base: { teamId: homeId, opponentTeamId: awayId, status },
    sport: {
      totalOvers,
      matchStatus,
      superOverAllowed,
      innings: [first, second, ...extraInnings].filter(Boolean),
    },
  });

  test("returns not finished with fewer than two innings", () => {
    expect(getCricketMatchResult(buildGame({ first: { total_runs: 100 } })).finished).toBe(false);
    expect(getCricketMatchResult(null).finished).toBe(false);
  });

  test("chasing team wins by wickets when target is reached", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 8, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 151, wickets: 4, balls_completed: 110 },
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.winnerTeamId).toBe("A");
    expect(result.winnerSide).toBe("away");
    expect(result.marginType).toBe("wickets");
    expect(result.margin).toBe(6);
    expect(result.resultText).toBe("won by 6 wickets");
  });

  test("defending team wins by runs when chase falls short and is all out", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 130, wickets: 10, balls_completed: 95 },
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.winnerTeamId).toBe("H");
    expect(result.winnerSide).toBe("home");
    expect(result.marginType).toBe("runs");
    expect(result.margin).toBe(20);
    expect(result.resultText).toBe("won by 20 runs");
  });

  test("defending team wins when chasing side runs out of overs", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 145, wickets: 6, balls_completed: 120 },
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.winnerSide).toBe("home");
    expect(result.margin).toBe(5);
  });

  test("declares a tie when scores are level at the end", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 150, wickets: 10, balls_completed: 118 },
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.tie).toBe(true);
    expect(result.resultText).toBe("Match tied");
  });

  test("is not finished while the chase is still in progress", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 80, wickets: 3, balls_completed: 60 },
      }),
    );
    expect(result.finished).toBe(false);
  });

  test("respects a server-set finished flag even mid-over", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 120, wickets: 5, balls_completed: 90 },
        status: "finished",
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.winnerSide).toBe("home");
    expect(result.margin).toBe(30);
  });

  test("offers Super Over when knockout tie is allowed", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 200, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 200, wickets: 10, balls_completed: 120 },
        superOverAllowed: true,
        matchStatus: "super_over_break",
      }),
    );
    expect(result.finished).toBe(false);
    expect(result.needsSuperOver).toBe(true);
    expect(result.resultText).toMatch(/Super Over/i);
  });

  test("still records a plain tie when Super Over is disabled", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 150, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 150, wickets: 10, balls_completed: 118 },
        superOverAllowed: false,
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.tie).toBe(true);
  });

  test("picks a Super Over winner from innings 3 and 4", () => {
    const result = getCricketMatchResult(
      buildGame({
        first: { battingTeamId: "H", total_runs: 200, wickets: 7, balls_completed: 120 },
        second: { battingTeamId: "A", total_runs: 200, wickets: 10, balls_completed: 120 },
        extraInnings: [
          { inningsNumber: 3, battingTeamId: "A", total_runs: 15, wickets: 1, balls_completed: 6, isSuperOver: true },
          { inningsNumber: 4, battingTeamId: "H", total_runs: 16, wickets: 0, balls_completed: 5, isSuperOver: true },
        ],
        superOverAllowed: true,
        matchStatus: "finished",
        status: "finished",
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.superOver).toBe(true);
    expect(result.winnerTeamId).toBe("H");
    expect(result.resultText).toBe("won (Super Over)");
  });
});
