// Pure helpers for public tournament browse, feed, and share links.

const FORMAT_LABEL = {
  round_robin: "League",
  knockout: "Knockout",
  hybrid: "League + Knockout",
};

const formatLabelForSport = (format, sport) => {
  const s = String(sport || "").toLowerCase();
  if (format === "hybrid" && s) {
    if (s === "football" || s === "volleyball" || s === "basketball") return "Groups + Knockout";
    if (s === "baseball") return "Pools + Knockout";
    return "Divisions + Knockout";
  }
  return FORMAT_LABEL[format] || format;
};

const STATUS_LABEL = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const formatShortDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
};

/** Sofascore-style date: 21.07.26. */
const formatDotDate = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}.`;
  } catch {
    return null;
  }
};

const STATUS_SHORT = {
  draft: "DRAFT",
  active: "LIVE",
  completed: "FT",
  cancelled: "CXL",
};

const statusShortLabel = (status) =>
  STATUS_SHORT[String(status || "").toLowerCase()] || STATUS_SHORT.draft;

const formatDateRange = (start, end) => {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  if (e) return e;
  return null;
};

const tournamentListSubtitle = (item = {}) => {
  const teamCount = item.teamCount ?? item.teams?.length ?? 0;
  const formatLabel = formatLabelForSport(item.format, item.sport);
  const statusLabel = STATUS_LABEL[item.status] || STATUS_LABEL.draft;
  const dateRange = formatDateRange(item.startDate, item.endDate);
  return [
    formatLabel,
    `${teamCount} team${teamCount === 1 ? "" : "s"}`,
    statusLabel,
    dateRange,
  ]
    .filter(Boolean)
    .join(" · ");
};

const tournamentShareCode = (tournament = {}) =>
  String(tournament.shareCode || tournament._id || "").trim();

/**
 * Browse / share discovery opens the public page (Request to join lives there).
 * Tournament admins are redirected to the full Manage screen from that page.
 * `isSignedIn` kept for call-site compat; it does not change the route.
 */
const resolveTournamentRoute = (tournament = {}, { backTo } = {}) => {
  const code = tournamentShareCode(tournament);
  if (code) {
    return { pathname: `/tournament/public/${code}`, params: backTo ? { backTo } : {} };
  }
  const id = tournament?._id;
  if (id) {
    return { pathname: `/tournament/${id}`, params: backTo ? { backTo } : {} };
  }
  return null;
};

const filterLiveFeedMatches = (matches = []) =>
  (Array.isArray(matches) ? matches : []).filter(
    (m) =>
      m.gameStatus === "live" ||
      m.gameStatus === "halftime" ||
      m.status === "live",
  );

const describeLiveMatch = (match = {}) => {
  const home = match.homeTeamName || "TBD";
  const away = match.awayTeamName || "TBD";
  return `${home} vs ${away}`;
};

module.exports = {
  FORMAT_LABEL,
  formatLabelForSport,
  STATUS_LABEL,
  STATUS_SHORT,
  formatShortDate,
  formatDotDate,
  formatDateRange,
  statusShortLabel,
  tournamentListSubtitle,
  tournamentShareCode,
  resolveTournamentRoute,
  filterLiveFeedMatches,
  describeLiveMatch,
};
