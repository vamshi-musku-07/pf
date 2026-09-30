const { test } = require("node:test");
const assert = require("node:assert");
const {
  isBaseballSport,
  getCreateFormats,
  buildBaseballMatchConfig,
  divisionUnitLabel,
  describeDivisionLayout,
} = require("../../../features/tournament/createConfig");
const { buildEditTournamentPayload, canUseSuperOver } = require("../../../features/tournament/manageConfig");
const { formatLabelForSport } = require("../../../features/tournament/publicConfig");
const { formatFixtureSideScore } = require("../../../features/tournament/liveMatchConfig");

test("isBaseballSport and pool wording", () => {
  assert.strictEqual(isBaseballSport("Baseball"), true);
  assert.strictEqual(divisionUnitLabel("Baseball", { plural: true }), "Pools");
  assert.ok(describeDivisionLayout(4, 12, "Baseball").toLowerCase().includes("pool"));
});

test("getCreateFormats: baseball hybrid label", () => {
  const formats = getCreateFormats("Baseball");
  const hybrid = formats.find((f) => f.id === "hybrid");
  assert.ok(hybrid);
  assert.ok(String(hybrid.label).toLowerCase().includes("pool"));
});

test("buildBaseballMatchConfig: defaults", () => {
  const cfg = buildBaseballMatchConfig({});
  assert.strictEqual(cfg.scheduledInnings, 7);
  assert.strictEqual(cfg.extraInnings, "unlimited");
  assert.strictEqual(cfg.superOver, false);
  assert.ok(Array.isArray(cfg.mercyRules));
  assert.ok(cfg.mercyRules.length >= 1);
});

test("buildEditTournamentPayload: baseball rules, no super over", () => {
  const payload = buildEditTournamentPayload(
    {
      name: "Summer Classic",
      scheduledInnings: "9",
      extraInnings: "max_2",
      allowPoolTies: true,
      mercyRuleEnabled: true,
      mercyRules: [{ afterInning: 5, leadRuns: 10 }],
      timeLimitMinutes: "90",
      thirdPlace: true,
    },
    { sport: "Baseball", format: "hybrid", divisions: [{ id: "a" }, { id: "b" }] },
  );
  assert.strictEqual(payload.config.scheduledInnings, 9);
  assert.strictEqual(payload.config.extraInnings, "max_2");
  assert.strictEqual(payload.config.superOver, false);
  assert.strictEqual(payload.config.timeLimitMinutes, 90);
  assert.strictEqual(payload.config.thirdPlace, true);
});

test("canUseSuperOver: false for baseball", () => {
  assert.strictEqual(
    canUseSuperOver({ stage: "final" }, { sport: "Baseball", config: { superOver: true } }),
    false,
  );
});

test("formatLabelForSport: baseball hybrid", () => {
  assert.strictEqual(formatLabelForSport("hybrid", "Baseball"), "Pools + Knockout");
});

test("formatFixtureSideScore: baseball runs only", () => {
  assert.strictEqual(formatFixtureSideScore({ runs: 7, wickets: 2 }, "Baseball"), "7");
  assert.strictEqual(formatFixtureSideScore({ runs: null }, "Baseball"), null);
});

const {
  formatDivisionDisplayName,
  getDivisionName,
  divisionCopy,
  formatLabelForSport: helpersFormatLabelForSport,
} = require("../../../features/tournament/divisionNaming");

test("formatDivisionDisplayName: baseball maps Division N to Pool letter", () => {
  assert.strictEqual(formatDivisionDisplayName({ name: "Division 1", order: 1 }, "Baseball"), "Pool A");
  assert.strictEqual(formatDivisionDisplayName({ name: "Division 3", order: 3 }, "Baseball"), "Pool C");
  // Football keeps groups, cricket keeps divisions
  assert.strictEqual(formatDivisionDisplayName({ name: "Division 2", order: 2 }, "Football"), "Group B");
  assert.strictEqual(formatDivisionDisplayName({ name: "Division 2", order: 2 }, "Cricket"), "Division 2");
});

test("formatDivisionDisplayName: baseball keeps custom + existing pool names", () => {
  assert.strictEqual(formatDivisionDisplayName({ name: "Pool B" }, "Baseball"), "Pool B");
  assert.strictEqual(formatDivisionDisplayName({ name: "East Coast" }, "Baseball"), "East Coast");
});

test("divisionCopy: baseball pool wording", () => {
  const copy = divisionCopy("Baseball");
  assert.strictEqual(copy.singular, "Pool");
  assert.strictEqual(copy.plural, "Pools");
  assert.strictEqual(copy.singularLower, "pool");
  assert.strictEqual(copy.pluralLower, "pools");
});

test("getDivisionName: baseball fallback is Pool A", () => {
  assert.strictEqual(getDivisionName([], "missing", "Baseball"), "Pool A");
  assert.strictEqual(getDivisionName([], "missing", "Cricket"), "Division 1");
});

test("helpers formatLabelForSport: baseball hybrid says Pools", () => {
  assert.strictEqual(helpersFormatLabelForSport("hybrid", "Baseball"), "Pools + Knockout");
  assert.strictEqual(helpersFormatLabelForSport("hybrid", "Cricket"), "Divisions + Knockout");
});
