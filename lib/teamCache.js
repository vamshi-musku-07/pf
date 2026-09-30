/**
 * teamCache.js
 *
 * Simple AsyncStorage cache for team data.
 * - Teams list is cached so teams.jsx shows instantly on revisit.
 * - Team detail (team + players + schedules + games) is cached per teamId
 *   so [teamId].jsx shows the real team name immediately, even on slow connections.
 *
 * Cache TTL: 30 minutes. After that, stale data is ignored and fresh data is
 * fetched normally. But even during a refresh the cached data is shown first
 * so the user never sees a blank screen or "My Team" placeholder.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const TTL_MS = 30 * 60 * 1000; // 30 minutes

const KEYS = {
  teamsList: "cache:teams_list_v1",
  teamDetail: (id) => `cache:team_detail_v1:${id}`,
};

// ─── Teams List ───────────────────────────────────────────────────────────────

/**
 * Save the teams list to cache (only called on page-1, no-search results).
 * @param {Array} teams
 */
export const saveTeamsList = async (teams) => {
  try {
    await AsyncStorage.setItem(
      KEYS.teamsList,
      JSON.stringify({ teams, ts: Date.now() })
    );
  } catch {
    // Storage errors are non-fatal — the app works fine without cache.
  }
};

/**
 * Load the cached teams list.
 * Returns the array if valid and not expired, otherwise null.
 * @returns {Array|null}
 */
export const loadTeamsList = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.teamsList);
    if (!raw) return null;
    const { teams, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null; // expired
    return Array.isArray(teams) && teams.length > 0 ? teams : null;
  } catch {
    return null;
  }
};

// ─── Team Detail ──────────────────────────────────────────────────────────────

/**
 * Save a team's full detail page data to cache.
 * @param {string} teamId
 * @param {{ team, players, schedules, games, isOwner }} payload
 */
export const saveTeamDetail = async (teamId, payload) => {
  try {
    await AsyncStorage.setItem(
      KEYS.teamDetail(teamId),
      JSON.stringify({ ...payload, ts: Date.now() })
    );
  } catch {
    // Non-fatal.
  }
};

/**
 * Load a team's cached detail data.
 * Returns the payload object if valid, otherwise null.
 * @param {string} teamId
 * @returns {{ team, players, schedules, games, isOwner }|null}
 */
export const loadTeamDetail = async (teamId) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.teamDetail(teamId));
    if (!raw) return null;
    const { ts, ...payload } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null; // expired
    return payload.team ? payload : null; // only return if team object exists
  } catch {
    return null;
  }
};

/**
 * Remove a deleted team from list + detail cache so other screens stay in sync.
 */
/**
 * Merge saved schedule fields into cached team detail (so reopening the tab
 * doesn't flash stale data before the network refresh completes).
 */
export const patchTeamSchedulesInCache = async (teamId, scheduleIds, patch) => {
  if (!teamId || !patch || !scheduleIds?.length) return;
  try {
    const raw = await AsyncStorage.getItem(KEYS.teamDetail(teamId));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.schedules)) return;
    const idSet = new Set(scheduleIds.map((id) => String(id)));
    const schedules = parsed.schedules.map((s) =>
      idSet.has(String(s._id)) ? { ...s, ...patch } : s,
    );
    await AsyncStorage.setItem(
      KEYS.teamDetail(teamId),
      JSON.stringify({ ...parsed, schedules, ts: Date.now() }),
    );
  } catch {
    /* non-fatal */
  }
};

export const removeTeamFromCache = async (teamId) => {
  const id = String(teamId);
  try {
    await AsyncStorage.removeItem(KEYS.teamDetail(id));
    const raw = await AsyncStorage.getItem(KEYS.teamsList);
    if (raw) {
      const { teams, ts } = JSON.parse(raw);
      const next = (teams || []).filter((t) => String(t._id) !== id);
      await AsyncStorage.setItem(
        KEYS.teamsList,
        JSON.stringify({ teams: next, ts }),
      );
    }
  } catch {
    /* non-fatal */
  }
};
