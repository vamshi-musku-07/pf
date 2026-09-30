import { useCallback, useEffect, useRef, useState } from "react";
import { getTeamsAPI, getTeamByIdAPI } from "@/services/TeamApi";
import { getSchedulesByTeamAPI } from "@/services/ScheduleApi";
import { getGamesByTeamAPI } from "@/services/GameApi";
import { getJoinedEventsAPI } from "@/services/EventApi";
import { loadTeamsList, loadTeamDetail } from "@/lib/teamCache";
import {
  readUpcomingCache,
  writeUpcomingCache,
  readMemoryUpcomingCache,
  writeMemoryUpcomingCache,
  isCacheFresh,
  clearUpcomingCache,
} from "@/lib/homeUpcomingCache";
import {
  getEntityId,
  formatUpcomingTime,
  formatUpcomingDate,
  formatUpcomingDateLong,
  isUpcomingDate,
  extractList,
  scheduleDedupeKey,
  getDefaultOpponentId,
  opponentFromRoster,
  getPrimaryOpponent,
  getTeamDisplayName,
  resolveTeamLogoSource,
  teamAbbrev,
  needsOpponentFetch,
  isValidOpponentDisplay,
  teamHasLinkedOpponent,
} from "@/lib/homeUpcomingGames";

const DISPLAY_LIMIT = 3;
const SCAN_TEAM_LIMIT = 6;
const CONCURRENCY = 3;
const CANDIDATE_TARGET = 4;

let inflightRefresh = null;

function teamKey(team) {
  return String(team?._id || team?.id || "");
}

function extractSchedules(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.schedules)) return payload.schedules;
  return [];
}

async function mapPool(items, limit, worker) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// Loads the full set of team ids the user has access to. Results are
// memoized inside a single refresh cycle so we don't fire getTeamsAPI multiple
// times for what is effectively the same request.
async function fetchActiveTeamIdSet(prefetched) {
  if (prefetched?.list) {
    const ids = new Set();
    for (const t of prefetched.list) {
      const id = teamKey(t);
      if (id) ids.add(id);
    }
    return ids;
  }

  const ids = new Set();
  const addId = (team) => {
    const id = teamKey(team);
    if (id) ids.add(id);
  };

  try {
    const res = await getTeamsAPI({ page: 1, limit: 50 });
    for (const t of extractList(res)) addId(t);
  } catch {
    const cached = await loadTeamsList();
    if (Array.isArray(cached)) for (const t of cached) addId(t);
  }

  return ids;
}

function filterCardsForActiveTeams(cards, activeTeamIds) {
  if (!Array.isArray(cards)) return [];
  return cards.filter(
    (card) =>
      card?.kind === "joinedEvent" ||
      (activeTeamIds?.size && activeTeamIds.has(String(card.teamId))),
  );
}

async function getTeamsFast(activeTeamIds, prefetched) {
  const map = new Map();
  const add = (team) => {
    const id = teamKey(team);
    if (!id) return;
    if (activeTeamIds?.size && !activeTeamIds.has(id)) return;
    map.set(id, { ...team, _id: team._id || team.id });
  };

  // Reuse already-fetched team list to avoid another round-trip in the same cycle.
  if (Array.isArray(prefetched?.list) && prefetched.list.length) {
    for (const t of prefetched.list) add(t);
    return Array.from(map.values()).slice(0, SCAN_TEAM_LIMIT);
  }

  let loadedFromApi = false;
  try {
    const res = await getTeamsAPI({ page: 1, limit: SCAN_TEAM_LIMIT });
    const list = extractList(res);
    if (list.length) {
      loadedFromApi = true;
      for (const t of list) add(t);
    }
  } catch {
    /* fall back to cache below */
  }

  if (!loadedFromApi) {
    const cached = await loadTeamsList();
    if (Array.isArray(cached)) {
      for (const t of cached) {
        if (activeTeamIds?.size && !activeTeamIds.has(teamKey(t))) continue;
        add(t);
      }
    }
  }

  return Array.from(map.values()).slice(0, SCAN_TEAM_LIMIT);
}

function isTeamNotFoundError(err) {
  const status = err?.response?.status;
  return status === 404 || status === 410;
}

async function loadTeamCached(teamId, cache) {
  const key = String(teamId);
  const cached = cache.get(key);
  if (cached?.team && Array.isArray(cached.team.opponents) && cached.team.opponents.length > 0) {
    return cached;
  }

  let schedules = [];
  const detail = await loadTeamDetail(teamId);
  if (Array.isArray(detail?.schedules)) schedules = detail.schedules;

  try {
    const res = await getTeamByIdAPI(teamId);
    const team = res?.data || res?.team || res;
    const payload = { team, schedules };
    cache.set(key, payload);
    return payload;
  } catch (err) {
    if (isTeamNotFoundError(err)) return null;
    if (detail?.team) {
      const payload = { team: detail.team, schedules };
      cache.set(key, payload);
      return payload;
    }
    if (cached) return cached;
    return null;
  }
}

async function loadSchedules(teamId, prefetched) {
  if (Array.isArray(prefetched)) return prefetched;
  try {
    const schRes = await getSchedulesByTeamAPI(teamId);
    return extractSchedules(schRes);
  } catch {
    return [];
  }
}

async function resolveOpponentForEntry(entry, teamCache, opponentCache) {
  const team =
    teamCache.get(String(entry.teamId))?.team || entry.team;

  if (!teamHasLinkedOpponent(team)) return null;

  let oppId = getEntityId(entry.opponentId) || getDefaultOpponentId(team);
  let opponent = oppId ? opponentFromRoster(team, oppId) : null;
  opponent = opponent || getPrimaryOpponent(team);
  if (!oppId && opponent?._id) oppId = String(opponent._id);

  const key = String(oppId || `linked-${entry.teamId}`);
  const cached = opponentCache.get(key);
  if (cached && isValidOpponentDisplay(cached)) return cached;

  if (oppId && needsOpponentFetch(opponent)) {
    try {
      const res = await getTeamByIdAPI(oppId);
      const full = res?.data || res?.team || res;
      if (full) {
        opponent = {
          ...full,
          teamName: getTeamDisplayName(full, ""),
          teamlogo: full.teamlogo || full.logo || opponent?.teamlogo,
          sport: full.sport || opponent?.sport,
        };
      }
    } catch {
      /* roster fallback below */
    }
  }

  if (!isValidOpponentDisplay(opponent)) {
    opponent = getPrimaryOpponent(team);
  }

  if (isValidOpponentDisplay(opponent)) {
    opponentCache.set(key, opponent);
    return opponent;
  }

  return null;
}

function toSide(team) {
  const name = getTeamDisplayName(team, "Team");
  return { name, abbrev: teamAbbrev(name), logo: resolveTeamLogoSource(team) };
}

function buildEventLabel({ title, eventType } = {}) {
  const type = String(eventType || "game").toLowerCase();
  if (type === "other") return title?.trim() || "Other";
  if (type === "practice") return "Practice";
  return "Game";
}

function toCardModel(entry, opponentTeam) {
  const { team, teamId, startIso, location, gameId, scheduleId, sport, title, eventType } =
    entry;
  const linked = entry.hasLinkedOpponent ?? teamHasLinkedOpponent(team);
  const awaySource =
    isValidOpponentDisplay(opponentTeam) ? opponentTeam : getPrimaryOpponent(team);
  const hasOpponent = linked && isValidOpponentDisplay(awaySource);
  return {
    kind: "teamGame",
    id: gameId || scheduleId || `${teamId}-${startIso}`,
    teamId,
    gameId: gameId || null,
    scheduleId: scheduleId || null,
    hasOpponent,
    eventType: eventType || "game",
    homeTeam: toSide(team),
    awayTeam: hasOpponent ? toSide(awaySource) : null,
    eventLabel: buildEventLabel({ title, eventType }),
    timeLabel: formatUpcomingTime(startIso),
    dateLabel: formatUpcomingDate(startIso),
    dateLongLabel: formatUpcomingDateLong(startIso),
    place: (location || team?.location || "").trim(),
    startTime: startIso,
    sport: sport || team?.sport,
  };
}

function getJoinedEventStart(event) {
  if (!event?.date) return null;
  const date = new Date(event.date);
  if (!Number.isFinite(date.getTime())) return null;

  if (event.time) {
    const [hours, minutes] = String(event.time).split(":").map(Number);
    date.setHours(
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      0,
      0,
    );
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function formatEventCategory(category) {
  const normalized = String(category || "event").trim();
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractJoinedEvents(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.events)) return payload.events;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function toJoinedEventCard(event) {
  const start = getJoinedEventStart(event);
  if (!start) return null;
  const startIso = start.toISOString();
  const eventId = getEntityId(event._id || event.id);
  if (!eventId) return null;

  return {
    kind: "joinedEvent",
    id: `event-${eventId}`,
    eventId,
    title: String(event.title || "Upcoming event").trim(),
    description: String(event.description || "").trim(),
    category: String(event.category || "event").toLowerCase(),
    eventLabel: formatEventCategory(event.category),
    timeLabel: formatUpcomingTime(startIso),
    dateLabel: formatUpcomingDate(startIso),
    dateLongLabel: formatUpcomingDateLong(startIso),
    place: String(event.location || "").trim(),
    startTime: startIso,
    participantCount:
      Number(
        event.participantCount ??
          (Array.isArray(event.participants) ? event.participants.length : 0),
      ) || 0,
    maxParticipants: Number(event.maxParticipants) || 0,
    creatorName: String(event.creatorName || "").trim(),
  };
}

async function fetchJoinedEventCards() {
  const payload = await getJoinedEventsAPI();
  return extractJoinedEvents(payload)
    .filter((event) => String(event?.status || "active").toLowerCase() !== "cancelled")
    .map(toJoinedEventCard)
    .filter((card) => card && isUpcomingDate(card.startTime))
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
}

function mergeUpcomingCards(teamCards, eventCards) {
  const merged = [...teamCards, ...eventCards].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const selected = merged.slice(0, DISPLAY_LIMIT);

  // A busy game schedule should not completely hide events the user joined.
  if (
    eventCards.length > 0 &&
    selected.length === DISPLAY_LIMIT &&
    !selected.some((card) => card.kind === "joinedEvent")
  ) {
    selected[selected.length - 1] = eventCards[0];
    selected.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }

  return selected;
}

function collectFromSchedules(schedules, team, teamId, raw, seenScheduleKeys) {
  for (const s of schedules) {
    const startIso = s.startDate || s.date;
    if (!isUpcomingDate(startIso)) continue;

    const dedupeKey = scheduleDedupeKey(s);
    if (seenScheduleKeys.has(dedupeKey)) continue;
    seenScheduleKeys.add(dedupeKey);

    const scheduleTeamId = getEntityId(s.teamId);
    let opponentId = getEntityId(s.opponentTeamId);
    if (scheduleTeamId && scheduleTeamId !== teamId && opponentId === teamId) {
      opponentId = scheduleTeamId;
    }
    if (!opponentId) opponentId = getDefaultOpponentId(team);

    raw.push({
      team,
      teamId,
      startIso,
      location: s.location,
      opponentId,
      scheduleId: s._id,
      sport: team?.sport,
      title: s.title,
      eventType: s.eventType || "game",
      hasLinkedOpponent: teamHasLinkedOpponent(team),
    });
  }
}

function collectFromGames(games, team, teamId, raw, seenScheduleKeys, seenGameIds) {
  for (const base of games) {
    const game = base?.base || base;
    if (game.status && game.status !== "scheduled") continue;

    const gameId = getEntityId(game._id);
    if (gameId && seenGameIds.has(gameId)) continue;

    const startIso = game.startTime || game.createdAt;
    if (!isUpcomingDate(startIso)) continue;

    if (gameId) seenGameIds.add(gameId);
    if (game.scheduleId && seenScheduleKeys.has(String(game.scheduleId))) continue;

    let opponentId = getEntityId(game.opponentTeamId);
    if (!opponentId) opponentId = getDefaultOpponentId(team);

    raw.push({
      team,
      teamId,
      startIso,
      location: game.venue,
      opponentId,
      gameId,
      scheduleId: game.scheduleId,
      sport: game.sport || team?.sport,
      eventType: "game",
      hasLinkedOpponent: teamHasLinkedOpponent(team),
    });
  }
}

async function fetchUpcomingCards(prefetched) {
  const activeTeamIds = await fetchActiveTeamIdSet(prefetched);
  const teams = await getTeamsFast(activeTeamIds, prefetched);
  if (!teams.length) return [];

  const teamCache = new Map();
  const opponentCache = new Map();
  const raw = [];
  const seenScheduleKeys = new Set();
  const seenGameIds = new Set();
  let stopEarly = false;

  await mapPool(teams, CONCURRENCY, async (briefTeam) => {
    if (stopEarly) return;
    const teamId = teamKey(briefTeam);
    if (!teamId) return;

    const loaded = await loadTeamCached(teamId, teamCache);
    if (!loaded?.team) return;
    const team = loaded.team;
    teamCache.set(teamId, loaded);

    const schedules = await loadSchedules(teamId, loaded?.schedules);
    collectFromSchedules(schedules, team, teamId, raw, seenScheduleKeys);

    if (raw.length < CANDIDATE_TARGET) {
      try {
        const gamesRes = await getGamesByTeamAPI(teamId, { status: "scheduled" });
        collectFromGames(
          extractList(gamesRes),
          team,
          teamId,
          raw,
          seenScheduleKeys,
          seenGameIds,
        );
      } catch {
        /* schedules are enough */
      }
    }

    if (raw.length >= CANDIDATE_TARGET) stopEarly = true;
  });

  raw.sort(
    (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime(),
  );

  const picked = raw.slice(0, DISPLAY_LIMIT);

  const cards = await Promise.all(
    picked.map(async (entry) => {
      const opponentTeam = await resolveOpponentForEntry(
        entry,
        teamCache,
        opponentCache,
      );
      return toCardModel(entry, opponentTeam);
    }),
  );

  return filterCardsForActiveTeams(cards, activeTeamIds);
}

async function runRefresh(prefetched) {
  const [teamsResult, eventsResult] = await Promise.allSettled([
    fetchUpcomingCards(prefetched),
    fetchJoinedEventCards(),
  ]);

  if (teamsResult.status === "rejected" && eventsResult.status === "rejected") {
    throw teamsResult.reason || eventsResult.reason;
  }

  const teamCards =
    teamsResult.status === "fulfilled" ? teamsResult.value : [];
  const eventCards =
    eventsResult.status === "fulfilled" ? eventsResult.value : [];

  return mergeUpcomingCards(teamCards, eventCards);
}

export { clearUpcomingCache };

export function useHomeUpcomingGames() {
  const [upcoming, setUpcoming] = useState(() => readMemoryUpcomingCache() || []);
  const [loading, setLoading] = useState(() => !readMemoryUpcomingCache());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (options = {}) => {
    const { force = false, silent = false } = options;

    // Fetch the team list once and reuse it for both the active-team filter
    // and downstream getTeamsFast so we never hit /teams more than once per cycle.
    let prefetchedTeamList = null;
    try {
      const res = await getTeamsAPI({ page: 1, limit: 50 });
      const list = extractList(res);
      if (Array.isArray(list)) prefetchedTeamList = list;
    } catch {
      const cached = await loadTeamsList();
      if (Array.isArray(cached)) prefetchedTeamList = cached;
    }
    const prefetched = prefetchedTeamList ? { list: prefetchedTeamList } : null;
    const activeTeamIds = await fetchActiveTeamIdSet(prefetched);

    if (!force && isCacheFresh()) {
      const mem = readMemoryUpcomingCache();
      const pruned = filterCardsForActiveTeams(mem, activeTeamIds);
      if (pruned.length !== (mem?.length || 0)) {
        writeMemoryUpcomingCache(pruned);
        if (mountedRef.current) setUpcoming(pruned);
      }
      if (pruned.length) return;
    }

    const cachedRaw = readMemoryUpcomingCache() || (await readUpcomingCache());
    const cached = filterCardsForActiveTeams(cachedRaw, activeTeamIds);
    const hasCached = Boolean(cached?.length);

    if (hasCached) {
      if (mountedRef.current) {
        setUpcoming(cached);
        setLoading(false);
      }
    } else if (!silent) {
      if (mountedRef.current) setLoading(true);
    }

    if (mountedRef.current) {
      setRefreshing(hasCached);
      setError(null);
    }

    if (inflightRefresh) {
      try {
        const cards = await inflightRefresh;
        if (mountedRef.current) {
          setUpcoming(cards);
          setLoading(false);
          setRefreshing(false);
        }
      } catch {
        /* handled by leader */
      }
      return;
    }

    inflightRefresh = runRefresh(prefetched)
      .then(async (cards) => {
        await writeUpcomingCache(cards);
        return cards;
      })
      .finally(() => {
        inflightRefresh = null;
      });

    try {
      const cards = await inflightRefresh;
      if (mountedRef.current) {
        setUpcoming(cards);
        if (!cards.length) {
          setError(null);
        }
      }
    } catch (err) {
      if (mountedRef.current && !hasCached) {
        setUpcoming([]);
        setError(err?.message || "Could not load upcoming events");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  return { upcoming, loading, refreshing, error, refresh };
}
