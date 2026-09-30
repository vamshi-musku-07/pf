const { test } = require("node:test");
const assert = require("node:assert");
const {
  DEFAULT_SCHEDULED_INNINGS,
  resolveScheduledInnings,
  resolveInningColumns,
  formatInningStatus,
  buildLineScoreFromFixture,
  buildLineScoreFromGame,
} = require("../../lib/baseballLineScore");

test("resolveScheduledInnings: honours config, falls back to 9", () => {
  assert.strictEqual(resolveScheduledInnings(7), 7);
  assert.strictEqual(resolveScheduledInnings("5"), 5);
  assert.strictEqual(resolveScheduledInnings(9), 9);
  // Missing / invalid rules fall back to standard baseball.
  assert.strictEqual(resolveScheduledInnings(undefined), DEFAULT_SCHEDULED_INNINGS);
  assert.strictEqual(resolveScheduledInnings(null), 9);
  assert.strictEqual(resolveScheduledInnings(0), 9);
  assert.strictEqual(resolveScheduledInnings("abc"), 9);
});

test("resolveInningColumns: a 7-inning game shows 7 columns, not 9", () => {
  const cols = resolveInningColumns({
    homeByInning: [0, 1],
    awayByInning: [2, 0],
    currentInning: 2,
    scheduledInnings: 7,
  });
  assert.strictEqual(cols, 7);
});

test("resolveInningColumns: 5-inning game shows 5 columns", () => {
  assert.strictEqual(
    resolveInningColumns({ currentInning: 1, scheduledInnings: 5 }),
    5,
  );
});

test("resolveInningColumns: grows for extra innings past the scheduled count", () => {
  assert.strictEqual(
    resolveInningColumns({ currentInning: 9, scheduledInnings: 7 }),
    9,
  );
  // Recorded innings can also exceed the schedule.
  assert.strictEqual(
    resolveInningColumns({
      homeByInning: [0, 0, 0, 0, 0, 0, 0, 1],
      currentInning: 2,
      scheduledInnings: 7,
    }),
    8,
  );
});

test("resolveInningColumns: sizes to the data when no length is known", () => {
  // Fixtures stored before scheduledInnings existed must not render 9 phantom
  // columns; callers that want the 9-inning default resolve it up front.
  assert.strictEqual(resolveInningColumns({ currentInning: 1 }), 1);
  assert.strictEqual(resolveInningColumns({ currentInning: 4 }), 4);
  assert.strictEqual(
    resolveInningColumns({ currentInning: 1, scheduledInnings: resolveScheduledInnings(undefined) }),
    9,
  );
});

test("resolveInningColumns: never returns less than 1", () => {
  assert.strictEqual(
    resolveInningColumns({ scheduledInnings: 0, fallbackScheduled: 0, currentInning: 0 }),
    1,
  );
});

test("formatInningStatus: shows the configured length", () => {
  assert.strictEqual(
    formatInningStatus({ currentInning: 2, scheduledInnings: 7, inningHalf: "top" }),
    "▲ Inning 2 of 7",
  );
  assert.strictEqual(
    formatInningStatus({ currentInning: 5, scheduledInnings: 5, inningHalf: "bottom" }),
    "▼ Inning 5 of 5",
  );
});

test("formatInningStatus: marks extra innings instead of a wrong total", () => {
  assert.strictEqual(
    formatInningStatus({ currentInning: 8, scheduledInnings: 7, inningHalf: "top" }),
    "▲ Inning 8 · Extra",
  );
});

test("buildLineScoreFromGame: carries rules.scheduledInnings through", () => {
  const props = buildLineScoreFromGame({
    score: { home: 3, away: 1, byInning: { home: [0, 3], away: [1, 0] } },
    currentInning: 2,
    rules: { scheduledInnings: 7 },
    status: "live",
    half: "bottom",
  });
  assert.strictEqual(props.scheduledInnings, 7);
  assert.strictEqual(props.statusLabel, "▼ Inning 2 of 7");
  assert.strictEqual(
    resolveInningColumns({
      homeByInning: props.homeByInning,
      awayByInning: props.awayByInning,
      currentInning: props.currentInning,
      scheduledInnings: props.scheduledInnings,
    }),
    7,
  );
});

test("buildLineScoreFromFixture: reads scheduledInnings from the stored result", () => {
  const props = buildLineScoreFromFixture({
    status: "completed",
    result: {
      home: { runs: 4, hits: 7, errors: 1, byInning: [0, 2, 0, 1, 1, 0, 0] },
      away: { runs: 2, hits: 5, errors: 0, byInning: [1, 0, 0, 0, 1, 0, 0] },
      scheduledInnings: 7,
      finishMethod: "regulation",
    },
  });
  assert.strictEqual(props.scheduledInnings, 7);
  assert.strictEqual(props.statusLabel, "regulation");
});

test("buildLineScoreFromFixture: falls back to the fixture-level value", () => {
  const props = buildLineScoreFromFixture({ scheduledInnings: 5, result: {} });
  assert.strictEqual(props.scheduledInnings, 5);
});
