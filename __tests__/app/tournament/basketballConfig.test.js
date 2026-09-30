const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isBasketballSport,
  usesGroupWording,
  getCreateFormats,
  buildBasketballMatchConfig,
} = require("../../../features/tournament/createConfig");
const { formatLabelForSport } = require("../../../features/tournament/publicConfig");
const { formatFixtureSideScore } = require("../../../features/tournament/liveMatchConfig");

test("basketball uses group wording", () => {
  assert.equal(isBasketballSport("Basketball"), true);
  assert.equal(usesGroupWording("Basketball"), true);
});

test("basketball formats include group stage + knockout", () => {
  const formats = getCreateFormats("Basketball");
  const hybrid = formats.find((f) => f.id === "hybrid");
  assert.ok(hybrid);
  assert.match(hybrid.label, /Group Stage \+ Knockout/i);
});

test("buildBasketballMatchConfig defaults", () => {
  const cfg = buildBasketballMatchConfig();
  assert.equal(cfg.matchFormat, "basketball");
  assert.equal(cfg.totalQuarters, 4);
  assert.equal(cfg.quarterMinutes, 10);
  assert.equal(cfg.overtimeMinutes, 5);
  assert.equal(cfg.shotClockSeconds, 24);
  assert.equal(cfg.pointsWin, 2);
  assert.equal(cfg.pointsTie, 0);
});

test("public config shows groups for basketball hybrid", () => {
  assert.equal(formatLabelForSport("hybrid", "Basketball"), "Groups + Knockout");
});

test("live match score formatting uses basketball points", () => {
  assert.equal(formatFixtureSideScore({ points: 87 }, "Basketball"), "87");
});

