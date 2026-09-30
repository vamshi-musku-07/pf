// Pure tournament create-flow helpers (no React). Used by create.jsx and unit tests.

const DIVISION_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const QUALIFIERS_PER_DIVISION_OPTIONS = [1, 2, 3];

const SINGLE_DIVISION_PLAYOFF_OPTIONS = [2, 4, 8];

const isFootballSport = (sport) => String(sport || "").toLowerCase() === "football";
const isVolleyballSport = (sport) => String(sport || "").toLowerCase() === "volleyball";
const isCricketSport = (sport) => String(sport || "").toLowerCase() === "cricket";
const isBaseballSport = (sport) => String(sport || "").toLowerCase() === "baseball";
const isBasketballSport = (sport) => String(sport || "").toLowerCase() === "basketball";
/** Football + volleyball + baseball use group/pool-stage wording; cricket uses divisions. */
const usesGroupWording = (sport) =>
  isFootballSport(sport) || isVolleyballSport(sport) || isBaseballSport(sport) || isBasketballSport(sport);

const VOLLEYBALL_MATCH_FORMATS = [
  { id: "best_of_3", label: "Best of 3", totalSets: 3 },
  { id: "best_of_5", label: "Best of 5", totalSets: 5 },
];

const DEFAULT_VOLLEYBALL_POINTS = {
  pointsWinStraight: 3,
  pointsWinClose: 2,
  pointsLossClose: 1,
  pointsLossStraight: 0,
  pointsNoResult: 0,
};

/** Display label for division/group unit (football/volleyball/basketball → Groups, baseball → Pools). */
const divisionUnitLabel = (sport, { plural = false, capitalize = true } = {}) => {
  const baseball = isBaseballSport(sport);
  const groups = usesGroupWording(sport) && !baseball;
  const word = baseball
    ? plural
      ? "pools"
      : "pool"
    : groups
      ? plural
        ? "groups"
        : "group"
      : plural
        ? "divisions"
        : "division";
  if (!capitalize) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/** Suggest division count from enrolled team count (e.g. 12 → 3). */
const suggestDivisionCount = (teamCount) => {
  const n = Number(teamCount) || 0;
  if (n < 4) return 1;
  if (n <= 8) return 2;
  if (n <= 12) return 3;
  if (n <= 16) return 4;
  if (n <= 24) return 6;
  if (n <= 32) return 8;
  return 12;
};

/** Human-readable division/group layout for create flow / Manage hints. */
const describeDivisionLayout = (divisionCount, teamCount, sport) => {
  const divs = Math.max(1, Number(divisionCount) || 1);
  const unit = divisionUnitLabel(sport, { plural: false, capitalize: false });
  const units = divisionUnitLabel(sport, { plural: true, capitalize: false });
  if (divs === 1) {
    if (isBaseballSport(sport)) {
      return "Single pool — all teams play each other in one league table.";
    }
    return usesGroupWording(sport)
      ? "Single group — all teams play each other in one league table."
      : "Single division — all teams play each other in one league table.";
  }
  const teams = Number(teamCount) || 0;
  if (teams >= divs) {
    const base = Math.floor(teams / divs);
    const rem = teams % divs;
    if (rem === 0) {
      return `${divs} ${units} · ~${base} teams each. Assign teams in Manage before generating fixtures.`;
    }
    return `${divs} ${units} · ~${base}–${base + 1} teams each. Assign teams in Manage before generating fixtures.`;
  }
  return `${divs} ${units} — round-robin within each ${unit}. Assign teams in Manage before generating fixtures.`;
};

/** Static tip for common team counts (no team count input on create screen). */
const divisionCountTip = (divisionCount, sport) => {
  const divs = Number(divisionCount) || 1;
  const examples = { 2: "8 teams", 3: "12 teams", 4: "16 teams", 6: "24 teams" };
  const example = examples[divs];
  if (!example) return null;
  const per = { 2: 4, 3: 4, 4: 4, 6: 4 }[divs];
  if (usesGroupWording(sport)) {
    const units = divisionUnitLabel(sport, { plural: true, capitalize: true });
    return `Recommended: ${divs} ${units} × ${per} Teams (${example})`;
  }
  return `Tip: ${example} works well with ${divs} divisions (${per} per division).`;
};

/**
 * Format-aware tip when multiple divisions/groups are selected.
 * League = separate champions; hybrid = winners (or top K) meet in playoffs.
 */
const divisionPlayoffTip = (format, divisionCount, sport) => {
  const divs = Math.max(1, Number(divisionCount) || 1);
  if (divs < 2) return null;
  const units = divisionUnitLabel(sport, { plural: true, capitalize: false });
  const Unit = divisionUnitLabel(sport, { plural: false, capitalize: true });
  const unitLower = divisionUnitLabel(sport, { plural: false, capitalize: false });
  if (format === "round_robin") {
    return usesGroupWording(sport)
      ? `No finals between ${units} — each ${unitLower} crowns its own champion.`
      : "No finals between divisions — each division crowns its own champion.";
  }
  if (format === "hybrid") {
    return usesGroupWording(sport)
      ? `After the ${unitLower} stage, generate playoffs so ${Unit} winners (or top K) meet for the overall title.`
      : "After the league, you generate playoffs so Div 1 / Div 2 / … winners (or top K) play each other for the overall title.";
  }
  return null;
};

/** Tournament type cards — football/volleyball/baseball/basketball use familiar cup / group-stage wording. */
const getCreateFormats = (sport) => {
  if (usesGroupWording(sport)) {
    const unit = isBaseballSport(sport) ? "pool" : "group";
    const Unit = unit.charAt(0).toUpperCase() + unit.slice(1);
    return [
      {
        id: "round_robin",
        label: isBaseballSport(sport) ? "League / Round Robin" : "League",
        desc: isVolleyballSport(sport)
          ? "Teams play a round-robin league. Standings use match points from set results."
          : isBasketballSport(sport)
            ? "Teams play a round-robin league. Standings use points, head-to-head and point differential."
          : isBaseballSport(sport)
            ? "Teams play a round-robin league ranked by winning percentage and run differential."
            : "Teams play a round-robin league. The team with the most points wins the championship.",
      },
      {
        id: "knockout",
        label: isFootballSport(sport) ? "Knockout Cup" : "Knockout",
        desc: `Single-elimination bracket — win or go home. No ${unit} stage.`,
      },
      {
        id: "hybrid",
        label: isBaseballSport(sport) ? "Pool Stage + Knockout" : "Group Stage + Knockout",
        desc: `${Unit} stage followed by knockout playoffs.`,
        recommended: true,
      },
    ];
  }
  return [
    {
      id: "round_robin",
      label: "League",
      desc: "Teams play only inside their division. Each division has its own champion — winners do not meet.",
    },
    {
      id: "knockout",
      label: "Knockout",
      desc: "Single-elimination bracket — win or go home. No league phase.",
    },
    {
      id: "hybrid",
      label: "League + Knockout",
      desc: "League inside each division, then top teams from every division enter one knockout for the overall title.",
      recommended: true,
    },
  ];
};

/**
 * Build playoff-related config for tournament create/update payloads.
 */
const buildHybridPlayoffConfig = ({
  format,
  divisionCount = 1,
  qualifiersPerDivision = 1,
  playoffTeams = 4,
}) => {
  const divs = Math.max(1, Number(divisionCount) || 1);
  const multiDivHybrid = format === "hybrid" && divs > 1;
  const perDiv = Math.max(1, Number(qualifiersPerDivision) || 1);

  if (format !== "hybrid") {
    return {
      qualifiersPerDivision: 0,
      playoffSeeding: "global",
      playoffTeams: 4,
    };
  }

  if (multiDivHybrid) {
    return {
      qualifiersPerDivision: perDiv,
      playoffSeeding: "per_division",
      playoffTeams: divs * perDiv,
    };
  }

  return {
    qualifiersPerDivision: 0,
    playoffSeeding: "global",
    playoffTeams: Math.max(2, Number(playoffTeams) || 4),
  };
};

/** Knockout bracket stage label from qualifier count. */
const describeKnockoutAutoStage = (qualifierCount) => {
  const n = Math.max(0, Number(qualifierCount) || 0);
  if (n < 2) return "Knockout bracket — need at least 2 qualifiers.";
  let size = 1;
  while (size < n) size *= 2;
  const byes = size - n;
  const stages = [];
  let round = size;
  while (round > 1) {
    if (round === 2) stages.push("Final");
    else if (round === 4) stages.push("Semi-finals");
    else if (round === 8) stages.push("Quarter-finals");
    else stages.push(`Round of ${round}`);
    round /= 2;
  }
  const stageList = stages.reverse().join(" → ");
  if (byes > 0) {
    return `${n} qualifiers → ${stageList} (${byes} bye${byes === 1 ? "" : "s"} for top seeds)`;
  }
  return `${n} qualifiers → ${stageList}`;
};

/**
 * Visual knockout preview steps for create UI.
 * e.g. ["Top 1 from each Group", "Semi-finals", "Final"]
 */
const describeKnockoutPreviewSteps = ({
  sport,
  format,
  divisionCount = 1,
  qualifiersPerDivision = 1,
  playoffTeams = 4,
} = {}) => {
  if (format !== "hybrid") return [];
  const cfg = buildHybridPlayoffConfig({
    format,
    divisionCount,
    qualifiersPerDivision,
    playoffTeams,
  });
  const n = Math.max(0, Number(cfg.playoffTeams) || 0);
  if (n < 2) return ["Need at least 2 qualifiers"];

  const unit = usesGroupWording(sport)
    ? divisionUnitLabel(sport, { plural: false, capitalize: true })
    : "division";
  const divs = Math.max(1, Number(divisionCount) || 1);
  const per = Math.max(1, Number(qualifiersPerDivision) || 1);

  const steps = [];
  if (divs > 1 && cfg.playoffSeeding === "per_division") {
    steps.push(`Top ${per} from each ${unit}`);
  } else {
    steps.push(`Top ${n} from the league`);
  }

  let size = 1;
  while (size < n) size *= 2;
  const stages = [];
  let round = size;
  while (round > 1) {
    if (round === 2) stages.push("Final");
    else if (round === 4) stages.push("Semi-finals");
    else if (round === 8) stages.push("Quarter-finals");
    else stages.push(`Round of ${round}`);
    round /= 2;
  }
  steps.push(...stages.reverse());
  return steps;
};

/** Build volleyball match + standings config for create/update payloads. */
const buildVolleyballMatchConfig = ({
  matchFormat = "best_of_5",
  totalSets,
  setPoints = 25,
  decidingSetPoints = 15,
  winByTwo = true,
  pointsWinStraight = DEFAULT_VOLLEYBALL_POINTS.pointsWinStraight,
  pointsWinClose = DEFAULT_VOLLEYBALL_POINTS.pointsWinClose,
  pointsLossClose = DEFAULT_VOLLEYBALL_POINTS.pointsLossClose,
  pointsLossStraight = DEFAULT_VOLLEYBALL_POINTS.pointsLossStraight,
  pointsNoResult = DEFAULT_VOLLEYBALL_POINTS.pointsNoResult,
} = {}) => {
  const fmt = String(matchFormat || "best_of_5").toLowerCase() === "best_of_3"
    ? "best_of_3"
    : "best_of_5";
  const sets = Number(totalSets) || (fmt === "best_of_3" ? 3 : 5);
  return {
    matchFormat: fmt,
    totalSets: sets === 3 ? 3 : 5,
    setPoints: Math.max(1, Number(setPoints) || 25),
    decidingSetPoints: Math.max(1, Number(decidingSetPoints) || 15),
    winByTwo: winByTwo !== false,
    pointsWinStraight: Math.max(0, Number(pointsWinStraight) || 0),
    pointsWinClose: Math.max(0, Number(pointsWinClose) || 0),
    pointsLossClose: Math.max(0, Number(pointsLossClose) || 0),
    pointsLossStraight: Math.max(0, Number(pointsLossStraight) || 0),
    pointsNoResult: Math.max(0, Number(pointsNoResult) || 0),
    // Keep legacy keys unused by volleyball standings engine
    pointsWin: Math.max(0, Number(pointsWinStraight) || 0),
    pointsTie: 0,
    pointsLoss: Math.max(0, Number(pointsLossStraight) || 0),
  };
};

const BASEBALL_INNINGS_OPTIONS = [
  { id: "5", innings: 5 },
  { id: "7", innings: 7 },
  { id: "9", innings: 9 },
  { id: "Custom", innings: 7 },
];

const BASEBALL_EXTRA_INNINGS_OPTIONS = [
  { id: "unlimited", label: "Unlimited" },
  { id: "max_1", label: "Maximum 1" },
  { id: "max_2", label: "Maximum 2" },
  { id: "off", label: "Off (allow ties in pool)" },
  { id: "custom", label: "Custom" },
];

const BASEBALL_TIME_LIMIT_OPTIONS = [
  { id: "0", minutes: 0, label: "No limit" },
  { id: "90", minutes: 90, label: "90 minutes" },
  { id: "120", minutes: 120, label: "120 minutes" },
  { id: "Custom", minutes: 90, label: "Custom" },
];

const DEFAULT_BASEBALL_MERCY_RULES = [
  { afterInning: 5, leadRuns: 10 },
  { afterInning: 7, leadRuns: 8 },
];

const DEFAULT_BASEBALL_TIE_BREAKERS = [
  "win_percentage",
  "head_to_head",
  "run_differential",
  "runs_scored",
  "runs_allowed",
  "draw",
];

/** Build baseball match + standings config for create/update payloads. */
const buildBaseballMatchConfig = ({
  scheduledInnings = 7,
  extraInnings = "unlimited",
  extraInningsMax = 0,
  allowPoolTies = true,
  mercyRuleEnabled = true,
  mercyRules = DEFAULT_BASEBALL_MERCY_RULES,
  timeLimitMinutes = 0,
  tieBreakers = DEFAULT_BASEBALL_TIE_BREAKERS,
  runDifferentialCap = 0,
} = {}) => {
  const innings = Math.max(1, Number(scheduledInnings) || 7);
  let extras = String(extraInnings || "unlimited").toLowerCase();
  if (!["off", "unlimited", "max_1", "max_2", "custom"].includes(extras)) extras = "unlimited";
  const cleanedMercy = (Array.isArray(mercyRules) ? mercyRules : DEFAULT_BASEBALL_MERCY_RULES)
    .map((r) => ({
      afterInning: Math.max(1, Number(r.afterInning) || 0),
      leadRuns: Math.max(1, Number(r.leadRuns) || 0),
    }))
    .filter((r) => r.afterInning > 0 && r.leadRuns > 0);

  return {
    matchFormat: "baseball",
    scheduledInnings: innings,
    extraInnings: extras,
    extraInningsMax: Math.max(0, Number(extraInningsMax) || 0),
    allowPoolTies: allowPoolTies !== false,
    mercyRuleEnabled: mercyRuleEnabled !== false,
    mercyRules: cleanedMercy.length ? cleanedMercy : DEFAULT_BASEBALL_MERCY_RULES,
    timeLimitMinutes: Math.max(0, Number(timeLimitMinutes) || 0),
    tieBreakers:
      Array.isArray(tieBreakers) && tieBreakers.length
        ? tieBreakers
        : DEFAULT_BASEBALL_TIE_BREAKERS,
    runDifferentialCap: Math.max(0, Number(runDifferentialCap) || 0),
    // Baseball ranks by PCT; keep minimal points for compatibility.
    pointsWin: 1,
    pointsTie: 0.5,
    pointsLoss: 0,
    pointsNoResult: 0,
    superOver: false,
  };
};

const BASKETBALL_QUARTER_OPTIONS = [
  { id: "6", minutes: 6 },
  { id: "8", minutes: 8 },
  { id: "10", minutes: 10 },
  { id: "12", minutes: 12 },
  { id: "Custom", minutes: 10 },
];

const BASKETBALL_OVERTIME_OPTIONS = [
  { id: "3", minutes: 3 },
  { id: "5", minutes: 5 },
  { id: "10", minutes: 10 },
  { id: "Custom", minutes: 5 },
];

const BASKETBALL_SHOT_CLOCK_OPTIONS = [
  { id: "24", seconds: 24 },
  { id: "30", seconds: 30 },
  { id: "35", seconds: 35 },
  { id: "Custom", seconds: 24 },
];

const DEFAULT_BASKETBALL_TIE_BREAKERS = [
  "points",
  "head_to_head",
  "point_differential",
  "points_for",
  "points_against",
  "draw",
];

/** Build basketball match + standings config for create/update payloads. */
const buildBasketballMatchConfig = ({
  quarterMinutes = 10,
  overtimeMinutes = 5,
  shotClockSeconds = 24,
  tieBreakers = DEFAULT_BASKETBALL_TIE_BREAKERS,
  pointDifferentialCap = 0,
} = {}) => {
  const quarters = Math.max(1, Number(quarterMinutes) || 10);
  const overtime = Math.max(1, Number(overtimeMinutes) || 5);
  const shotClock = Math.max(1, Number(shotClockSeconds) || 24);
  return {
    matchFormat: "basketball",
    totalQuarters: 4,
    quarterMinutes: quarters,
    overtimeMinutes: overtime,
    shotClockSeconds: shotClock,
    basketballTieBreakers:
      Array.isArray(tieBreakers) && tieBreakers.length
        ? tieBreakers
        : DEFAULT_BASKETBALL_TIE_BREAKERS,
    pointDifferentialCap: Math.max(0, Number(pointDifferentialCap) || 0),
    // Basketball pool standings
    pointsWin: 2,
    pointsTie: 0,
    pointsLoss: 0,
    pointsNoResult: 0,
    superOver: false,
  };
};

module.exports = {
  DIVISION_COUNT_OPTIONS,
  QUALIFIERS_PER_DIVISION_OPTIONS,
  SINGLE_DIVISION_PLAYOFF_OPTIONS,
  VOLLEYBALL_MATCH_FORMATS,
  DEFAULT_VOLLEYBALL_POINTS,
  BASEBALL_INNINGS_OPTIONS,
  BASEBALL_EXTRA_INNINGS_OPTIONS,
  BASEBALL_TIME_LIMIT_OPTIONS,
  DEFAULT_BASEBALL_MERCY_RULES,
  DEFAULT_BASEBALL_TIE_BREAKERS,
  BASKETBALL_QUARTER_OPTIONS,
  BASKETBALL_OVERTIME_OPTIONS,
  BASKETBALL_SHOT_CLOCK_OPTIONS,
  DEFAULT_BASKETBALL_TIE_BREAKERS,
  isFootballSport,
  isVolleyballSport,
  isCricketSport,
  isBaseballSport,
  isBasketballSport,
  usesGroupWording,
  divisionUnitLabel,
  suggestDivisionCount,
  describeDivisionLayout,
  divisionCountTip,
  divisionPlayoffTip,
  getCreateFormats,
  buildHybridPlayoffConfig,
  buildVolleyballMatchConfig,
  buildBaseballMatchConfig,
  buildBasketballMatchConfig,
  describeKnockoutAutoStage,
  describeKnockoutPreviewSteps,
};
