// Pure helpers for tournament Browse search (debounce + query rules).

const BROWSE_SEARCH_DEBOUNCE_MS = 320;
const BROWSE_SEARCH_MIN_CHARS = 2;
const BROWSE_SEARCH_MAX_CHARS = 64;
const BROWSE_DEFAULT_LIMIT = 40;
const BROWSE_SEARCH_FETCH_LIMIT = 50;

const normalizeBrowseQuery = (raw = "") =>
  String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, BROWSE_SEARCH_MAX_CHARS);

/** Empty string means "show default browse list" (no server q filter). */
const sanitizeBrowseQuery = (raw = "") => {
  const q = normalizeBrowseQuery(raw);
  if (q.length < BROWSE_SEARCH_MIN_CHARS) return "";
  return q;
};

const browseSearchHint = (raw = "") => {
  const q = normalizeBrowseQuery(raw);
  if (!q) return "Search by name, venue, season, code, or team";
  if (q.length < BROWSE_SEARCH_MIN_CHARS) {
    return `Type ${BROWSE_SEARCH_MIN_CHARS - q.length} more character${BROWSE_SEARCH_MIN_CHARS - q.length === 1 ? "" : "s"}`;
  }
  return null;
};

module.exports = {
  BROWSE_SEARCH_DEBOUNCE_MS,
  BROWSE_SEARCH_MIN_CHARS,
  BROWSE_SEARCH_MAX_CHARS,
  BROWSE_DEFAULT_LIMIT,
  BROWSE_SEARCH_FETCH_LIMIT,
  normalizeBrowseQuery,
  sanitizeBrowseQuery,
  browseSearchHint,
};
