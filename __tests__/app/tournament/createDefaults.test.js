const { test } = require("node:test");
const assert = require("node:assert");
const {
  suggestDivisionCount,
  describeDivisionLayout,
  divisionCountTip,
  divisionPlayoffTip,
  buildHybridPlayoffConfig,
  describeKnockoutAutoStage,
  describeKnockoutPreviewSteps,
  getCreateFormats,
  divisionUnitLabel,
} = require("../../../features/tournament/createConfig");

test("suggestDivisionCount: common team counts", () => {
  assert.strictEqual(suggestDivisionCount(8), 2);
  assert.strictEqual(suggestDivisionCount(12), 3);
  assert.strictEqual(suggestDivisionCount(16), 4);
  assert.strictEqual(suggestDivisionCount(24), 6);
  assert.strictEqual(suggestDivisionCount(3), 1);
});

test("describeDivisionLayout: cricket divisions wording", () => {
  assert.ok(describeDivisionLayout(1).includes("Single division"));
  assert.ok(describeDivisionLayout(3, 12).includes("3 divisions"));
  assert.ok(describeDivisionLayout(3, 12).includes("4 teams each"));
});

test("describeDivisionLayout: football uses groups", () => {
  assert.ok(describeDivisionLayout(1, 0, "Football").includes("Single group"));
  assert.ok(describeDivisionLayout(3, 12, "Football").includes("3 groups"));
});

test("divisionCountTip: football recommended layout", () => {
  assert.ok(divisionCountTip(3, "Football")?.includes("3 Groups × 4 Teams"));
  assert.ok(divisionCountTip(3)?.includes("12 teams"));
  assert.strictEqual(divisionCountTip(1), null);
});

test("divisionPlayoffTip: league multi-div has no cross finals", () => {
  const tip = divisionPlayoffTip("round_robin", 3);
  assert.ok(tip?.includes("No finals between divisions"));
  assert.strictEqual(divisionPlayoffTip("round_robin", 1), null);
});

test("divisionPlayoffTip: football hybrid mentions group stage", () => {
  const tip = divisionPlayoffTip("hybrid", 3, "Football");
  assert.ok(tip?.includes("group stage"));
});

test("getCreateFormats: football terminology", () => {
  const formats = getCreateFormats("Football");
  assert.ok(formats.some((f) => f.label === "Knockout Cup"));
  assert.ok(formats.some((f) => f.label === "Group Stage + Knockout"));
  assert.ok(formats.find((f) => f.id === "round_robin").desc.includes("most points"));
});

test("buildHybridPlayoffConfig: 12-team style — 3 divisions, top 2", () => {
  const cfg = buildHybridPlayoffConfig({
    format: "hybrid",
    divisionCount: 3,
    qualifiersPerDivision: 2,
  });
  assert.strictEqual(cfg.qualifiersPerDivision, 2);
  assert.strictEqual(cfg.playoffSeeding, "per_division");
  assert.strictEqual(cfg.playoffTeams, 6);
});

test("buildHybridPlayoffConfig: single division hybrid uses global top N", () => {
  const cfg = buildHybridPlayoffConfig({
    format: "hybrid",
    divisionCount: 1,
    playoffTeams: 4,
  });
  assert.strictEqual(cfg.qualifiersPerDivision, 0);
  assert.strictEqual(cfg.playoffSeeding, "global");
  assert.strictEqual(cfg.playoffTeams, 4);
});

test("buildHybridPlayoffConfig: pure league has no playoff config", () => {
  const cfg = buildHybridPlayoffConfig({
    format: "round_robin",
    divisionCount: 3,
    qualifiersPerDivision: 2,
  });
  assert.strictEqual(cfg.qualifiersPerDivision, 0);
  assert.strictEqual(cfg.playoffSeeding, "global");
});

test("describeKnockoutAutoStage: 6 qualifiers with byes", () => {
  const text = describeKnockoutAutoStage(6);
  assert.ok(text.includes("6 qualifiers"));
  assert.ok(text.includes("Quarter-finals"));
  assert.ok(text.includes("2 byes"));
});

test("describeKnockoutAutoStage: 4 qualifiers no byes", () => {
  const text = describeKnockoutAutoStage(4);
  assert.ok(text.includes("Semi-finals"));
  assert.ok(!text.includes("bye"));
});

test("describeKnockoutPreviewSteps: football visual flow", () => {
  const steps = describeKnockoutPreviewSteps({
    sport: "Football",
    format: "hybrid",
    divisionCount: 3,
    qualifiersPerDivision: 1,
  });
  assert.strictEqual(steps[0], "Top 1 from each Group");
  assert.ok(steps.includes("Semi-finals") || steps.includes("Final"));
  assert.ok(steps.includes("Final"));
});

test("divisionUnitLabel: football vs cricket", () => {
  assert.strictEqual(divisionUnitLabel("Football", { plural: true }), "Groups");
  assert.strictEqual(divisionUnitLabel("Cricket", { plural: true }), "Divisions");
});
