/** Duty values rotated by sport (matches helpers.jsx option values). */
export const ROTATION_DUTIES_CRICKET = ["scorer", "umpire", "drinks"];
export const ROTATION_DUTIES_DEFAULT = ["score-keeper", "water", "snacks"];

const EVENT_TYPE_LABEL = {
  game: "game",
  practice: "practice",
  other: "event",
};

const EVENT_TYPE_PLURAL = {
  game: "games",
  practice: "practices",
  other: "events",
};

const DUTY_ALIASES = {
  scorer: ["scorer", "backup scorer"],
  umpire: ["umpire"],
  drinks: ["drinks duty", "drinks"],
  "score-keeper": ["score keeper", "scorer"],
  water: ["water"],
  snacks: ["snacks", "tea / snacks"],
  "field-prep": ["pitch / field prep", "field prep"],
};

const playerIdOf = (player) =>
  String(player?.userId || player?._id || player?.id || "").trim();

const playerNameOf = (player) =>
  `${player?.firstName || ""} ${player?.lastName || ""}`.trim() || "Player";

const eventIdOf = (event) => String(event?._id || event?.id || "");

const eventDateOf = (event) =>
  new Date(event?.startDate || event?.date || 0).getTime();

export const normalizeDutyKey = (title, assignmentOptions = []) => {
  const raw = String(title || "").toLowerCase().trim();
  if (!raw) return "";

  for (const opt of assignmentOptions) {
    const value = String(opt.value || "").toLowerCase();
    const label = String(opt.label || "").toLowerCase();
    if (raw === label || raw === value) return value;
  }

  for (const [key, aliases] of Object.entries(DUTY_ALIASES)) {
    if (aliases.some((a) => raw === a || raw.includes(a))) return key;
  }

  return raw.replace(/\s+/g, "-");
};

export const getRotationDuties = (sport, assignmentOptions = []) => {
  const isCricket = String(sport || "").toLowerCase() === "cricket";
  const wanted = isCricket ? ROTATION_DUTIES_CRICKET : ROTATION_DUTIES_DEFAULT;
  return assignmentOptions.filter(
    (o) => o.value !== "custom" && wanted.includes(o.value),
  );
};

const getRecentEventIds = (schedules, { excludeEventId, lookbackEvents, eventType }) => {
  const events = (schedules || [])
    .filter((s) => !eventType || s.eventType === eventType)
    .filter((s) => eventIdOf(s) && eventIdOf(s) !== String(excludeEventId || ""))
    .sort((a, b) => eventDateOf(b) - eventDateOf(a));

  return events.slice(0, lookbackEvents).map(eventIdOf);
};

const buildDutyHistory = (assignments, recentEventIds, assignmentOptions, eventType) => {
  const history = {};

  for (const row of assignments || []) {
    if (eventType && row.eventType !== eventType) continue;
    const eid = String(row.eventId || "");
    if (!recentEventIds.includes(eid)) continue;

    const duty = normalizeDutyKey(row.assignment, assignmentOptions);
    const pid = String(row.assignedToId || "");
    if (!duty || !pid) continue;

    if (!history[pid]) history[pid] = {};
    history[pid][duty] = (history[pid][duty] || 0) + 1;
  }

  return history;
};

const pickPlayerForDuty = ({
  players,
  dutyValue,
  history,
  assignedThisRound,
  allowReuse,
}) => {
  const eligible = (players || []).filter((p) => playerIdOf(p));
  const pool = allowReuse
    ? eligible
    : eligible.filter((p) => !assignedThisRound.has(playerIdOf(p)));

  if (pool.length === 0) return null;

  const scored = pool.map((player) => {
    const pid = playerIdOf(player);
    const dutyCount = history[pid]?.[dutyValue] || 0;
    const totalRecent = Object.values(history[pid] || {}).reduce((s, n) => s + n, 0);
    return { player, pid, dutyCount, totalRecent };
  });

  scored.sort((a, b) => {
    if (a.dutyCount !== b.dutyCount) return a.dutyCount - b.dutyCount;
    if (a.totalRecent !== b.totalRecent) return a.totalRecent - b.totalRecent;
    return playerNameOf(a.player).localeCompare(playerNameOf(b.player));
  });

  return scored[0];
};

const buildReason = (dutyCount, lookbackEvents, eventType = "game") => {
  const label = EVENT_TYPE_PLURAL[eventType] || "events";
  if (dutyCount === 0) {
    return `Has not done this duty in the last ${lookbackEvents} ${label}`;
  }
  if (dutyCount === 1) {
    return `Did this once in the last ${lookbackEvents} ${label}`;
  }
  return `Did this ${dutyCount} times in the last ${lookbackEvents} ${label} (lowest on team)`;
};

/**
 * Fair rotation for duties using recent assignment history for the same event type.
 */
export const computeFairAssignments = ({
  players = [],
  assignments = [],
  schedules = [],
  assignmentOptions = [],
  sport,
  eventId,
  eventType = "game",
  lookbackEvents = 3,
}) => {
  const duties = getRotationDuties(sport, assignmentOptions);
  const recentEventIds = getRecentEventIds(schedules, {
    excludeEventId: eventId,
    lookbackEvents,
    eventType,
  });
  const history = buildDutyHistory(assignments, recentEventIds, assignmentOptions, eventType);
  const assignedThisRound = new Set();
  const picks = [];

  for (const duty of duties) {
    let chosen = pickPlayerForDuty({
      players,
      dutyValue: duty.value,
      history,
      assignedThisRound,
      allowReuse: false,
    });

    if (!chosen) {
      chosen = pickPlayerForDuty({
        players,
        dutyValue: duty.value,
        history,
        assignedThisRound,
        allowReuse: true,
      });
    }

    if (!chosen) continue;

    assignedThisRound.add(chosen.pid);
    picks.push({
      dutyValue: duty.value,
      dutyLabel: duty.label,
      player: chosen.player,
      playerId: chosen.pid,
      playerName: playerNameOf(chosen.player),
      recentCount: chosen.dutyCount,
      reason: buildReason(chosen.dutyCount, lookbackEvents, eventType),
    });
  }

  return {
    picks,
    recentEventIds,
    lookbackEvents,
    eventType,
  };
};

export const getDefaultRotationEvent = (schedules = []) => {
  const now = Date.now();
  const events = (schedules || [])
    .filter((s) => eventIdOf(s))
    .sort((a, b) => eventDateOf(a) - eventDateOf(b));

  const upcoming = events.find((g) => eventDateOf(g) >= now);
  return upcoming || events[events.length - 1] || null;
};

const eventTypeTag = (eventType) => {
  if (eventType === "practice") return "Practice";
  if (eventType === "other") return "Event";
  return "Game";
};

const eventTitleOf = (event) => {
  if (!event) return "Event";
  if (event.eventType === "practice") return event.title || event.name || "Practice";
  if (event.eventType === "other") return event.title || event.name || "Team event";
  return event.opponentName || event.title || event.name || "Game";
};

export const getRotationEventTitle = eventTitleOf;

export const formatEventLabel = (event) => {
  if (!event) return "Select an event";
  const date = new Date(event.startDate || event.date);
  const dateStr = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const title = eventTitleOf(event);
  const tag = eventTypeTag(event.eventType);
  const core = dateStr ? `${dateStr} · ${title}` : title;
  return `${tag} · ${core}`;
};

export const buildFallbackTeamMessage = ({
  teamName,
  coachName,
  eventTitle,
  eventDate,
  eventType = "game",
  picks = [],
}) => {
  const lines = picks.map((p) => `• ${p.dutyLabel}: ${p.playerName}`);
  const typeLabel = EVENT_TYPE_LABEL[eventType] || "event";
  const signer = coachName ? `\n\n— ${coachName}` : "";
  const header = `Team duties for ${teamName || "the team"}`;
  const when = [eventTitle, eventDate].filter(Boolean).join(" · ");
  return `${header} (${typeLabel}${when ? ` · ${when}` : ""}):\n\n${lines.join("\n")}\n\nPlease confirm in the Assignments tab. Thanks everyone!${signer}`;
};
