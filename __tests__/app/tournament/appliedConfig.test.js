const { test } = require("node:test");
const assert = require("node:assert");
const {
  getAppliedStatusMeta,
  formatAppliedWhen,
  summarizeAppliedRequests,
  normalizeListTab,
  tournamentStubFromRequest,
} = require("../../../features/tournament/appliedConfig");

test("getAppliedStatusMeta returns themed metadata per status", () => {
  assert.equal(getAppliedStatusMeta("pending").shortLabel, "Pending");
  assert.equal(getAppliedStatusMeta("approved").icon, "checkmark-circle-outline");
  assert.equal(getAppliedStatusMeta("rejected").shortLabel, "Declined");
});

test("summarizeAppliedRequests counts by status", () => {
  const stats = summarizeAppliedRequests([
    { status: "pending" },
    { status: "pending" },
    { status: "approved" },
    { status: "rejected" },
  ]);
  assert.deepStrictEqual(stats, { total: 4, pending: 2, approved: 1, rejected: 1 });
});

test("formatAppliedWhen handles recent timestamps", () => {
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.equal(formatAppliedWhen(recent), "5m ago");
});

test("normalizeListTab only allows known tabs", () => {
  assert.equal(normalizeListTab("applied"), "applied");
  assert.equal(normalizeListTab("browse"), "browse");
  assert.equal(normalizeListTab("weird"), "mine");
});

test("tournamentStubFromRequest maps request fields for navigation", () => {
  assert.deepStrictEqual(
    tournamentStubFromRequest({
      tournamentId: "t1",
      tournamentName: "Spring Cup",
      shareCode: "abc",
      tournamentSport: "Cricket",
    }),
    { _id: "t1", name: "Spring Cup", shareCode: "abc", sport: "Cricket" },
  );
});
