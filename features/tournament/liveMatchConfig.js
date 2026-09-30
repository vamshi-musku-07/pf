// Pure helpers for premium match cards in the Matches tab.

const KO_STAGE_LABELS = {
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
  third_place: "3rd Place",
};

export const resolveFixtureTeamName = (fixture, side) => {
  if (!fixture) return "TBD";
  if (side === "home") {
    return fixture.homeTeamName || fixture.homeSource || "TBD";
  }
  return fixture.awayTeamName || fixture.awaySource || "TBD";
};

export const buildMatchHeadline = (fixture) => {
  const home = resolveFixtureTeamName(fixture, "home");
  const away = resolveFixtureTeamName(fixture, "away");
  return `${home} vs ${away}`;
};

/** @deprecated use buildMatchHeadline */
export const buildLiveMatchHeadline = buildMatchHeadline;

export const describeMatchStage = (fixture) => {
  if (!fixture) return "Match";
  if (fixture.label && String(fixture.label).trim()) return String(fixture.label).trim();
  if (KO_STAGE_LABELS[fixture.stage]) return KO_STAGE_LABELS[fixture.stage];
  if (fixture.stage === "league") {
    if (fixture.divisionName) return fixture.divisionName;
    if (fixture.matchNumber) return `League · Match ${fixture.matchNumber}`;
    return "League match";
  }
  return fixture.stage ? String(fixture.stage).replace(/_/g, " ") : "Match";
};

/** @deprecated use describeMatchStage */
export const describeLiveMatchStage = describeMatchStage;

export const formatInningsScore = (side) => {
  if (!side || side.runs == null) return null;
  return `${side.runs}/${side.wickets ?? 0}`;
};

/** Cricket runs/wickets, football goals (+ pens), or volleyball sets won. */
export const formatFixtureSideScore = (side, sport) => {
  if (!side) return null;
  const sportName = String(sport || "").toLowerCase();
  if (sportName === "football") {
    if (side.goals == null && side.runs == null) return null;
    const goals = side.goals != null ? side.goals : side.runs;
    const pens = Number(side.pens || 0);
    if (pens > 0) return `${goals} (${pens})`;
    return String(goals ?? 0);
  }
  if (sportName === "volleyball") {
    if (side.setsWon == null && side.sets == null) {
      // Fall back to margin-style display via caller if only margin exists
      return side.setsWon != null ? String(side.setsWon) : null;
    }
    return String(side.setsWon ?? 0);
  }
  if (sportName === "baseball") {
    if (side.runs == null) return null;
    return String(side.runs ?? 0);
  }
  if (sportName === "basketball") {
    if (side.points == null) return null;
    return String(side.points ?? 0);
  }
  return formatInningsScore(side);
};

export const describePastResult = (fixture) => {
  const res = fixture?.result;
  if (!res) return null;
  if (res.isNoResult) return res.margin || "No result";
  if (res.isTie || (!res.winnerTeamId && !res.isNoResult)) return res.margin || "Tie";
  return res.margin || null;
};

export const isHomeWinner = (fixture) =>
  !!fixture?.result?.winnerTeamId &&
  String(fixture.result.winnerTeamId) === String(fixture.homeTeamId);

export const isAwayWinner = (fixture) =>
  !!fixture?.result?.winnerTeamId &&
  String(fixture.result.winnerTeamId) === String(fixture.awayTeamId);

const isFixtureLiveStatus = (fixture) => {
  const liveStatuses = new Set(["live", "halftime"]);
  return liveStatuses.has(fixture?.gameStatus) || liveStatuses.has(fixture?.status);
};

const isFixturePastStatus = (fixture) =>
  fixture?.status === "completed" || fixture?.status === "bye";

/** Pick live / upcoming / past theme for a fixture (matches Matches tab logic). */
export const resolveMatchCardVariant = (fixture) => {
  if (isFixtureLiveStatus(fixture)) return "live";
  if (isFixturePastStatus(fixture)) return "past";
  return "upcoming";
};

export const MATCH_CARD_THEMES = {
  live: {
    eyebrow: "Now playing",
    badge: "LIVE",
    badgeColor: "#FCA5A5",
    badgeBg: "rgba(239,68,68,0.2)",
    badgeBorder: "rgba(248,113,113,0.55)",
    dotColor: "#EF4444",
    accent: "#BAF072",
    accentSoft: "rgba(186,240,114,0.35)",
    border: "rgba(186,240,114,0.28)",
    vsColor: "#BAF072",
    gradient: ["#0B1324", "#141B33", "#0F172A"],
    ctaBg: "#BAF072",
    ctaText: "#0B1324",
    ctaIcon: "play-circle",
    ctaLabel: "Watch live",
  },
  upcoming: {
    eyebrow: "Up next",
    badge: "UPCOMING",
    badgeColor: "#93C5FD",
    badgeBg: "rgba(59,130,246,0.18)",
    badgeBorder: "rgba(96,165,250,0.45)",
    dotColor: null,
    accent: "#60A5FA",
    accentSoft: "rgba(96,165,250,0.35)",
    border: "rgba(96,165,250,0.28)",
    vsColor: "#60A5FA",
    gradient: ["#0B1324", "#152238", "#0F172A"],
    ctaBg: "rgba(255,255,255,0.08)",
    ctaText: "#CBD5E1",
    ctaIcon: "calendar-outline",
    ctaLabel: "Not started yet",
  },
  past: {
    eyebrow: "Full time",
    badge: "RESULT",
    badgeColor: "#A7F3D0",
    badgeBg: "rgba(16,185,129,0.15)",
    badgeBorder: "rgba(52,211,153,0.4)",
    dotColor: null,
    accent: "#34D399",
    accentSoft: "rgba(52,211,153,0.35)",
    border: "rgba(52,211,153,0.22)",
    vsColor: "#94A3B8",
    gradient: ["#0F172A", "#1A2332", "#111827"],
    ctaBg: "rgba(255,255,255,0.08)",
    ctaText: "#E2E8F0",
    ctaIcon: "stats-chart-outline",
    ctaLabel: "View scorecard",
  },
};
