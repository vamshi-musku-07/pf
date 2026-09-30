// Pure bracket / bye display helpers (no React).

const KO_STAGES = ["round_of_16", "quarterfinal", "semifinal", "final", "third_place"];

const KO_STAGE_LABELS = {
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
  third_place: "3rd Place",
};

const KO_STAGE_LABELS_PLURAL = {
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
  third_place: "3rd Place",
};

const isKnockoutFixture = (fixture) =>
  KO_STAGES.includes(fixture?.stage);

const isByeFixture = (fixture) => {
  if (!fixture) return false;
  if (fixture.status === "bye") return true;
  if (!isKnockoutFixture(fixture)) return false;
  const hasHome = !!fixture.homeTeamId;
  const hasAway = !!fixture.awayTeamId;
  // A slot awaiting a feeder result ("Winner Semifinal 1") is TBD, not a bye.
  if (!hasHome && fixture.homeSource) return false;
  if (!hasAway && fixture.awaySource) return false;
  return hasHome !== hasAway;
};

const getByeAdvancer = (fixture) => {
  if (!fixture) return null;
  if (fixture.homeTeamId) {
    return {
      side: "home",
      teamId: fixture.homeTeamId,
      teamName: fixture.homeTeamName || "Team",
      teamLogo: fixture.homeTeamLogo,
    };
  }
  if (fixture.awayTeamId) {
    return {
      side: "away",
      teamId: fixture.awayTeamId,
      teamName: fixture.awayTeamName || "Team",
      teamLogo: fixture.awayTeamLogo,
    };
  }
  const winnerId = fixture.result?.winnerTeamId;
  if (winnerId) {
    const isHome = String(winnerId) === String(fixture.homeTeamId);
    return {
      side: isHome ? "home" : "away",
      teamId: winnerId,
      teamName: isHome
        ? fixture.homeTeamName
        : fixture.awayTeamName || "Team",
      teamLogo: isHome ? fixture.homeTeamLogo : fixture.awayTeamLogo,
    };
  }
  return null;
};

const fixturesById = (fixtures = []) => {
  const map = new Map();
  for (const f of fixtures || []) {
    if (f?._id) map.set(String(f._id), f);
  }
  return map;
};

const describeByeAdvancement = (fixture, allFixtures = []) => {
  const nextId = fixture?.nextFixtureId;
  if (nextId) {
    const next = fixturesById(allFixtures).get(String(nextId));
    if (next?.label) return next.label;
    if (next?.stage) {
      return KO_STAGE_LABELS[next.stage] || "next round";
    }
  }
  const order = KO_STAGES.indexOf(fixture?.stage);
  if (order >= 0 && order < KO_STAGES.length - 1) {
    const nextStage = KO_STAGES[order + 1];
    return KO_STAGE_LABELS[nextStage] || "next round";
  }
  return "next round";
};

const getKnockoutQualifierCount = (koFixtures = []) => {
  const rounds = (koFixtures || [])
    .map((f) => Number(f.round))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!rounds.length) return 0;
  const firstRound = Math.min(...rounds);
  const ids = new Set();
  for (const f of koFixtures) {
    if (Number(f.round) !== firstRound) continue;
    if (f.homeTeamId) ids.add(String(f.homeTeamId));
    if (f.awayTeamId) ids.add(String(f.awayTeamId));
  }
  return ids.size;
};

const countFirstRoundByes = (koFixtures = []) => {
  const rounds = (koFixtures || [])
    .map((f) => Number(f.round))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!rounds.length) return 0;
  const firstRound = Math.min(...rounds);
  return (koFixtures || []).filter(
    (f) => Number(f.round) === firstRound && isByeFixture(f),
  ).length;
};

const stageHeaderLabel = (stage, matchCount) => {
  const base = KO_STAGE_LABELS_PLURAL[stage] || stage;
  return matchCount > 1 ? `${base} (${matchCount})` : base;
};

const bracketSubtitle = (format, koFixtures = []) => {
  if (format !== "hybrid" || !koFixtures.length) return null;
  const qualifiers = getKnockoutQualifierCount(koFixtures);
  const byes = countFirstRoundByes(koFixtures);
  if (!qualifiers) return "Knockout stage";
  if (byes > 0) {
    return `Knockout stage · ${qualifiers} teams · ${byes} bye${byes === 1 ? "" : "s"}`;
  }
  return `Knockout stage · ${qualifiers} teams`;
};

module.exports = {
  KO_STAGES,
  KO_STAGE_LABELS,
  KO_STAGE_LABELS_PLURAL,
  isKnockoutFixture,
  isByeFixture,
  getByeAdvancer,
  describeByeAdvancement,
  getKnockoutQualifierCount,
  countFirstRoundByes,
  stageHeaderLabel,
  bracketSubtitle,
};
