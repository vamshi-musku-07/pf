import { logoRequireMap } from "@/app/team/tabs/helpers";
import { SPORT_ICONS, DEFAULT_SPORT_ICON } from "@/constants/sports";

export const getEntityId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  return value._id || value.id || null;
};

export const getTeamDisplayName = (team, fallback = "Team") => {
  if (!team) return fallback;
  const name = team.teamName || team.name || team.opponentTeamName;
  if (typeof name === "string" && name.trim()) return name.trim();
  return fallback;
};

export const resolveTeamLogoSource = (team) => {
  if (!team) return null;
  const logoKey = team.teamlogo || team.logo || team.teamLogo || team.image;
  if (logoKey && typeof logoKey === "string") {
    if (logoRequireMap[logoKey]) return logoRequireMap[logoKey];
    if (/^https?:\/\//i.test(logoKey)) return { uri: logoKey };
    if (logoKey.startsWith("/")) {
      const mapped = logoRequireMap[logoKey];
      if (mapped) return mapped;
    }
  }
  if (team.sport && SPORT_ICONS[team.sport]) return SPORT_ICONS[team.sport];
  return DEFAULT_SPORT_ICON;
};

/** Build display object from team.opponents[] entry (API shape). */
export const normalizeOpponentEntry = (entry) => {
  if (!entry) return null;

  const details = entry.opponentDetails;
  const embedded =
    entry.opponentTeamId && typeof entry.opponentTeamId === "object"
      ? entry.opponentTeamId
      : null;

  const id = getEntityId(details) || getEntityId(embedded) || getEntityId(entry.opponentTeamId);
  const teamName = getTeamDisplayName(details || embedded || entry, "");
  const teamlogo =
    details?.teamlogo || embedded?.teamlogo || entry.teamlogo || entry.logo;
  const sport = details?.sport || embedded?.sport || entry.sport;

  if (!id && !teamName) return null;

  return {
    _id: id,
    teamName: teamName || "",
    teamlogo,
    sport,
    location: details?.location || embedded?.location || entry.location,
  };
};

export const isValidOpponentDisplay = (team) => {
  const name = getTeamDisplayName(team, "");
  return Boolean(name && name !== "Opponent");
};

export const getPrimaryOpponent = (team) => normalizeOpponentEntry(team?.opponents?.[0]);

export const teamAbbrev = (name, fallback = "TM") => {
  if (!name || typeof name !== "string") return fallback;
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 3) || fallback;
};

export const formatUpcomingTime = (iso) => {
  if (!iso) return "TBD";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
};

export const formatUpcomingDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  } catch {
    return "";
  }
};

export const formatUpcomingDateLong = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

export const recordLabel = (record) => {
  if (!record) return "—";
  const wins = record.wins ?? 0;
  const losses = record.losses ?? 0;
  return `${wins}-${losses}`;
};

/** True if the event has not started yet (small grace for clock skew). */
export const isUpcomingDate = (iso) => {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const graceMs = 15 * 60 * 1000;
  return t >= Date.now() - graceMs;
};

export const extractList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.games)) return payload.games;
  if (Array.isArray(payload.schedules)) return payload.schedules;
  if (Array.isArray(payload.teams)) return payload.teams;
  return [];
};

export const eventTypePriority = (eventType) => {
  if (eventType === "game") return 0;
  if (eventType === "practice") return 1;
  return 2;
};

/** Primary opponent linked on the team (schedule often omits opponentTeamId). */
export const getDefaultOpponentId = (team) => {
  const entry = team?.opponents?.[0];
  if (!entry) return null;
  return (
    getEntityId(entry.opponentDetails) ||
    getEntityId(entry.opponentTeamId) ||
    getEntityId(entry.opponentId)
  );
};

export const teamHasLinkedOpponent = (team) =>
  Boolean(getDefaultOpponentId(team) || getPrimaryOpponent(team));

export const opponentFromRoster = (team, opponentId) => {
  if (!team || !opponentId) return null;
  for (const entry of team.opponents || []) {
    const normalized = normalizeOpponentEntry(entry);
    if (normalized && String(normalized._id) === String(opponentId)) {
      return normalized;
    }
  }
  return null;
};

export const needsOpponentFetch = (opponent) => {
  if (!opponent) return true;
  return !isValidOpponentDisplay(opponent);
};

export const scheduleDedupeKey = (s) => {
  try {
    const when = new Date(s.startDate || s.date).toISOString().slice(0, 16);
    return `${s.eventType || "game"}|${when}|${(s.location || "").trim().toLowerCase()}`;
  } catch {
    return String(s._id);
  }
};
