const { test } = require("node:test");
const assert = require("node:assert");
const {
  buildEditTournamentPayload,
  validateEditTournamentForm,
  buildAdminRows,
  combineDateAndTime,
  buildScheduleFixturePayload,
  canUseSuperOver,
  canUsePenalties,
  canEditQualifiersPerDivision,
  canBulkMoveTeams,
} = require("../../../features/tournament/manageConfig");

test("buildEditTournamentPayload: hybrid multi-div updates qualifiers", () => {
  const payload = buildEditTournamentPayload(
    {
      name: "Cup",
      season: "2026",
      venue: "",
      description: "",
      pointsWin: "2",
      pointsTie: "1",
      pointsNoResult: "1",
      superOver: true,
      thirdPlace: false,
      qualifiersPerDivision: "1",
    },
    {
      format: "hybrid",
      playoffsGenerated: false,
      divisions: [{ id: "d1" }, { id: "d2" }],
    },
  );
  assert.strictEqual(payload.config.qualifiersPerDivision, 1);
  assert.strictEqual(payload.config.playoffTeams, 2);
  assert.strictEqual(payload.config.playoffSeeding, "per_division");
});

test("canEditQualifiersPerDivision: hybrid multi-div before playoffs", () => {
  assert.strictEqual(
    canEditQualifiersPerDivision({ format: "hybrid", divisions: [{ id: "a" }, { id: "b" }] }),
    true,
  );
  assert.strictEqual(
    canEditQualifiersPerDivision({
      format: "hybrid",
      divisions: [{ id: "a" }, { id: "b" }],
      playoffsGenerated: true,
    }),
    false,
  );
  assert.strictEqual(canEditQualifiersPerDivision({ format: "hybrid", divisions: [{ id: "a" }] }), false);
});

test("buildEditTournamentPayload trims fields and parses points", () => {
  const payload = buildEditTournamentPayload({
    name: "  Mega Bash  ",
    season: "2026",
    venue: "",
    description: "desc",
    pointsWin: "3",
    pointsTie: "2",
    pointsNoResult: "",
    superOver: true,
    thirdPlace: true,
    startDate: "2026-08-01T00:00:00.000Z",
  });
  assert.strictEqual(payload.name, "Mega Bash");
  assert.strictEqual(payload.config.pointsWin, 3);
  assert.strictEqual(payload.config.pointsTie, 2);
  assert.strictEqual(payload.config.pointsNoResult, 1);
  assert.strictEqual(payload.config.superOver, true);
  assert.strictEqual(payload.config.thirdPlace, true);
  assert.strictEqual(payload.startDate, "2026-08-01T00:00:00.000Z");
  assert.strictEqual(payload.endDate, undefined);
});

test("validateEditTournamentForm catches empty name and inverted dates", () => {
  assert.strictEqual(validateEditTournamentForm({ name: "  " }), "Enter a tournament name");
  assert.strictEqual(
    validateEditTournamentForm({
      name: "X",
      startDate: "2026-08-10",
      endDate: "2026-08-01",
    }),
    "End date must be on or after the start date",
  );
  assert.strictEqual(validateEditTournamentForm({ name: "X" }), null);
});

test("buildAdminRows puts owner first and dedupes", () => {
  const rows = buildAdminRows(
    { createdBy: "u1", admins: ["u2", "u1", "u3"] },
    { u1: { fullname: "Owner One" }, u2: { username: "coadmin2" } },
  );
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[0].userId, "u1");
  assert.strictEqual(rows[0].isOwner, true);
  assert.strictEqual(rows[0].name, "Owner One");
  assert.strictEqual(rows[1].name, "coadmin2");
  assert.strictEqual(rows[2].name, "User u3");
});

test("combineDateAndTime merges date and time parts", () => {
  const date = new Date("2026-08-05T00:00:00");
  const time = new Date("2000-01-01T14:30:00");
  const merged = combineDateAndTime(date, time);
  assert.strictEqual(merged.getFullYear(), 2026);
  assert.strictEqual(merged.getMonth(), 7);
  assert.strictEqual(merged.getDate(), 5);
  assert.strictEqual(merged.getHours(), 14);
  assert.strictEqual(merged.getMinutes(), 30);
});

test("buildScheduleFixturePayload includes only provided parts", () => {
  const withDate = buildScheduleFixturePayload({
    date: new Date("2026-08-05T00:00:00"),
    time: new Date("2000-01-01T09:15:00"),
    venue: " Central Ground ",
  });
  assert.ok(withDate.scheduledAt);
  assert.strictEqual(withDate.venue, "Central Ground");

  const venueOnly = buildScheduleFixturePayload({ venue: "Park" });
  assert.strictEqual(venueOnly.scheduledAt, undefined);
  assert.strictEqual(venueOnly.venue, "Park");
});

test("canUseSuperOver only for knockout stages with config on", () => {
  const tournament = { config: { superOver: true } };
  assert.strictEqual(canUseSuperOver({ stage: "final" }, tournament), true);
  assert.strictEqual(canUseSuperOver({ stage: "league" }, tournament), false);
  assert.strictEqual(canUseSuperOver({ stage: "final" }, { config: { superOver: false } }), false);
  assert.strictEqual(canUseSuperOver({ stage: "third_place" }, tournament), true);
});

test("football edit payload uses ET/pens instead of super over", () => {
  const payload = buildEditTournamentPayload(
    {
      name: "Cup",
      pointsWin: "3",
      pointsTie: "1",
      pointsNoResult: "1",
      extraTime: true,
      penaltyShootout: false,
      thirdPlace: true,
    },
    { sport: "Football", format: "knockout" },
  );
  assert.strictEqual(payload.config.extraTime, true);
  assert.strictEqual(payload.config.penaltyShootout, false);
  assert.strictEqual(payload.config.superOver, undefined);
  assert.strictEqual(canUsePenalties({ stage: "final" }, { sport: "Football", config: { penaltyShootout: true } }), true);
  assert.strictEqual(canUseSuperOver({ stage: "final" }, { sport: "Football", config: { superOver: true } }), false);
});

test("canBulkMoveTeams: multi-div league before fixtures with handler", () => {
  const base = {
    format: "league",
    fixturesGenerated: false,
    divisions: [{ id: "a" }, { id: "b" }],
  };
  assert.strictEqual(canBulkMoveTeams(base), true);
  assert.strictEqual(canBulkMoveTeams(base, { hasBulkHandler: false }), false);
  assert.strictEqual(canBulkMoveTeams({ ...base, fixturesGenerated: true }), false);
  assert.strictEqual(canBulkMoveTeams({ ...base, format: "knockout" }), false);
  assert.strictEqual(canBulkMoveTeams({ ...base, divisions: [{ id: "a" }] }), false);
  assert.strictEqual(
    canBulkMoveTeams({ ...base, format: "hybrid", divisions: [{ id: "a" }, { id: "b" }] }),
    true,
  );
});
