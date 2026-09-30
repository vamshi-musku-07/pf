const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatRecord,
  formatPct,
  formatStreak,
  streakTone,
  getPlayoffCutCount,
  formatStandingsUpdatedAt,
} = require("../../../features/tournament/standingsConfig");

test("record and percentage render like a basketball table", () => {
  assert.equal(formatRecord({ won: 23, lost: 12 }), "23-12");
  assert.equal(formatPct(0.657), ".657");
  assert.equal(formatPct(1), "1.000");
  assert.equal(formatPct(undefined), ".000");
});

test("streak prefers the server value and falls back to form", () => {
  assert.equal(formatStreak({ streak: "W4" }), "W4");
  assert.equal(formatStreak({ form: ["L", "W", "W", "W"] }), "W3");
  assert.equal(formatStreak({ form: ["W", "L"] }), "L1");
  assert.equal(formatStreak({}), "—");
});

test("streak tone marks wins positive and losses negative", () => {
  assert.equal(streakTone("W4"), "positive");
  assert.equal(streakTone("L1"), "negative");
  assert.equal(streakTone("—"), "neutral");
});

test("playoff cut only applies to hybrid tournaments", () => {
  assert.equal(getPlayoffCutCount({ config: { qualifiersPerDivision: 2 } }, "round_robin"), 0);
  assert.equal(getPlayoffCutCount({ config: { qualifiersPerDivision: 2 } }, "hybrid"), 2);
});

test("playoff cut splits playoff teams across groups when not configured", () => {
  const tournament = {
    config: { playoffTeams: 8 },
    divisions: [{ id: "a" }, { id: "b" }],
  };
  assert.equal(getPlayoffCutCount(tournament, "hybrid"), 4);
  assert.equal(getPlayoffCutCount({ config: { playoffTeams: 4 } }, "hybrid"), 4);
});

test("updated label is empty for missing timestamps", () => {
  assert.equal(formatStandingsUpdatedAt(null), "");
  assert.equal(formatStandingsUpdatedAt("not-a-date"), "");
  assert.ok(formatStandingsUpdatedAt("2026-08-17T05:13:00Z").length > 0);
});
