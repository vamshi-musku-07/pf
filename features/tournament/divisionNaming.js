// Pure display naming for the division/group/pool unit.
// Cricket → "Division 1", football/volleyball/basketball → "Group A", baseball → "Pool A".

const { divisionUnitLabel, isFootballSport, isVolleyballSport, isBaseballSport, isBasketballSport } = require("./createConfig");

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Map a stored "Division N" name to its sport-facing display name.
 * Custom names entered by the organizer are kept as-is.
 */
const formatDivisionDisplayName = (divOrName, sport) => {
  const div = typeof divOrName === "string" ? { name: divOrName } : divOrName || {};
  const name = String(div.name || "").trim();
  const lettered = isFootballSport(sport) || isVolleyballSport(sport) || isBasketballSport(sport) || isBaseballSport(sport);
  if (!lettered) return name || "Division 1";
  const unit = isBaseballSport(sport) ? "Pool" : "Group";
  if (new RegExp(`^${unit}\\b`, "i").test(name)) return name;
  const m = name.match(/division\s*(\d+)/i);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < GROUP_LETTERS.length) return `${unit} ${GROUP_LETTERS[idx]}`;
  }
  if (div.order != null) {
    const idx = Number(div.order) - 1;
    if (idx >= 0 && idx < GROUP_LETTERS.length) return `${unit} ${GROUP_LETTERS[idx]}`;
  }
  return name || `${unit} A`;
};

/** Singular/plural unit wording for UI copy. */
const divisionCopy = (sport) => ({
  singular: divisionUnitLabel(sport, { plural: false, capitalize: true }),
  plural: divisionUnitLabel(sport, { plural: true, capitalize: true }),
  singularLower: divisionUnitLabel(sport, { plural: false, capitalize: false }),
  pluralLower: divisionUnitLabel(sport, { plural: true, capitalize: false }),
});

const getDivisionName = (divisions = [], divisionId, sport) => {
  const div = (divisions || []).find((d) => String(d.id) === String(divisionId || "main"));
  if (div) return formatDivisionDisplayName(div, sport);
  if (isBaseballSport(sport)) return "Pool A";
  return (isFootballSport(sport) || isVolleyballSport(sport) || isBasketballSport(sport)) ? "Group A" : "Division 1";
};

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

module.exports = {
  GROUP_LETTERS,
  formatDivisionDisplayName,
  divisionCopy,
  getDivisionName,
  FORMAT_LABEL,
  formatLabelForSport,
};
