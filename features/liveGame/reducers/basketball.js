// Basketball client-side reducer for LEGACY_BASKETBALL events.
//
// Basketball scoring is deterministic, so we update score optimistically:
//   point_2  → +2  |  point_3  → +3  |  free_throw → +1
//   quarter_transition → bump currentQuarter
// All other stat updates (rebounds, assists, fouls, etc.) are left for the
// server ACK. This gives instant score feedback with no flicker and no
// rollback for the common scoring actions.

import { LEGACY } from "../events/eventTypes";

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function applyOptimisticBasketball(prev, evt) {
  if (!prev?.sport || !evt?.payload?.body) return prev;
  const next = cloneGame(prev);
  const sport = next.sport;
  const body = evt.payload.body;

  // Ensure score object exists
  if (!sport.score) sport.score = { home: 0, away: 0 };

  const side = body.teamSide === "away" ? "away" : "home";

  // Mirror the server: the quarter only ever moves forward, and quarter_transition
  // owns the advance. A stale body.quarter must not pull the game back.
  if (body.eventType === "quarter_transition") {
    sport.currentQuarter = Math.min(Number(sport.currentQuarter || 1) + 1, 8);
  } else {
    const bodyQuarter = Number(body.quarter);
    if (Number.isFinite(bodyQuarter) && bodyQuarter > Number(sport.currentQuarter || 1)) {
      sport.currentQuarter = Math.min(bodyQuarter, 8);
    }
  }
  const quarter = Number(sport.currentQuarter || 1);

  // Append to the feed with the resolved quarter so quarter-filtered views agree.
  if (!Array.isArray(sport.events)) sport.events = [];
  sport.events.push({ ...body, quarter, optimistic: true });

  // Ensure quarterScores array has enough slots
  if (!sport.quarterScores) sport.quarterScores = { home: [], away: [] };
  ["home", "away"].forEach((s) => {
    if (!Array.isArray(sport.quarterScores[s])) sport.quarterScores[s] = [];
    while (sport.quarterScores[s].length < quarter) {
      sport.quarterScores[s].push({ quarter: sport.quarterScores[s].length + 1, score: 0 });
    }
  });

  const addPoints = (pts) => {
    sport.score[side] = (sport.score[side] || 0) + pts;
    sport.quarterScores[side][quarter - 1].score =
      (sport.quarterScores[side][quarter - 1].score || 0) + pts;
  };

  const t = body.eventType;
  if (t === "point_2") addPoints(2);
  else if (t === "point_3") addPoints(3);
  else if (t === "free_throw") addPoints(1);
  // All other event types (fouls, rebounds, assists, etc.) are stat-only —
  // score unchanged, server ACK will supply authoritative state.

  return next;
}

export const handlers = {
  [LEGACY.BASKETBALL]: applyOptimisticBasketball,
};
