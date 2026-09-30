const { test } = require("node:test");
const assert = require("node:assert");
const {
  getLeaguePhaseProgress,
  formatQualifierLines,
  buildNextStageConfirmMessage,
} = require("../../../features/tournament/nextStageConfig");
const { buildLocalPlayoffPreview } = require("../../../features/tournament/playoffPreviewConfig");

test("getLeaguePhaseProgress: league fixtures only", () => {
  const p = getLeaguePhaseProgress([
    { stage: "league", status: "completed" },
    { stage: "league", status: "pending" },
    { stage: "quarterfinal", status: "pending" },
  ]);
  assert.strictEqual(p.completed, 1);
  assert.strictEqual(p.total, 2);
  assert.strictEqual(p.complete, false);
});

test("formatQualifierLines: division teams with ranks", () => {
  const text = formatQualifierLines(
    [
      {
        divisionName: "Division A",
        teams: [
          { teamName: "Alpha", points: 4, rank: 1 },
          { teamName: "Beta", points: 0, rank: 2 },
        ],
      },
      { divisionName: "Division B", teams: [{ teamName: "Echo", points: 4, rank: 1 }] },
    ],
    { qualifiersPerDivision: 2 },
  );
  assert.ok(text.includes("Division A: 1st Alpha · 4 pts (winner)"));
  assert.ok(text.includes("2nd Beta · 0 pts"));
  assert.ok(text.includes("Division B: 1st Echo · 4 pts (winner)"));
});

test("formatQualifierLines: maps Division N to Group for football", () => {
  const text = formatQualifierLines(
    [{ divisionName: "Division 1", teams: [{ teamName: "Alpha", points: 6, rank: 1 }] }],
    { qualifiersPerDivision: 1, sport: "Football" },
  );
  assert.ok(text.includes("Group A:"));
  assert.ok(!text.includes("Division 1:"));
});
test("buildNextStageConfirmMessage: includes qualifiers and bracket", () => {
  const msg = buildNextStageConfirmMessage({
    qualifiers: [
      { divisionName: "Division A", teams: [{ teamName: "A" }, { teamName: "C" }] },
    ],
    seedOrder: [
      { teamName: "A" },
      { teamName: "C" },
    ],
    bracketSummary: {
      qualifierCount: 6,
      rounds: ["Quarterfinal", "Semifinal", "Final"],
      byeCount: 2,
    },
  });
  assert.ok(msg.includes("Qualifiers:"));
  assert.ok(msg.includes("Division A: 1st A"));
  assert.ok(msg.includes("2nd C"));
  assert.ok(msg.includes("Seeds: A · C"));
  assert.ok(msg.includes("6 teams"));
  assert.ok(msg.includes("2 byes"));
  assert.ok(msg.includes("Continue?"));
});

test("buildLocalPlayoffPreview: advanceHint when all teams qualify", () => {
  const tournament = {
    format: "hybrid",
    fixturesGenerated: true,
    teams: [
      { teamId: "A", teamName: "Flowers", divisionId: "div-1" },
      { teamId: "B", teamName: "Worriers", divisionId: "div-1" },
      { teamId: "C", teamName: "Tigers", divisionId: "div-2" },
      { teamId: "D", teamName: "Lions", divisionId: "div-2" },
    ],
    divisions: [
      { id: "div-1", name: "Division 1", order: 1, teamIds: ["A", "B"] },
      { id: "div-2", name: "Division 2", order: 2, teamIds: ["C", "D"] },
    ],
    config: { qualifiersPerDivision: 2, playoffTeams: 4, playoffSeeding: "per_division" },
  };
  const fixtures = [
    { stage: "league", divisionId: "div-1", status: "completed" },
    { stage: "league", divisionId: "div-2", status: "completed" },
  ];
  const standingsByDivision = {
    "div-1": [
      { teamId: "A", teamName: "Flowers", points: 4, nrr: 0.5 },
      { teamId: "B", teamName: "Worriers", points: 0, nrr: -0.5 },
    ],
    "div-2": [
      { teamId: "D", teamName: "Lions", points: 4, nrr: 0.3 },
      { teamId: "C", teamName: "Tigers", points: 0, nrr: -0.3 },
    ],
  };
  const preview = buildLocalPlayoffPreview(tournament, fixtures, standingsByDivision);
  assert.strictEqual(preview.seedOrder.length, 4);
  assert.ok(preview.advanceHint?.includes("everyone advances"));
  assert.ok(preview.allTeamsAdvance);
});

test("buildLocalPlayoffPreview: per-division qualifiers from standings", () => {
  const tournament = {
    format: "hybrid",
    fixturesGenerated: true,
    teams: [
      { teamId: "A", teamName: "Alpha", divisionId: "div-1" },
      { teamId: "C", teamName: "Charlie", divisionId: "div-1" },
      { teamId: "E", teamName: "Echo", divisionId: "div-2" },
      { teamId: "G", teamName: "Golf", divisionId: "div-2" },
    ],
    divisions: [
      { id: "div-1", name: "Division A", order: 1, teamIds: ["A", "C"] },
      { id: "div-2", name: "Division B", order: 2, teamIds: ["E", "G"] },
    ],
    config: { qualifiersPerDivision: 1, playoffTeams: 2, playoffSeeding: "per_division" },
  };
  const fixtures = [
    { stage: "league", divisionId: "div-1", status: "completed" },
    { stage: "league", divisionId: "div-2", status: "completed" },
  ];
  const standingsByDivision = {
    "div-1": [
      { teamId: "A", teamName: "Alpha", points: 4, nrr: 0.5 },
      { teamId: "C", teamName: "Charlie", points: 2, nrr: 0.1 },
    ],
    "div-2": [
      { teamId: "E", teamName: "Echo", points: 4, nrr: 0.3 },
      { teamId: "G", teamName: "Golf", points: 2, nrr: -0.2 },
    ],
  };
  const preview = buildLocalPlayoffPreview(tournament, fixtures, standingsByDivision);
  assert.strictEqual(preview.ready, true);
  assert.strictEqual(preview.seedOrder.length, 2);
  assert.deepStrictEqual(preview.seedOrder.map((s) => s.teamId), ["A", "E"]);
});
