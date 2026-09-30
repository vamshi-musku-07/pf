const { test } = require("node:test");
const assert = require("node:assert");
const {
  resolveFixtureTeamName,
  buildMatchHeadline,
  buildLiveMatchHeadline,
  describeMatchStage,
  describeLiveMatchStage,
  formatInningsScore,
  formatFixtureSideScore,
  describePastResult,
  isHomeWinner,
  resolveMatchCardVariant,
} = require("../../../features/tournament/liveMatchConfig");

test("buildMatchHeadline formats Team A vs Team B", () => {
  const headline = buildMatchHeadline({
    homeTeamName: "Flowers",
    awayTeamName: "Lions",
  });
  assert.strictEqual(headline, "Flowers vs Lions");
  assert.strictEqual(buildLiveMatchHeadline({ homeTeamName: "A", awayTeamName: "B" }), "A vs B");
});

test("resolveFixtureTeamName falls back to source and TBD", () => {
  assert.strictEqual(
    resolveFixtureTeamName({ homeSource: "Winner SF 1" }, "home"),
    "Winner SF 1",
  );
  assert.strictEqual(resolveFixtureTeamName({}, "away"), "TBD");
});

test("describeMatchStage prefers label then knockout stage", () => {
  assert.strictEqual(
    describeMatchStage({ label: "Division 1 · Match 2", stage: "league" }),
    "Division 1 · Match 2",
  );
  assert.strictEqual(describeLiveMatchStage({ stage: "semifinal" }), "Semifinal");
});

test("formatInningsScore and past result helpers", () => {
  assert.strictEqual(formatInningsScore({ runs: 145, wickets: 6 }), "145/6");
  assert.strictEqual(formatInningsScore({ runs: 0 }), "0/0");
  const fixture = {
    homeTeamId: "h1",
    result: {
      winnerTeamId: "h1",
      home: { runs: 150, wickets: 4 },
      away: { runs: 142, wickets: 8 },
      margin: "Flowers won by 8 runs",
    },
  };
  assert.strictEqual(isHomeWinner(fixture), true);
  assert.strictEqual(describePastResult(fixture), "Flowers won by 8 runs");
});

test("formatFixtureSideScore: football goals and pens", () => {
  assert.strictEqual(formatFixtureSideScore({ goals: 2 }, "Football"), "2");
  assert.strictEqual(formatFixtureSideScore({ goals: 1, pens: 4 }, "Football"), "1 (4)");
  assert.strictEqual(formatFixtureSideScore({ runs: 120, wickets: 3 }, "Cricket"), "120/3");
  assert.strictEqual(formatFixtureSideScore({ runs: 8, wickets: 2 }, "Baseball"), "8");
});

test("resolveMatchCardVariant classifies live, past, and upcoming", () => {
  assert.strictEqual(resolveMatchCardVariant({ gameStatus: "live" }), "live");
  assert.strictEqual(resolveMatchCardVariant({ status: "halftime" }), "live");
  assert.strictEqual(resolveMatchCardVariant({ status: "completed" }), "past");
  assert.strictEqual(resolveMatchCardVariant({ status: "bye" }), "past");
  assert.strictEqual(resolveMatchCardVariant({ status: "scheduled" }), "upcoming");
});
