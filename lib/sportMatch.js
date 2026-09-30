/**
 * Normalize sport names for comparison (Pickleball, pickleball, "Pickle ball", etc.)
 */
export const normalizeSportKey = (sport) =>
  String(sport || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/** Known aliases stored in DB across clients */
const SPORT_ALIAS_GROUPS = [
  ["Football", "football", "Soccer", "soccer"],
  ["Basketball", "basketball"],
  ["Cricket", "cricket"],
  ["Baseball", "baseball"],
  ["Volleyball", "volleyball"],
  ["Tennis", "tennis"],
  ["Table Tennis", "TableTennis", "table tennis", "tabletennis"],
  ["Badminton", "badminton"],
  ["Rugby", "rugby"],
  ["Hockey", "hockey"],
  ["IceHockey", "Ice Hockey", "ice hockey", "icehockey"],
  ["Pickleball", "pickleball", "Pickle ball"],
  ["Chess", "chess"],
];

export const sportsMatch = (a, b) => {
  if (!a || !b) return false;
  return normalizeSportKey(a) === normalizeSportKey(b);
};

/** All sport string variants that should match the given sport */
export const getSportVariants = (sport) => {
  const key = normalizeSportKey(sport);
  if (!key) return [];
  const group = SPORT_ALIAS_GROUPS.find((variants) =>
    variants.some((v) => normalizeSportKey(v) === key),
  );
  if (group) return [...new Set(group)];
  return [String(sport).trim()];
};
