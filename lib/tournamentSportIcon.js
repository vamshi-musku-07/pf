import { CREATE_TEAM_SPORT_ICONS, SPORT_ICONS } from "@/constants/sports";
import { normalizeSportKey } from "@/lib/sportMatch";

/**
 * Resolve the 3D create-team sport icon for tournament list cards.
 * Case-insensitive + common aliases (soccer, ice hockey, etc.).
 */
export const resolveTournamentSportIcon = (sport) => {
  const key = String(sport || "").trim();
  if (!key) return CREATE_TEAM_SPORT_ICONS.Cricket || SPORT_ICONS.Cricket;

  if (CREATE_TEAM_SPORT_ICONS[key]) return CREATE_TEAM_SPORT_ICONS[key];
  if (SPORT_ICONS[key]) return SPORT_ICONS[key];

  const normalized = normalizeSportKey(key);
  const createHit = Object.entries(CREATE_TEAM_SPORT_ICONS).find(
    ([name]) => normalizeSportKey(name) === normalized,
  );
  if (createHit) return createHit[1];

  const sportHit = Object.entries(SPORT_ICONS).find(
    ([name]) => normalizeSportKey(name) === normalized,
  );
  if (sportHit) return sportHit[1];

  if (normalized === "soccer" || normalized === "football") {
    return CREATE_TEAM_SPORT_ICONS.Football;
  }
  if (normalized === "tabletennis") return CREATE_TEAM_SPORT_ICONS.TableTennis;
  if (normalized === "icehockey") return CREATE_TEAM_SPORT_ICONS.IceHockey;

  return CREATE_TEAM_SPORT_ICONS.Cricket || CREATE_TEAM_SPORT_ICONS.Football || SPORT_ICONS.Cricket;
};
