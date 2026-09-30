/** Normalize Mongo / API ids (string or populated object). */
export const normalizeTeamId = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "object") {
    const id = value._id || value.id;
    return id != null ? String(id) : null;
  }
  return String(value);
};

export const normalizePlayerId = (player) => {
  if (!player) return null;
  const id = player._id ?? player.id ?? player.playerId;
  return id != null ? String(id) : null;
};

/** Ensure both _id and id exist for legacy matchers across game UI. */
export const normalizePlayerRecord = (player) => {
  if (!player) return player;
  const id = normalizePlayerId(player);
  if (!id) return player;
  return {
    ...player,
    _id: player._id || id,
    id: player.id || id,
  };
};

/** Parse player-service GET /team/:teamId responses. */
export const extractPlayersFromApiResponse = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.players)) return response.players;
  if (response.data && Array.isArray(response.data.data)) return response.data.data;
  if (response.data && Array.isArray(response.data.players)) return response.data.players;
  return [];
};

export const filterActiveRosterPlayers = (list) =>
  (Array.isArray(list) ? list : []).filter(
    (p) => p && p.role !== "manager" && p.role !== "spectator" && p.isActive !== false,
  );

export const mergeRosterLists = (...lists) => {
  const map = new Map();
  lists.flat().forEach((raw) => {
    const normalized = normalizePlayerRecord(raw);
    const id = normalizePlayerId(normalized);
    if (!id) return;
    const existing = map.get(id);
    map.set(id, existing ? { ...existing, ...normalized } : normalized);
  });
  return [...map.values()];
};

/** Collect every player from a roster map (values may be arrays). */
export const flattenRosterMap = (rosterByTeamId = {}) =>
  mergeRosterLists(...Object.values(rosterByTeamId || {}));

/** Players whose teamId matches a given team (fallback when map keys drift). */
export const playersForTeamId = (list, teamKey) => {
  const id = normalizeTeamId(teamKey);
  if (!id) return [];
  return filterActiveRosterPlayers(list).filter(
    (p) => normalizeTeamId(p?.teamId) === id,
  );
};

/** Map { [teamId]: players[] } into { home, away } for a game. */
export const rostersForGame = (gameBase, rosterByTeamId = {}) => {
  const homeId = normalizeTeamId(gameBase?.teamId);
  const awayId = normalizeTeamId(gameBase?.opponentTeamId);
  const flat = flattenRosterMap(rosterByTeamId);
  const pick = (id) => {
    if (!id) return [];
    const keyed = rosterByTeamId[id] || [];
    return mergeRosterLists(keyed, playersForTeamId(flat, id));
  };
  return {
    homeId,
    awayId,
    home: pick(homeId),
    away: pick(awayId),
  };
};

/** Whether viewerTeamId is the game's home side. */
export const isHomeTeamForViewer = (gameBase, viewerTeamId) =>
  normalizeTeamId(gameBase?.teamId) === normalizeTeamId(viewerTeamId);

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

/** True when the signed-in user's email matches a roster row (player or parent email). */
export const isUserEmailOnRoster = (userEmail, players = []) => {
  const email = normalizeEmail(userEmail);
  if (!email) return false;
  return (Array.isArray(players) ? players : []).some((player) => {
    if (!player) return false;
    return (
      normalizeEmail(player.email) === email ||
      normalizeEmail(player.parentEmail) === email
    );
  });
};

/** True when the viewer is linked to the team roster by account id or email. */
export const isUserLinkedToRoster = (user, players = []) => {
  if (!user) return false;
  const uid = String(user.userId || user.id || user._id || "").trim();
  if (uid) {
    const linked = (Array.isArray(players) ? players : []).some(
      (player) => player?.userId != null && String(player.userId) === uid,
    );
    if (linked) return true;
  }
  return isUserEmailOnRoster(user.email, players);
};

/** External live viewers (not on roster) see a reduced tab set. */
export const isExternalLiveSpectator = ({
  isSpectate = false,
  isOwner = false,
  user = null,
  players = [],
} = {}) => isSpectate && !isOwner && !isUserLinkedToRoster(user, players);

export const EXTERNAL_SPECTATOR_TAB_IDS = ["STATS", "LIVE", "POSTS", "TEAM"];
