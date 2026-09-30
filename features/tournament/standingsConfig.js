// Pure helpers for the standings table (record / percentage / streak / playoff cut).
// Kept framework-free so they can be unit tested without React Native.

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatRecord = (row = {}) => `${num(row.won)}-${num(row.lost)}`;

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return ".000";
  const text = n.toFixed(3);
  return text.startsWith("0") ? text.slice(1) : text;
};

// Server sends `streak` ("W4"). Older documents only have the last-5 `form`
// array, so derive the run from there when the field is missing.
const formatStreak = (row = {}) => {
  if (typeof row.streak === "string" && row.streak.trim()) return row.streak.trim();
  const form = Array.isArray(row.form) ? row.form.filter(Boolean) : [];
  if (!form.length) return "—";
  const last = String(form[form.length - 1]);
  let count = 0;
  for (let i = form.length - 1; i >= 0 && String(form[i]) === last; i -= 1) count += 1;
  return `${last}${count}`;
};

const streakTone = (streak) => {
  const code = String(streak || "").charAt(0).toUpperCase();
  if (code === "W") return "positive";
  if (code === "L") return "negative";
  return "neutral";
};

// How many teams in this division advance to the knockout stage. Returns 0 when
// nothing qualifies (pure league) or the cut cannot be resolved.
const getPlayoffCutCount = (tournament = {}, format) => {
  const fmt = String(format || tournament.format || "").toLowerCase();
  if (fmt !== "hybrid") return 0;
  const config = tournament.config || {};
  const perDivision = Math.max(0, num(config.qualifiersPerDivision));
  if (perDivision > 0) return perDivision;
  const divisionCount = Math.max(1, (tournament.divisions || []).length);
  const playoffTeams = Math.max(2, num(config.playoffTeams, 4));
  if (divisionCount <= 1) return playoffTeams;
  return Math.max(1, Math.floor(playoffTeams / divisionCount));
};

const BASKETBALL_TIE_BREAK_RULES = [
  "Points",
  "Head-to-head",
  "Point differential",
  "Points for",
  "Fewer points against",
];

const BASKETBALL_LEGEND = [
  { key: "W-L", label: "Wins, losses" },
  { key: "PTS", label: "Points" },
  { key: "PCT", label: "Win percentage" },
  { key: "STR", label: "Current streak" },
];

const formatStandingsUpdatedAt = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  return `${day}, ${time}`;
};

module.exports = {
  formatRecord,
  formatPct,
  formatStreak,
  streakTone,
  getPlayoffCutCount,
  formatStandingsUpdatedAt,
  BASKETBALL_TIE_BREAK_RULES,
  BASKETBALL_LEGEND,
};
