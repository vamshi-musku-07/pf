const { test } = require("node:test");
const assert = require("node:assert");

// Mirror pure helpers from helpers.jsx for unit testing without RN imports.
const isFixtureLive = (fixture) => {
  const liveStatuses = new Set(["live", "halftime"]);
  return liveStatuses.has(fixture?.gameStatus) || liveStatuses.has(fixture?.status);
};

const isFixturePast = (fixture) =>
  fixture?.status === "completed" || fixture?.status === "bye";

const classifyFixture = (fixture) => {
  if (isFixtureLive(fixture)) return "live";
  if (isFixturePast(fixture)) return "past";
  return "upcoming";
};

const filterFixturesByMatchStatus = (fixtures = [], filter = "Upcoming") => {
  const key = String(filter || "Upcoming").toLowerCase();
  return (fixtures || []).filter((fixture) => {
    const bucket = classifyFixture(fixture);
    if (key === "live") return bucket === "live";
    if (key === "past") return bucket === "past";
    return bucket === "upcoming";
  });
};

const countFixturesByMatchFilter = (fixtures = []) => {
  const counts = { Live: 0, Upcoming: 0, Past: 0 };
  for (const fixture of fixtures || []) {
    const bucket = classifyFixture(fixture);
    if (bucket === "live") counts.Live += 1;
    else if (bucket === "past") counts.Past += 1;
    else counts.Upcoming += 1;
  }
  return counts;
};

const pickDefaultMatchFilter = (fixtures = []) => {
  const counts = countFixturesByMatchFilter(fixtures);
  if (counts.Live > 0) return "Live";
  if (counts.Upcoming > 0) return "Upcoming";
  return "Past";
};

test("classifyFixture: live from gameStatus or status", () => {
  assert.strictEqual(classifyFixture({ status: "scheduled", gameStatus: "live" }), "live");
  assert.strictEqual(classifyFixture({ status: "live" }), "live");
  assert.strictEqual(classifyFixture({ status: "scheduled", gameStatus: "halftime" }), "live");
});

const countFixturesByMatchFilterScoped = (divisionFixtures = [], liveScopeFixtures = divisionFixtures) => {
  const liveStatuses = new Set(["live", "halftime"]);
  const isLive = (fixture) =>
    liveStatuses.has(fixture?.gameStatus) || liveStatuses.has(fixture?.status);
  const classify = (fixture) => {
    if (isLive(fixture)) return "live";
    if (isFixturePast(fixture)) return "past";
    return "upcoming";
  };
  return {
    Live: (liveScopeFixtures || []).filter((f) => classify(f) === "live").length,
    Upcoming: (divisionFixtures || []).filter((f) => classify(f) === "upcoming").length,
    Past: (divisionFixtures || []).filter((f) => classify(f) === "past").length,
  };
};

const buildMatchLiveScopeFixtures = (divisionFixtures = [], allFixtures = [], format = "league") => {
  if (format === "knockout") return allFixtures?.length ? allFixtures : divisionFixtures;
  const divisionList = divisionFixtures || [];
  const seen = new Set(divisionList.map((f) => String(f?._id || f?.id || "")));
  const knockoutExtras = (allFixtures || []).filter((f) => {
    if (!f || f.stage === "league") return false;
    const id = String(f._id || f.id || "");
    return id ? !seen.has(id) : true;
  });
  return [...divisionList, ...knockoutExtras];
};

test("countFixturesByMatchFilterScoped: live knockout visible when league tab is league-only", () => {
  const divisionLeague = [
    { _id: "1", stage: "league", status: "completed" },
    { _id: "2", stage: "league", status: "completed" },
  ];
  const allTournament = [
    ...divisionLeague,
    { _id: "3", stage: "semifinal", status: "scheduled", gameStatus: "live" },
  ];
  const liveScope = buildMatchLiveScopeFixtures(divisionLeague, allTournament, "hybrid");
  assert.deepStrictEqual(countFixturesByMatchFilterScoped(divisionLeague, liveScope), {
    Live: 1,
    Upcoming: 0,
    Past: 2,
  });
  assert.strictEqual(
    filterFixturesByMatchStatus(liveScope, "Live").length,
    1,
  );
});

test("countFixturesByMatchFilterScoped: live stays within selected division", () => {
  const divisionA = [
    { _id: "1", stage: "league", divisionId: "a", status: "pending" },
    { _id: "2", stage: "league", divisionId: "a", status: "completed" },
  ];
  const allDivisions = [
    { _id: "1", stage: "league", divisionId: "a", status: "pending" },
    { _id: "2", stage: "league", divisionId: "a", status: "completed" },
    { _id: "3", stage: "league", divisionId: "b", status: "scheduled", gameStatus: "live" },
  ];
  const liveScope = buildMatchLiveScopeFixtures(divisionA, allDivisions, "league");
  assert.deepStrictEqual(countFixturesByMatchFilterScoped(divisionA, liveScope), {
    Live: 0,
    Upcoming: 1,
    Past: 1,
  });
  assert.strictEqual(filterFixturesByMatchStatus(liveScope, "Live").length, 0);
});

test("buildMatchLiveScopeFixtures: includes live knockout but not other division league", () => {
  const divisionA = [
    { _id: "1", stage: "league", divisionId: "a", status: "pending" },
  ];
  const all = [
    ...divisionA,
    { _id: "2", stage: "league", divisionId: "b", gameStatus: "live" },
    { _id: "3", stage: "final", gameStatus: "live" },
  ];
  const scope = buildMatchLiveScopeFixtures(divisionA, all, "hybrid");
  assert.deepStrictEqual(
    scope.map((f) => f._id).sort(),
    ["1", "3"],
  );
});

test("classifyFixture: past includes completed and bye", () => {
  assert.strictEqual(classifyFixture({ status: "completed" }), "past");
  assert.strictEqual(classifyFixture({ status: "bye" }), "past");
});

test("classifyFixture: pending and scheduled are upcoming", () => {
  assert.strictEqual(classifyFixture({ status: "pending" }), "upcoming");
  assert.strictEqual(classifyFixture({ status: "scheduled" }), "upcoming");
});

test("filterFixturesByMatchStatus and counts", () => {
  const fixtures = [
    { _id: "1", status: "live", gameStatus: "live" },
    { _id: "2", status: "pending" },
    { _id: "3", status: "completed" },
    { _id: "4", status: "scheduled" },
  ];
  assert.strictEqual(filterFixturesByMatchStatus(fixtures, "Live").length, 1);
  assert.strictEqual(filterFixturesByMatchStatus(fixtures, "Upcoming").length, 2);
  assert.strictEqual(filterFixturesByMatchStatus(fixtures, "Past").length, 1);
  assert.deepStrictEqual(countFixturesByMatchFilter(fixtures), { Live: 1, Upcoming: 2, Past: 1 });
});

test("pickDefaultMatchFilter prefers Live then Upcoming", () => {
  assert.strictEqual(
    pickDefaultMatchFilter([{ status: "live" }, { status: "pending" }]),
    "Live",
  );
  assert.strictEqual(pickDefaultMatchFilter([{ status: "pending" }]), "Upcoming");
  assert.strictEqual(pickDefaultMatchFilter([{ status: "completed" }]), "Past");
});
