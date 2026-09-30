const { test } = require("node:test");
const assert = require("node:assert");
const {
  filterMineTournaments,
  tournamentMineRoleLabel,
} = require("../../../features/tournament/mineConfig");

test("filterMineTournaments keeps only creator, admin, or enrolled team links", () => {
  const userId = "u1";
  const list = [
    { _id: "t1", createdBy: "u1", teams: [] },
    { _id: "t2", createdBy: "u2", admins: ["u1"], teams: [] },
    { _id: "t3", createdBy: "u2", teams: [{ teamId: "team-a" }] },
    { _id: "t4", createdBy: "u2", teams: [{ teamId: "team-b" }] },
  ];
  const filtered = filterMineTournaments(list, userId, ["team-a"], ["team-c"]);
  assert.deepStrictEqual(filtered.map((t) => t._id), ["t1", "t2", "t3"]);
});

test("tournamentMineRoleLabel distinguishes organizer and team member", () => {
  assert.strictEqual(
    tournamentMineRoleLabel({ createdBy: "u1" }, "u1", [], []),
    "Organizing",
  );
  assert.strictEqual(
    tournamentMineRoleLabel({ createdBy: "u2", admins: ["u1"] }, "u1", [], []),
    "Co-admin",
  );
  assert.strictEqual(
    tournamentMineRoleLabel(
      { createdBy: "u2", teams: [{ teamId: "team-a", teamName: "Jokers" }] },
      "u1",
      [],
      ["team-a"],
    ),
    "Team: Jokers",
  );
});
