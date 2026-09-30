const { test } = require("node:test");
const assert = require("node:assert");
const {
  tournamentListSubtitle,
  tournamentShareCode,
  filterLiveFeedMatches,
  describeLiveMatch,
  formatDateRange,
} = require("../../../features/tournament/publicConfig");

test("tournamentListSubtitle joins format, teams, status, and dates", () => {
  const subtitle = tournamentListSubtitle({
    format: "hybrid",
    teamCount: 8,
    status: "active",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-31T00:00:00.000Z",
  });
  assert.match(subtitle, /League \+ Knockout/);
  assert.match(subtitle, /8 teams/);
  assert.match(subtitle, /Active/);
  assert.match(subtitle, /Jul/);
});

test("tournamentShareCode prefers shareCode then falls back to _id", () => {
  assert.strictEqual(tournamentShareCode({ shareCode: "ABC123", _id: "t1" }), "ABC123");
  assert.strictEqual(tournamentShareCode({ _id: "t1" }), "t1");
  assert.strictEqual(tournamentShareCode({}), "");
});

test("filterLiveFeedMatches keeps live fixtures only", () => {
  const live = filterLiveFeedMatches([
    { _id: "1", gameStatus: "live" },
    { _id: "2", status: "scheduled" },
    { _id: "3", status: "live" },
  ]);
  assert.strictEqual(live.length, 2);
  assert.deepStrictEqual(live.map((m) => m._id), ["1", "3"]);
});

test("describeLiveMatch formats team names with TBD fallback", () => {
  assert.strictEqual(describeLiveMatch({ homeTeamName: "A", awayTeamName: "B" }), "A vs B");
  assert.strictEqual(describeLiveMatch({}), "TBD vs TBD");
});

test("resolveTournamentRoute prefers public page for discovery (join CTA)", () => {
  const { resolveTournamentRoute } = require("../../../features/tournament/publicConfig");
  assert.deepStrictEqual(
    resolveTournamentRoute({ _id: "t1", shareCode: "ABC" }, { backTo: "/tournament", isSignedIn: true }),
    { pathname: "/tournament/public/ABC", params: { backTo: "/tournament" } },
  );
  assert.deepStrictEqual(
    resolveTournamentRoute({ _id: "t1", shareCode: "ABC" }, { isSignedIn: false }),
    { pathname: "/tournament/public/ABC", params: {} },
  );
  // shareCode falls back to _id, so discovery still uses the public page
  assert.deepStrictEqual(
    resolveTournamentRoute({ _id: "t1" }, { backTo: "/tournament" }),
    { pathname: "/tournament/public/t1", params: { backTo: "/tournament" } },
  );
});

test("formatDateRange handles single-sided dates", () => {
  const range = formatDateRange("2026-08-01T00:00:00.000Z", null);
  assert.ok(range);
  assert.doesNotMatch(range, /–/);
});

test("formatDotDate and statusShortLabel match browse row style", () => {
  const { formatDotDate, statusShortLabel } = require("../../../features/tournament/publicConfig");
  assert.strictEqual(formatDotDate("2026-07-21T12:00:00.000Z"), "21.07.26.");
  assert.strictEqual(formatDotDate(null), null);
  assert.strictEqual(statusShortLabel("active"), "LIVE");
  assert.strictEqual(statusShortLabel("completed"), "FT");
  assert.strictEqual(statusShortLabel("draft"), "DRAFT");
});
