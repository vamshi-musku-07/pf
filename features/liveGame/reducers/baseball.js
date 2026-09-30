// Baseball client-side reducer for LEGACY_BASEBALL events.
//
// Baseball scoring (RBIs, runners crossing the plate, multi-out plays,
// inning rollover, etc.) is too domain-rich to reliably mirror on the
// client. The server's `updateBaseballStats` remains the source of truth.
//
// What this reducer DOES guarantee for instant UI feedback:
//   - The event is appended to `sport.events` immediately (so feed lists,
//     pitch counters that read events, and "last play" widgets update).
//   - For unambiguous count-only events (ball / strike / foul without 2
//     strikes) we increment the balls/strikes counters locally. This keeps
//     the at-bat pitch indicator responsive between server ACKs.
//
// All other state transitions are left for the server's authoritative
// response — pendingEvents simply hold the queued event until the batch
// returns and `applyServerPush` / `ackBatch` overwrites serverState.

import { LEGACY } from "../events/eventTypes";

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function bumpCount(sport, key) {
  const cur = sport.currentCount || { balls: 0, strikes: 0 };
  return { balls: cur.balls || 0, strikes: cur.strikes || 0, [key]: (cur[key] || 0) + 1 };
}

function applyOptimisticBaseball(prev, evt) {
  if (!prev?.sport || !evt?.payload?.body) return prev;
  const next = cloneGame(prev);
  const sport = next.sport;
  const body = evt.payload.body;

  if (!Array.isArray(sport.events)) sport.events = [];
  sport.events.push({ ...body, optimistic: true });

  // Auto-transition matchStatus so fielding setup prompt appears immediately
  if (sport.matchStatus === "scheduled" || !sport.matchStatus) {
    sport.matchStatus = "in_progress";
  }

  // Conservative count-only optimistic updates.
  const t = body.eventType;
  const balls = sport.currentCount?.balls || 0;
  const strikes = sport.currentCount?.strikes || 0;
  if (t === "ball" && balls < 3) {
    sport.currentCount = bumpCount(sport, "balls");
  } else if ((t === "strike" || t === "swinging_strike" || t === "called_strike") && strikes < 2) {
    sport.currentCount = bumpCount(sport, "strikes");
  } else if (t === "foul" && strikes < 2) {
    sport.currentCount = bumpCount(sport, "strikes");
  }
  // Everything else (hits, outs, runs, walks, HBP, inning changes) waits for
  // the server ACK to land in serverState.

  return next;
}

export const handlers = {
  [LEGACY.BASEBALL]: applyOptimisticBaseball,
};
