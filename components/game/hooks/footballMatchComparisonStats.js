const SHOT_TYPES = new Set([
  "goal",
  "shot",
  "shot_on_target",
  "shot_off_target",
  "penalty_scored",
  "penalty_missed",
]);

const ON_TARGET_TYPES = new Set(["goal", "shot_on_target", "penalty_scored"]);

const FOUL_TYPES = new Set(["foul", "foul_committed"]);
const YELLOW_TYPES = new Set(["yellow_card", "second_yellow"]);
const RED_TYPES = new Set(["red_card", "second_yellow"]);
const SAVE_TYPES = new Set(["save", "gk_save"]);
const TACKLE_TYPES = new Set(["tackle", "tackle_won"]);

const emptySide = () => ({ home: 0, away: 0 });

const sideOfEvent = (event, homeTeamId) => {
  const tid = String(event?.teamId || "");
  if (!tid || !homeTeamId) return null;
  return tid === String(homeTeamId) ? "home" : "away";
};

const periodOfEvent = (event) => {
  const p = Number(event?.period);
  if (p === 1 || p === 2) return p;
  // Extra time / unknown — count toward ALL only
  return null;
};

const add = (bucket, side, n = 1) => {
  if (!side || !bucket) return;
  bucket[side] = Number(bucket[side] || 0) + n;
};

/**
 * Aggregate football match stats from events for a period filter.
 * @param {"all"|1|2} period
 */
export const aggregateFootballEventStats = (events = [], homeTeamId, period = "all") => {
  const buckets = {
    total_shots: emptySide(),
    shots_on_target: emptySide(),
    corners: emptySide(),
    fouls: emptySide(),
    offsides: emptySide(),
    yellow_cards: emptySide(),
    red_cards: emptySide(),
    saves: emptySide(),
    free_kicks: emptySide(),
    tackles: emptySide(),
    goals: emptySide(),
    eventShare: emptySide(),
  };

  for (const ev of events || []) {
    if (!ev?.eventType) continue;
    const ep = periodOfEvent(ev);
    if (period !== "all") {
      if (ep !== Number(period)) continue;
    }
    const side = sideOfEvent(ev, homeTeamId);
    if (!side) continue;

    add(buckets.eventShare, side, 1);

    const type = ev.eventType;
    if (SHOT_TYPES.has(type) && !ev.isShootoutPenalty) add(buckets.total_shots, side);
    if (ON_TARGET_TYPES.has(type) && !ev.isShootoutPenalty) add(buckets.shots_on_target, side);
    if (type === "corner") add(buckets.corners, side);
    if (FOUL_TYPES.has(type)) add(buckets.fouls, side);
    if (type === "offside") add(buckets.offsides, side);
    if (YELLOW_TYPES.has(type)) add(buckets.yellow_cards, side);
    if (RED_TYPES.has(type)) add(buckets.red_cards, side);
    if (SAVE_TYPES.has(type)) add(buckets.saves, side);
    if (type === "free_kick") add(buckets.free_kicks, side);
    if (TACKLE_TYPES.has(type)) add(buckets.tackles, side);
    if ((type === "goal" || (type === "penalty_scored" && !ev.isShootoutPenalty))) {
      add(buckets.goals, side);
    }
    if (type === "own_goal") {
      add(buckets.goals, side === "home" ? "away" : "home");
    }
  }

  return buckets;
};

const sumPlayerStat = (playerStats, homeTeamId, key) => {
  const out = emptySide();
  for (const ps of playerStats || []) {
    if (!ps) continue;
    const side = String(ps.teamId || "") === String(homeTeamId) ? "home" : "away";
    add(out, side, Number(ps[key] || 0));
  }
  return out;
};

const readMatchBucket = (matchStats, key) => {
  const b = matchStats?.[key];
  return {
    home: Number(b?.home || 0),
    away: Number(b?.away || 0),
  };
};

const possessionFromShare = (share) => {
  const home = Number(share?.home || 0);
  const away = Number(share?.away || 0);
  const total = home + away;
  if (total <= 0) return { home: 50, away: 50 };
  const homePct = Math.round((home / total) * 100);
  return { home: homePct, away: 100 - homePct };
};

const resolvePossession = (matchStats, eventShare, period) => {
  if (period === "all") {
    const home = Number(matchStats?.possession?.home);
    const away = Number(matchStats?.possession?.away);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      const isDefault = home === 50 && away === 50;
      const hasEvents = eventShare.home + eventShare.away > 0;
      // Prefer stored possession when it was actually set; otherwise estimate from events
      if (!isDefault || !hasEvents) {
        const total = home + away;
        if (total <= 0) return possessionFromShare(eventShare);
        if (total > 100) {
          const h = Math.round((home / total) * 100);
          return { home: h, away: 100 - h };
        }
        const h = Math.round(home);
        return { home: h, away: Math.max(0, 100 - h) };
      }
    }
  }
  return possessionFromShare(eventShare);
};

const FOOTBALL_ROWS = [
  { key: "total_shots", label: "Total shots" },
  { key: "shots_on_target", label: "Shots on target" },
  { key: "saves", label: "Goalkeeper saves" },
  { key: "corners", label: "Corner kicks" },
  { key: "fouls", label: "Fouls" },
  { key: "passes", label: "Passes" },
  { key: "tackles", label: "Tackles" },
  { key: "free_kicks", label: "Free kicks" },
  { key: "offsides", label: "Offsides" },
  { key: "yellow_cards", label: "Yellow cards" },
  { key: "red_cards", label: "Red cards" },
];

/**
 * Build football match comparison stats for a period.
 * @returns {{ possession: {home, away}, rows: Array<{key,label,home,away}> }}
 */
export const buildFootballMatchComparisonStats = ({
  sport,
  homeTeamId,
  period = "all",
} = {}) => {
  const matchStats = sport?.matchStats || {};
  const events = sport?.events || [];
  const playerStats = sport?.playerStats || [];
  const fromEvents = aggregateFootballEventStats(events, homeTeamId, period);

  const pick = (key) => {
    if (period === "all") {
      // Prefer live matchStats for core counters when available
      const fromMatch = readMatchBucket(matchStats, key);
      if (key === "saves") return sumPlayerStat(playerStats, homeTeamId, "saves");
      if (key === "tackles") {
        const fromPs = sumPlayerStat(playerStats, homeTeamId, "tackles");
        if (fromPs.home + fromPs.away > 0) return fromPs;
        return fromEvents.tackles;
      }
      if (key === "free_kicks") {
        const fromPs = sumPlayerStat(playerStats, homeTeamId, "free_kicks");
        if (fromPs.home + fromPs.away > 0) return fromPs;
        return fromEvents.free_kicks;
      }
      if (key === "passes") return readMatchBucket(matchStats, "passes");
      if (fromMatch.home + fromMatch.away > 0) return fromMatch;
      return fromEvents[key] || emptySide();
    }
    // Period filter: events only (passes not tracked per period)
    if (key === "passes") return emptySide();
    return fromEvents[key] || emptySide();
  };

  const possession = resolvePossession(matchStats, fromEvents.eventShare, period);

  const rows = FOOTBALL_ROWS.map(({ key, label }) => {
    const vals = pick(key);
    return {
      key,
      label,
      home: Number(vals.home || 0),
      away: Number(vals.away || 0),
    };
  }).filter((row) => {
    // Keep core rows even at 0; hide rarely-tracked empty rows
    if (["passes", "tackles", "free_kicks", "saves", "red_cards", "offsides"].includes(row.key)) {
      return row.home + row.away > 0;
    }
    return true;
  });

  return { possession, rows };
};

export const FOOTBALL_STAT_PERIODS = [
  { key: "all", label: "ALL" },
  { key: "1", label: "1ST" },
  { key: "2", label: "2ND" },
];
