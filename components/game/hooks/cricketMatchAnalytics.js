// Per-match cricket analytics — worm, Manhattan, wagon wheel, partnerships, insights.
// Pure functions over sport.events; safe to call with empty/missing data.

const WICKET_TYPES = new Set([
  "wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket",
]);

const SCORING_TYPES = new Set([
  "dot_ball", "single", "double", "triple", "boundary_4", "boundary_6",
  "ball", "wide", "no_ball", "bye", "leg_bye",
]);

const BOUNDARY_TYPES = new Set(["boundary_4", "boundary_6"]);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const runsFromEvent = (event) => {
  if (event?.runs != null) return num(event.runs);
  switch (event?.eventType) {
    case "dot_ball":
    case "ball":
      return 0;
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "boundary_4":
      return 4;
    case "boundary_6":
      return 6;
    case "wide":
    case "no_ball":
      return 1;
    case "bye":
    case "leg_bye":
      return num(event?.runs) || 1;
    default:
      return 0;
  }
};

const isLegalDelivery = (event) =>
  event && !["wide", "no_ball"].includes(event.eventType);

const getBallIndex = (event, fallback = 0) => {
  const over = num(event?.overNumber);
  const ball = num(event?.ballNumber);
  if (over > 0 && ball > 0) return (over - 1) * 6 + (ball - 1);
  return fallback;
};

export const filterInningsEvents = (events, inningsNum = 1) =>
  (Array.isArray(events) ? events : []).filter(
    (e) => e && (num(e.innings) || 1) === inningsNum,
  );

/** Runs scored in each completed over (1-indexed overs). */
export const buildOverByOverRuns = (events, inningsNum = 1) => {
  const inningsEvents = filterInningsEvents(events, inningsNum);
  const overMap = new Map();
  let ballIdx = 0;

  for (const ev of inningsEvents) {
    if (WICKET_TYPES.has(ev.eventType)) continue;
    if (!SCORING_TYPES.has(ev.eventType)) continue;

    const runs = runsFromEvent(ev);
    if (isLegalDelivery(ev)) {
      const idx = getBallIndex(ev, ballIdx);
      ballIdx = idx + 1;
      const overNum = Math.floor(idx / 6) + 1;
      overMap.set(overNum, (overMap.get(overNum) || 0) + runs);
    } else {
      const overNum = Math.max(1, Math.floor(ballIdx / 6) + 1);
      overMap.set(overNum, (overMap.get(overNum) || 0) + runs);
    }
  }

  const overs = Array.from(overMap.keys()).sort((a, b) => a - b);
  return overs.map((over) => ({ over, runs: overMap.get(over) || 0 }));
};

/** Cumulative runs after each over — worm chart data. */
export const buildWormSeries = (events, inningsNum = 1, totalOvers = 20) => {
  const overRuns = buildOverByOverRuns(events, inningsNum);
  const series = [{ over: 0, runs: 0 }];
  let cumulative = 0;
  for (const { over, runs } of overRuns) {
    cumulative += runs;
    series.push({ over, runs: cumulative });
  }
  const lastOver = series[series.length - 1]?.over || 0;
  for (let o = lastOver + 1; o <= totalOvers; o += 1) {
    series.push({ over: o, runs: cumulative });
  }
  return series;
};

/** Alias for Manhattan bar chart — runs per over. */
export const buildManhattanData = (events, inningsNum = 1) =>
  buildOverByOverRuns(events, inningsNum);

const DIRECTION_TO_ZONE = {
  cover: "off",
  point: "off",
  third_man: "off",
  straight: "straight",
  fine: "leg",
  square: "leg",
  mid_wicket: "leg",
  midwicket: "leg",
};

const SIMPLE_ZONES = ["off", "straight", "leg"];

const resolveZone = (event, index) => {
  const dir = String(event?.shotDirection || "").trim().toLowerCase();
  if (dir && DIRECTION_TO_ZONE[dir]) return DIRECTION_TO_ZONE[dir];
  if (dir && SIMPLE_ZONES.includes(dir)) return dir;
  const over = num(event?.overNumber);
  const ball = num(event?.ballNumber);
  return SIMPLE_ZONES[(over * 6 + ball + index) % 3];
};

/** Simplified wagon wheel — off / straight / leg run distribution. */
export const buildWagonWheelZones = (events, inningsNum = 1) => {
  const zones = {
    off: { runs: 0, boundaries: 0 },
    straight: { runs: 0, boundaries: 0 },
    leg: { runs: 0, boundaries: 0 },
  };
  const inningsEvents = filterInningsEvents(events, inningsNum);
  inningsEvents.forEach((ev, i) => {
    if (!SCORING_TYPES.has(ev.eventType) || WICKET_TYPES.has(ev.eventType)) return;
    const runs = runsFromEvent(ev);
    if (runs <= 0) return;
    const zone = resolveZone(ev, i);
    zones[zone].runs += runs;
    if (BOUNDARY_TYPES.has(ev.eventType) || runs >= 4) {
      zones[zone].boundaries += 1;
    }
  });
  return zones;
};

const RUN_EVENTS = [
  "dot_ball", "single", "double", "triple", "boundary_4", "boundary_6",
  "ball", "wide", "no_ball", "bye", "leg_bye",
];

/** Partnership segments for timeline chart. */
export const buildPartnershipTimeline = (events, inningsNum = 1, nameMap = {}) => {
  const inningsEvents = filterInningsEvents(events, inningsNum);
  const name = (id) => nameMap[String(id)] || "Player";
  const partnerships = [];
  let partStart = 0;
  let partNum = 1;
  let ballAtStart = 0;
  let ballIdx = 0;

  const summarize = (slice, wicketNum) => {
    let runs = 0;
    let balls = 0;
    const batters = new Set();
    for (const ev of slice) {
      if (!RUN_EVENTS.includes(ev.eventType)) continue;
      runs += runsFromEvent(ev);
      if (isLegalDelivery(ev)) {
        balls += 1;
        if (ev.playerId) batters.add(String(ev.playerId));
      }
    }
    const batterIds = [...batters];
    return {
      wicket: wicketNum,
      runs,
      balls,
      runRate: balls > 0 ? ((runs / balls) * 6).toFixed(1) : "0.0",
      startBall: ballAtStart,
      endBall: ballIdx,
      label: batterIds.length >= 2
        ? `${name(batterIds[0])} & ${name(batterIds[1])}`
        : batterIds.length === 1
          ? name(batterIds[0])
          : `Partnership ${wicketNum}`,
    };
  };

  for (let i = 0; i < inningsEvents.length; i += 1) {
    const ev = inningsEvents[i];
    if (isLegalDelivery(ev) && SCORING_TYPES.has(ev.eventType)) {
      ballIdx += 1;
    }
    if (WICKET_TYPES.has(ev.eventType)) {
      partnerships.push(summarize(inningsEvents.slice(partStart, i), partNum));
      partNum += 1;
      partStart = i + 1;
      ballAtStart = ballIdx;
    }
  }
  if (partStart < inningsEvents.length) {
    const p = summarize(inningsEvents.slice(partStart), partNum);
    if (p.runs > 0 || p.balls > 0) partnerships.push({ ...p, notOut: true });
  }
  return partnerships;
};

/** Phase splits: powerplay (first 20% overs), death (last 20%), middle rest. */
export const buildMatchPhaseStats = (events, inningsNum = 1, totalOvers = 20) => {
  const overs = Math.max(1, num(totalOvers));
  const ppEnd = Math.max(1, Math.ceil(overs * 0.2));
  const deathStart = Math.max(ppEnd + 1, Math.floor(overs * 0.8) + 1);

  const phases = {
    powerplay: { label: `Overs 1–${ppEnd}`, runs: 0, wickets: 0, overs: ppEnd },
    middle: { label: `Overs ${ppEnd + 1}–${deathStart - 1}`, runs: 0, wickets: 0, overs: Math.max(0, deathStart - ppEnd - 1) },
    death: { label: `Overs ${deathStart}–${overs}`, runs: 0, wickets: 0, overs: Math.max(0, overs - deathStart + 1) },
  };

  const inningsEvents = filterInningsEvents(events, inningsNum);
  let ballIdx = 0;

  for (const ev of inningsEvents) {
    if (WICKET_TYPES.has(ev.eventType)) {
      const overNum = Math.floor(ballIdx / 6) + 1;
      if (overNum <= ppEnd) phases.powerplay.wickets += 1;
      else if (overNum >= deathStart) phases.death.wickets += 1;
      else phases.middle.wickets += 1;
      continue;
    }
    if (!SCORING_TYPES.has(ev.eventType)) continue;
    const runs = runsFromEvent(ev);
    let overNum = Math.floor(ballIdx / 6) + 1;
    if (isLegalDelivery(ev)) {
      const idx = getBallIndex(ev, ballIdx);
      ballIdx = idx + 1;
      overNum = Math.floor(idx / 6) + 1;
    }
    if (overNum <= ppEnd) phases.powerplay.runs += runs;
    else if (overNum >= deathStart) phases.death.runs += runs;
    else phases.middle.runs += runs;
  }

  return phases;
};

/** Best bowler spell — most wickets in a 4-over window. */
export const findBestBowlerSpell = (events, inningsNum = 1, nameMap = {}) => {
  const inningsEvents = filterInningsEvents(events, inningsNum);
  const bowlerBalls = new Map();

  for (const ev of inningsEvents) {
    if (!isLegalDelivery(ev)) continue;
    const bowlerId = String(ev.bowlerId || ev.bowlerPlayerId || "");
    if (!bowlerId) continue;
    if (!bowlerBalls.has(bowlerId)) bowlerBalls.set(bowlerId, []);
    bowlerBalls.get(bowlerId).push({
      runs: runsFromEvent(ev),
      wicket: WICKET_TYPES.has(ev.eventType),
    });
  }

  let best = null;
  for (const [bowlerId, balls] of bowlerBalls) {
    const window = 24; // 4 overs
    for (let i = 0; i < balls.length; i += 1) {
      const slice = balls.slice(i, i + window);
      if (slice.length < 6) continue;
      const wickets = slice.filter((b) => b.wicket).length;
      const runs = slice.reduce((s, b) => s + b.runs, 0);
      if (!best || wickets > best.wickets || (wickets === best.wickets && runs < best.runs)) {
        best = {
          bowlerId,
          name: nameMap[bowlerId] || "Bowler",
          wickets,
          runs,
          balls: slice.length,
        };
      }
    }
  }
  return best;
};

/** Post-match insight bullets — no AI, rule-based recap. */
export const buildMatchInsights = (sport, { teamNames = {}, inningsNum = 1 } = {}) => {
  const events = sport?.events || [];
  const totalOvers = num(sport?.totalOvers) || 20;
  const phases = buildMatchPhaseStats(events, inningsNum, totalOvers);
  const overRuns = buildOverByOverRuns(events, inningsNum);
  const partnerships = buildPartnershipTimeline(events, inningsNum);
  const insights = [];

  const inn = (sport?.innings || []).find((i) => num(i.inningsNumber) === inningsNum)
    || sport?.innings?.[inningsNum - 1];
  const totalRuns = num(inn?.total_runs);
  const wickets = num(inn?.wickets);

  if (totalRuns > 0) {
    insights.push(`Innings total: ${totalRuns}/${wickets} in ${totalOvers} overs.`);
  }

  if (phases.powerplay.runs > 0) {
    const rr = phases.powerplay.overs > 0
      ? (phases.powerplay.runs / phases.powerplay.overs).toFixed(1)
      : "0.0";
    insights.push(`Powerplay: ${phases.powerplay.runs}/${phases.powerplay.wickets} (RR ${rr}).`);
  }

  if (phases.death.runs > 0 && phases.death.overs > 0) {
    const rr = (phases.death.runs / phases.death.overs).toFixed(1);
    insights.push(`Death overs: ${phases.death.runs}/${phases.death.wickets} (RR ${rr}).`);
  }

  if (overRuns.length > 0) {
    const best = overRuns.reduce((a, b) => (b.runs > a.runs ? b : a), overRuns[0]);
    const worst = overRuns.reduce((a, b) => (b.runs < a.runs ? b : a), overRuns[0]);
    insights.push(`Best over: ${best.runs} runs in over ${best.over}.`);
    if (worst.runs === 0) insights.push(`Dot-ball pressure: ${overRuns.filter((o) => o.runs === 0).length} maiden overs.`);
  }

  if (partnerships.length > 0) {
    const best = partnerships.reduce((a, b) => (b.runs > a.runs ? b : a), partnerships[0]);
    if (best.runs >= 30) {
      insights.push(`Top partnership: ${best.label} — ${best.runs}(${best.balls}) at RR ${best.runRate}.`);
    }
  }

  const boundaries = filterInningsEvents(events, inningsNum).filter(
    (e) => BOUNDARY_TYPES.has(e.eventType),
  ).length;
  if (boundaries >= 4) {
    insights.push(`${boundaries} boundaries hit — aggressive batting spell.`);
  }

  const chasing = inningsNum >= 2 && sport?.result?.target;
  if (chasing) {
    const target = num(sport.result?.target);
    if (totalRuns >= target) {
      insights.push(`Chase completed — reached ${target} with ${10 - wickets} wickets in hand.`);
    } else if (sport?.matchStatus === "finished") {
      insights.push(`Fell short of target ${target} by ${target - totalRuns} runs.`);
    }
  }

  return insights.slice(0, 6);
};

/** Head-to-head comparison between two aggregated player stat objects. */
export const compareCricketPlayers = (playerA, playerB) => {
  if (!playerA || !playerB) return [];
  const rows = [
    { label: "Matches", a: playerA.matches, b: playerB.matches, higherIsBetter: true },
    { label: "Runs", a: playerA.runs, b: playerB.runs, higherIsBetter: true },
    { label: "Average", a: playerA.battingAverage, b: playerB.battingAverage, higherIsBetter: true },
    { label: "Strike Rate", a: playerA.strikeRate, b: playerB.strikeRate, higherIsBetter: true },
    { label: "Wickets", a: playerA.wickets, b: playerB.wickets, higherIsBetter: true },
    { label: "Economy", a: playerA.economy, b: playerB.economy, higherIsBetter: false },
    { label: "4s", a: playerA.fours, b: playerB.fours, higherIsBetter: true },
    { label: "6s", a: playerA.sixes, b: playerB.sixes, higherIsBetter: true },
  ];
  return rows.map((row) => {
    const aNum = num(row.a);
    const bNum = num(row.b);
    let winner = "tie";
    if (aNum !== bNum) {
      const aWins = row.higherIsBetter ? aNum > bNum : aNum < bNum;
      winner = aWins ? "a" : "b";
    }
    return { ...row, winner };
  });
};

export const buildPlayerNameMap = (players = []) => {
  const map = {};
  const list = Array.isArray(players)
    ? players
    : [...(players?.home || []), ...(players?.away || [])];
  for (const p of list) {
    const id = String(p._id || p.id || p.playerId || "");
    if (!id) continue;
    map[id] =
      (p.fullName || "").trim() ||
      [p.firstName, p.lastName].filter(Boolean).join(" ") ||
      p.playerName ||
      p.name ||
      "Player";
  }
  return map;
};
