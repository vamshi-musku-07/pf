const { test } = require("node:test");
const assert = require("node:assert");
const {
  isByeFixture,
  getByeAdvancer,
  describeByeAdvancement,
  getKnockoutQualifierCount,
  countFirstRoundByes,
  stageHeaderLabel,
  bracketSubtitle,
} = require("../../../features/tournament/bracketConfig");

test("isByeFixture: status bye or single-sided knockout", () => {
  assert.strictEqual(isByeFixture({ status: "bye", stage: "quarterfinal" }), true);
  assert.strictEqual(
    isByeFixture({
      status: "pending",
      stage: "quarterfinal",
      homeTeamId: "A",
      awayTeamId: null,
    }),
    true,
  );
  assert.strictEqual(
    isByeFixture({
      status: "pending",
      stage: "league",
      homeTeamId: "A",
      awayTeamId: null,
    }),
    false,
  );
});

test("getByeAdvancer: returns present team", () => {
  const adv = getByeAdvancer({
    status: "bye",
    homeTeamId: "A",
    homeTeamName: "Alpha",
    awayTeamId: null,
  });
  assert.strictEqual(adv.teamId, "A");
  assert.strictEqual(adv.teamName, "Alpha");
});

test("describeByeAdvancement: uses next fixture label", () => {
  const label = describeByeAdvancement(
    { stage: "quarterfinal", nextFixtureId: "sf1" },
    [{ _id: "sf1", label: "Semifinal 1", stage: "semifinal" }],
  );
  assert.strictEqual(label, "Semifinal 1");
});

test("getKnockoutQualifierCount and countFirstRoundByes", () => {
  const ko = [
    { stage: "quarterfinal", round: 1, status: "bye", homeTeamId: "A" },
    { stage: "quarterfinal", round: 1, status: "pending", homeTeamId: "B", awayTeamId: "C" },
    { stage: "semifinal", round: 2, status: "pending", homeTeamId: "D", awayTeamId: "E" },
  ];
  assert.strictEqual(getKnockoutQualifierCount(ko), 3);
  assert.strictEqual(countFirstRoundByes(ko), 1);
});

test("stageHeaderLabel: plural with count", () => {
  assert.strictEqual(stageHeaderLabel("quarterfinal", 2), "Quarterfinals (2)");
  assert.strictEqual(stageHeaderLabel("final", 1), "Final");
});

test("bracketSubtitle: hybrid with byes", () => {
  const ko = [
    { stage: "quarterfinal", round: 1, status: "bye", homeTeamId: "A" },
    { stage: "quarterfinal", round: 1, status: "bye", homeTeamId: "B" },
    { stage: "quarterfinal", round: 1, status: "pending", homeTeamId: "C", awayTeamId: "D" },
    { stage: "quarterfinal", round: 1, status: "pending", homeTeamId: "E", awayTeamId: "F" },
  ];
  const sub = bracketSubtitle("hybrid", ko);
  assert.ok(sub.includes("6 teams"));
  assert.ok(sub.includes("2 byes"));
});
