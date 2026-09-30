const { normalizePlayerId } = require("../../lib/playerRoster");

const RANK_COLORS = ["#F59E0B", "#9CA3AF", "#B45309"];

const LEADERBOARD_CATEGORIES = ["Bat", "Bowl", "Field", "MVP"];

const FOOTBALL_LEADERBOARD_CATEGORIES = ["Goals", "Assists", "Clean sheets", "MVP"];

const BASEBALL_LEADERBOARD_CATEGORIES = ["Batting", "Pitching", "MVP"];
const BASKETBALL_LEADERBOARD_CATEGORIES = ["Scoring", "Playmaking", "Defense", "MVP"];

const FOOTBALL_STATS_SORT_OPTIONS = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "clean_sheets", label: "CS" },
  { key: "mvpPoints", label: "MVP" },
];

const BASEBALL_STATS_SORT_OPTIONS = [
  { key: "runs", label: "R" },
  { key: "hits", label: "H" },
  { key: "homeRuns", label: "HR" },
  { key: "rbi", label: "RBI" },
  { key: "battingAverage", label: "AVG" },
  { key: "strikeouts", label: "K" },
  { key: "mvpPoints", label: "MVP" },
];

const BASKETBALL_STATS_SORT_OPTIONS = [
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
  { key: "threePointsMade", label: "3PM" },
  { key: "fgPercent", label: "FG%" },
  { key: "mvpPoints", label: "MVP" },
];

const STATS_SORT_OPTIONS = [
  { key: "runs", label: "Runs" },
  { key: "wickets", label: "Wickets" },
  { key: "mvpPoints", label: "MVP" },
  { key: "batting_average", label: "Avg" },
  { key: "strike_rate", label: "SR" },
  { key: "economy", label: "Econ" },
];

const num = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const playerDisplayName = (player) => {
  if (!player) return "";
  const full = typeof player.fullName === "string" ? player.fullName.trim() : "";
  if (full) return full;
  const joined = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return String(player.name || player.playerName || "").trim();
};

const buildTournamentPlayerNameMap = (players = []) => {
  const map = {};
  for (const player of Array.isArray(players) ? players : []) {
    const id = normalizePlayerId(player);
    const name = playerDisplayName(player);
    if (id && name) map[id] = name;
    const userId = player?.userId != null ? String(player.userId) : "";
    if (userId && name) map[userId] = name;
  }
  return map;
};

const resolvePlayerDisplayName = (playerId, nameMap = {}, fallback = "", playerRow = null) => {
  const rowName = String(playerRow?.playerName || playerRow?.name || "").trim();
  if (rowName) return rowName;
  const id = playerId != null ? String(playerId) : "";
  if (id && nameMap[id]) return nameMap[id];
  if (fallback) return fallback;
  return id ? `Player ${id.slice(-4)}` : "Unknown";
};

const buildNameMapFromLeaderboard = (leaderboard = {}) => {
  if (!leaderboard || typeof leaderboard !== "object") return {};
  const map = { ...(leaderboard.nameMap || {}) };
  for (const player of leaderboard.players || []) {
    const pid = player?.playerId != null ? String(player.playerId) : "";
    const name = String(player.playerName || "").trim();
    if (pid && name) map[pid] = name;
  }
  return map;
};

const resolvePlayerProfileImage = (playerId, profileMap = {}, playerRow = null) => {
  const rowImage = String(playerRow?.profileImage || playerRow?.playerimage || "").trim();
  if (rowImage) return rowImage;
  const id = playerId != null ? String(playerId) : "";
  return id && profileMap[id] ? profileMap[id] : "";
};

const buildTournamentPlayerProfileMap = (players = []) => {
  const map = {};
  for (const player of Array.isArray(players) ? players : []) {
    const img = String(player.profilePicture || player.playerimage || player.profileImage || "").trim();
    if (!img) continue;
    const id = normalizePlayerId(player);
    if (id) map[id] = img;
    const userId = player?.userId != null ? String(player.userId) : "";
    if (userId) map[userId] = img;
  }
  return map;
};

const buildProfileMapFromLeaderboard = (leaderboard = {}) => {
  if (!leaderboard || typeof leaderboard !== "object") return {};
  const map = { ...(leaderboard.profileMap || {}) };
  for (const player of leaderboard.players || []) {
    const pid = player?.playerId != null ? String(player.playerId) : "";
    const img = String(player.profileImage || player.playerimage || "").trim();
    if (pid && img) map[pid] = img;
  }
  return map;
};

const mergeProfileMaps = (...maps) => {
  const merged = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    Object.assign(merged, map);
  }
  return merged;
};

const mergePlayerNameMaps = (...maps) => {
  const merged = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    Object.assign(merged, map);
  }
  return merged;
};

const formatBestBowling = (best = {}) => {
  const wickets = num(best.wickets);
  const runs = num(best.runs);
  if (wickets <= 0) return "";
  return `${wickets}/${runs}`;
};

const fieldDismissals = (player = {}) =>
  num(player.catches) + num(player.stumpings) + num(player.run_outs);

const decoratePlayer = (player, nameMap, profileMap = {}) => ({
  ...player,
  name: resolvePlayerDisplayName(player.playerId, nameMap, "", player),
  profileImage: resolvePlayerProfileImage(player.playerId, profileMap, player),
  dismissals: fieldDismissals(player),
});

const BOARD_SECTIONS = {
  Bat: [
    {
      key: "topRunScorers",
      title: "Most Runs",
      icon: "trending-up-outline",
      iconColor: "#16A34A",
      formatRow: (p) => ({
        primary: String(p.runs),
        secondary: p.strike_rate ? `${p.strike_rate} SR` : null,
      }),
    },
    {
      key: "bestStrikeRate",
      title: "Best Strike Rate",
      icon: "flash-outline",
      iconColor: "#2563EB",
      formatRow: (p) => ({
        primary: `${p.strike_rate}`,
        secondary: `${p.runs} (${p.balls_faced}b)`,
      }),
    },
    {
      key: "mostSixes",
      title: "Most Sixes",
      icon: "rocket-outline",
      iconColor: "#7C3AED",
      formatRow: (p) => ({
        primary: String(p.sixes),
        secondary: `${p.runs} runs`,
      }),
    },
    {
      key: "mostFours",
      title: "Most Fours",
      icon: "ellipse-outline",
      iconColor: "#0EA5E9",
      formatRow: (p) => ({
        primary: String(p.fours),
        secondary: `${p.runs} runs`,
      }),
    },
  ],
  Bowl: [
    {
      key: "topWicketTakers",
      title: "Most Wickets",
      icon: "medal-outline",
      iconColor: "#DC2626",
      formatRow: (p) => ({
        primary: String(p.wickets),
        secondary: p.economy ? `${p.economy} econ` : null,
      }),
    },
    {
      key: "bestEconomy",
      title: "Best Economy",
      icon: "speedometer-outline",
      iconColor: "#059669",
      formatRow: (p) => ({
        primary: String(p.economy),
        secondary: `${p.wickets} wkts · ${p.overs_bowled || ""} ov`,
      }),
    },
    {
      key: "bestBowling",
      title: "Best Bowling",
      icon: "ribbon-outline",
      iconColor: "#B45309",
      formatRow: (p) => ({
        primary: formatBestBowling(p.best_bowling),
        secondary: `${p.wickets} wkts total`,
      }),
    },
  ],
  Field: [
    {
      key: "bestFielders",
      title: "Best Fielders",
      icon: "hand-left-outline",
      iconColor: "#0891B2",
      formatRow: (p) => ({
        primary: String(p.dismissals),
        secondary: [
          p.catches ? `${p.catches} ct` : null,
          p.stumpings ? `${p.stumpings} st` : null,
          p.run_outs ? `${p.run_outs} ro` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }),
    },
  ],
  MVP: [
    {
      key: "mvp",
      title: "MVP Points",
      icon: "star-outline",
      iconColor: "#F59E0B",
      formatRow: (p) => ({
        primary: String(p.mvpPoints),
        secondary: `${p.runs} runs · ${p.wickets} wkts`,
      }),
    },
  ],
};

const FOOTBALL_BOARD_SECTIONS = {
  Goals: [
    {
      key: "topGoalScorers",
      title: "Top scorers",
      icon: "football-outline",
      iconColor: "#16A34A",
      formatRow: (p) => ({
        primary: String(p.goals),
        secondary: p.assists ? `${p.assists} assists` : null,
      }),
    },
  ],
  Assists: [
    {
      key: "topAssists",
      title: "Most assists",
      icon: "git-branch-outline",
      iconColor: "#2563EB",
      formatRow: (p) => ({
        primary: String(p.assists),
        secondary: p.goals ? `${p.goals} goals` : null,
      }),
    },
  ],
  "Clean sheets": [
    {
      key: "cleanSheets",
      title: "Clean sheets",
      icon: "shield-checkmark-outline",
      iconColor: "#0891B2",
      formatRow: (p) => ({
        primary: String(p.clean_sheets),
        secondary: p.saves ? `${p.saves} saves` : null,
      }),
    },
  ],
  MVP: [
    {
      key: "mvp",
      title: "MVP Points",
      icon: "star-outline",
      iconColor: "#F59E0B",
      formatRow: (p) => ({
        primary: String(p.mvpPoints),
        secondary: `${p.goals || 0} G · ${p.assists || 0} A`,
      }),
    },
  ],
};

const BASEBALL_BOARD_SECTIONS = {
  Batting: [
    {
      key: "topRunScorers",
      title: "Top run scorers",
      icon: "trending-up-outline",
      iconColor: "#16A34A",
      formatRow: (p) => ({
        primary: String(p.runs),
        secondary: p.hits ? `${p.hits} H` : null,
      }),
    },
    {
      key: "topHitters",
      title: "Most hits",
      icon: "ellipse-outline",
      iconColor: "#2563EB",
      formatRow: (p) => ({
        primary: String(p.hits),
        secondary: p.battingAverage != null ? `.${String(p.battingAverage.toFixed(3)).slice(2)} AVG` : null,
      }),
    },
    {
      key: "homeRunLeaders",
      title: "Home run leaders",
      icon: "flash-outline",
      iconColor: "#DC2626",
      formatRow: (p) => ({
        primary: String(p.homeRuns),
        secondary: p.rbi ? `${p.rbi} RBI` : null,
      }),
    },
    {
      key: "rbiLeaders",
      title: "RBI leaders",
      icon: "people-outline",
      iconColor: "#7C3AED",
      formatRow: (p) => ({
        primary: String(p.rbi),
        secondary: p.runs ? `${p.runs} R` : null,
      }),
    },
    {
      key: "battingAverage",
      title: "Batting average",
      icon: "stats-chart-outline",
      iconColor: "#0EA5E9",
      formatRow: (p) => ({
        primary: p.battingAverage != null ? `.${String(Number(p.battingAverage).toFixed(3)).slice(2)}` : ".000",
        secondary: `${p.hits || 0}-${p.atBats || 0}`,
      }),
    },
  ],
  Pitching: [
    {
      key: "strikeoutLeaders",
      title: "Strikeout leaders",
      icon: "flame-outline",
      iconColor: "#B45309",
      formatRow: (p) => ({
        primary: String(p.strikeouts),
        secondary: p.atBats ? `${p.atBats} AB` : null,
      }),
    },
  ],
  MVP: [
    {
      key: "mvp",
      title: "MVP Points",
      icon: "star-outline",
      iconColor: "#F59E0B",
      formatRow: (p) => ({
        primary: String(p.mvpPoints),
        secondary: `${p.runs || 0} R · ${p.rbi || 0} RBI · ${p.homeRuns || 0} HR`,
      }),
    },
  ],
};

const BASKETBALL_BOARD_SECTIONS = {
  Scoring: [
    { key: "topScorers", title: "Top scorers", icon: "basketball-outline", iconColor: "#16A34A", formatRow: (p) => ({ primary: String(p.points), secondary: p.threePointsMade ? `${p.threePointsMade} 3PM` : null }) },
    { key: "fgPercent", title: "Best FG%", icon: "stats-chart-outline", iconColor: "#2563EB", formatRow: (p) => ({ primary: `${Number(p.fgPercent || 0).toFixed(1)}%`, secondary: `${p.fieldGoalsMade || 0}/${p.fieldGoalsAttempted || 0}` }) },
    { key: "topThrees", title: "Top 3-point makers", icon: "flash-outline", iconColor: "#7C3AED", formatRow: (p) => ({ primary: String(p.threePointsMade), secondary: `${p.points || 0} pts` }) },
  ],
  Playmaking: [
    { key: "topAssists", title: "Most assists", icon: "git-branch-outline", iconColor: "#0EA5E9", formatRow: (p) => ({ primary: String(p.assists), secondary: p.points ? `${p.points} pts` : null }) },
    { key: "topRebounders", title: "Top rebounders", icon: "swap-vertical-outline", iconColor: "#B45309", formatRow: (p) => ({ primary: String(p.rebounds), secondary: p.blocks ? `${p.blocks} blk` : null }) },
  ],
  Defense: [
    { key: "topSteals", title: "Most steals", icon: "hand-left-outline", iconColor: "#0891B2", formatRow: (p) => ({ primary: String(p.steals), secondary: p.assists ? `${p.assists} ast` : null }) },
    { key: "topBlocks", title: "Most blocks", icon: "shield-outline", iconColor: "#DC2626", formatRow: (p) => ({ primary: String(p.blocks), secondary: p.rebounds ? `${p.rebounds} reb` : null }) },
  ],
  MVP: [
    { key: "mvp", title: "MVP Points", icon: "star-outline", iconColor: "#F59E0B", formatRow: (p) => ({ primary: String(p.mvpPoints), secondary: `${p.points || 0} PTS · ${p.rebounds || 0} REB · ${p.assists || 0} AST` }) },
  ],
};

const buildLeaderboardSections = (category, leaderboards = {}, nameMap = {}, profileMap = {}, sport = "Cricket") => {
  const sportName = String(sport || "").toLowerCase();
  const boardMap =
    sportName === "football"
      ? FOOTBALL_BOARD_SECTIONS
      : sportName === "baseball"
        ? BASEBALL_BOARD_SECTIONS
        : sportName === "basketball"
          ? BASKETBALL_BOARD_SECTIONS
        : BOARD_SECTIONS;
  const sections = boardMap[category] || [];
  return sections
    .map((section) => {
      const rows = (leaderboards[section.key] || []).map((player) => {
        const decorated = decoratePlayer(player, nameMap, profileMap);
        const formatted = section.formatRow(decorated);
        return {
          playerId: decorated.playerId,
          teamId: decorated.teamId,
          teamName: decorated.teamName,
          name: decorated.name,
          profileImage: decorated.profileImage,
          primary: formatted.primary,
          secondary: formatted.secondary,
        };
      });
      return { ...section, rows };
    })
    .filter((section) => section.rows.length > 0);
};

const hasLeaderboardData = (leaderboards = {}) => {
  const boards = leaderboards || {};
  return Object.keys(boards).some((key) => Array.isArray(boards[key]) && boards[key].length > 0);
};

const sortPlayersForStats = (players = [], sortKey = "runs") => {
  const list = (Array.isArray(players) ? players : []).map((p) => ({ ...p }));
  const key = String(sortKey || "runs");

  const compareDesc = (a, b, field) => num(b[field]) - num(a[field]);
  const compareAsc = (a, b, field) => num(a[field]) - num(b[field]);
  const compareNullableDesc = (a, b, field) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return num(bv) - num(av);
  };
  const compareNullableAsc = (a, b, field) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return num(av) - num(bv);
  };

  list.sort((a, b) => {
    if (key === "wickets") return compareDesc(a, b, "wickets") || compareDesc(a, b, "runs");
    if (key === "mvpPoints") return compareDesc(a, b, "mvpPoints") || compareDesc(a, b, "runs") || compareDesc(a, b, "goals");
    if (key === "batting_average") {
      return compareNullableDesc(a, b, "batting_average") || compareDesc(a, b, "runs");
    }
    if (key === "strike_rate") {
      return compareDesc(a, b, "strike_rate") || compareDesc(a, b, "runs");
    }
    if (key === "economy") {
      return compareNullableAsc(a, b, "economy") || compareDesc(a, b, "wickets");
    }
    if (key === "goals") return compareDesc(a, b, "goals") || compareDesc(a, b, "assists");
    if (key === "assists") return compareDesc(a, b, "assists") || compareDesc(a, b, "goals");
    if (key === "clean_sheets") return compareDesc(a, b, "clean_sheets") || compareDesc(a, b, "saves");
    if (key === "hits") return compareDesc(a, b, "hits") || compareDesc(a, b, "runs");
    if (key === "homeRuns") return compareDesc(a, b, "homeRuns") || compareDesc(a, b, "rbi");
    if (key === "rbi") return compareDesc(a, b, "rbi") || compareDesc(a, b, "runs");
    if (key === "strikeouts") return compareDesc(a, b, "strikeouts") || compareDesc(a, b, "runs");
    if (key === "battingAverage") {
      return compareNullableDesc(a, b, "battingAverage") || compareDesc(a, b, "hits");
    }
    if (key === "points") return compareDesc(a, b, "points") || compareDesc(a, b, "assists");
    if (key === "rebounds") return compareDesc(a, b, "rebounds") || compareDesc(a, b, "points");
    if (key === "assists") return compareDesc(a, b, "assists") || compareDesc(a, b, "points");
    if (key === "steals") return compareDesc(a, b, "steals") || compareDesc(a, b, "points");
    if (key === "blocks") return compareDesc(a, b, "blocks") || compareDesc(a, b, "rebounds");
    if (key === "threePointsMade") return compareDesc(a, b, "threePointsMade") || compareDesc(a, b, "points");
    if (key === "fgPercent") return compareDesc(a, b, "fgPercent") || compareDesc(a, b, "points");
    return compareDesc(a, b, "runs") || compareDesc(a, b, "wickets") || compareDesc(a, b, "goals");
  });

  return list;
};

const formatBattingSummary = (player = {}) => {
  const runs = num(player.runs);
  const balls = num(player.balls_faced);
  const avg = player.batting_average;
  const sr = player.strike_rate;
  const parts = [`${runs}${balls ? ` (${balls})` : ""}`];
  if (avg != null) parts.push(`Avg ${avg}`);
  if (sr) parts.push(`SR ${sr}`);
  return parts.join(" · ");
};

const formatBowlingSummary = (player = {}) => {
  const wickets = num(player.wickets);
  if (!wickets && !num(player.balls_bowled)) return "—";
  const parts = [`${wickets} wkts`];
  if (player.overs_bowled) parts.push(`${player.overs_bowled} ov`);
  if (player.economy) parts.push(`Econ ${player.economy}`);
  const best = formatBestBowling(player.best_bowling);
  if (best) parts.push(`BB ${best}`);
  return parts.join(" · ");
};

const formatFieldingSummary = (player = {}) => {
  const total = fieldDismissals(player);
  if (!total) return "—";
  const parts = [];
  if (player.catches) parts.push(`${player.catches} ct`);
  if (player.stumpings) parts.push(`${player.stumpings} st`);
  if (player.run_outs) parts.push(`${player.run_outs} ro`);
  return parts.length ? parts.join(" · ") : String(total);
};

const formatFootballSummary = (player = {}) => {
  const parts = [];
  if (num(player.goals)) parts.push(`${player.goals} G`);
  if (num(player.assists)) parts.push(`${player.assists} A`);
  if (num(player.clean_sheets)) parts.push(`${player.clean_sheets} CS`);
  return parts.length ? parts.join(" · ") : "—";
};

const formatBaseballSummary = (player = {}) => {
  const parts = [];
  if (num(player.runs)) parts.push(`${player.runs} R`);
  if (num(player.hits)) parts.push(`${player.hits} H`);
  if (num(player.homeRuns)) parts.push(`${player.homeRuns} HR`);
  if (num(player.rbi)) parts.push(`${player.rbi} RBI`);
  if (player.battingAverage != null) {
    const avg = Number(player.battingAverage);
    const text = avg.toFixed(3);
    parts.push(text.startsWith("0") ? text.slice(1) : text);
  }
  return parts.length ? parts.join(" · ") : "—";
};

const formatBasketballSummary = (player = {}) => {
  const parts = [];
  if (num(player.points)) parts.push(`${player.points} PTS`);
  if (num(player.rebounds)) parts.push(`${player.rebounds} REB`);
  if (num(player.assists)) parts.push(`${player.assists} AST`);
  if (num(player.threePointsMade)) parts.push(`${player.threePointsMade} 3PM`);
  if (player.fgPercent != null) parts.push(`${Number(player.fgPercent).toFixed(1)}% FG`);
  return parts.length ? parts.join(" · ") : "—";
};

const statsSortLabel = (sortKey) =>
  [...STATS_SORT_OPTIONS, ...FOOTBALL_STATS_SORT_OPTIONS, ...BASEBALL_STATS_SORT_OPTIONS, ...BASKETBALL_STATS_SORT_OPTIONS].find(
    (o) => o.key === sortKey,
  )?.label || "Runs";

const matchesTeamFilter = (player, teamId) => {
  if (!teamId) return true;
  return String(player?.teamId || "") === String(teamId);
};

/** Filter leaderboard category rows to one team (null/empty = all teams). */
const filterLeaderboardByTeam = (leaderboards = {}, teamId = null) => {
  if (!teamId) return leaderboards || {};
  const filtered = {};
  for (const [key, rows] of Object.entries(leaderboards || {})) {
    filtered[key] = Array.isArray(rows) ? rows.filter((p) => matchesTeamFilter(p, teamId)) : [];
  }
  return filtered;
};

/** Filter full player stats list to one team (null/empty = all teams). */
const filterPlayersByTeam = (players = [], teamId = null) => {
  const list = Array.isArray(players) ? players : [];
  if (!teamId) return list;
  return list.filter((p) => matchesTeamFilter(p, teamId));
};

const resolveTeamFilterLabel = (teams = [], teamId = null) => {
  if (!teamId) return "All teams";
  const match = (teams || []).find((t) => String(t.teamId) === String(teamId));
  return match?.teamName || "Team";
};

module.exports = {
  RANK_COLORS,
  LEADERBOARD_CATEGORIES,
  FOOTBALL_LEADERBOARD_CATEGORIES,
  BASEBALL_LEADERBOARD_CATEGORIES,
  BASKETBALL_LEADERBOARD_CATEGORIES,
  STATS_SORT_OPTIONS,
  FOOTBALL_STATS_SORT_OPTIONS,
  BASEBALL_STATS_SORT_OPTIONS,
  BASKETBALL_STATS_SORT_OPTIONS,
  buildTournamentPlayerNameMap,
  buildTournamentPlayerProfileMap,
  buildNameMapFromLeaderboard,
  buildProfileMapFromLeaderboard,
  mergePlayerNameMaps,
  mergeProfileMaps,
  resolvePlayerDisplayName,
  resolvePlayerProfileImage,
  buildLeaderboardSections,
  hasLeaderboardData,
  sortPlayersForStats,
  formatBattingSummary,
  formatBowlingSummary,
  formatFieldingSummary,
  formatFootballSummary,
  formatBaseballSummary,
  formatBasketballSummary,
  statsSortLabel,
  filterLeaderboardByTeam,
  filterPlayersByTeam,
  resolveTeamFilterLabel,
  fieldDismissals,
  formatBestBowling,
};
