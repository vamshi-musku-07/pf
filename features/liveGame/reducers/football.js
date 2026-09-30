// Football client-side reducer for LEGACY_FOOTBALL events.
//
// Delegates entirely to the existing `applyOptimisticFootballUpdate` helper
// from footballState.js — that function already handles goals (+1 score),
// own_goals, yellow/red cards, substitutions, match clock, player stats, etc.
// We just need to bridge the LEGACY envelope shape to the flat payload it
// expects, and clone the game correctly.
//
// REPLAY CONTRACT (do NOT violate):
//   - derivedGame = clone(serverState) + replay(pendingEvents)
//   - serverState is NEVER mutated here — cloneFootballSport handles it
//   - Each pending event is replayed from the accumulated clone, NOT from
//     the previous derivedGame

import { LEGACY } from "../events/eventTypes";
import {
  applyOptimisticFootballUpdate,
  applyOptimisticFootballUndo,
} from "../../../components/game/hooks/footballState";

const DEV = typeof __DEV__ !== "undefined" && __DEV__;

function applyOptimisticFootball(prev, evt) {
  if (!prev?.sport) {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[football.reducer] SKIP — no prev.sport", { type: evt?.type });
    }
    return prev;
  }
  if (!evt?.payload?.body) {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[football.reducer] SKIP — no evt.payload.body", { type: evt?.type, clientSeq: evt?.clientSeq });
    }
    return prev;
  }

  const body = evt.payload.body;

  if (body.eventType === "undo") {
    const { nextGame } = applyOptimisticFootballUndo(prev, {
      teamSide: body.teamSide || null,
    });
    return nextGame || prev;
  }

  if (DEV) {
    // eslint-disable-next-line no-console
    console.debug("[football.reducer] APPLY", {
      clientSeq: evt.clientSeq,
      optimisticId: evt.optimisticId,
      eventType: body.eventType,
      teamSide: body.teamSide,
      playerId: body.playerId,
      scoreBefore: prev.sport?.score,
      pendingEventCount: "n/a (single-event view)",
    });
  }

  const next = applyOptimisticFootballUpdate(prev, body);

  if (DEV) {
    // eslint-disable-next-line no-console
    console.debug("[football.reducer] RESULT", {
      clientSeq: evt.clientSeq,
      eventType: body.eventType,
      scoreBefore: prev.sport?.score,
      scoreAfter: next?.sport?.score,
      eventCountAfter: next?.sport?.events?.length,
    });
  }

  return next;
}

export const handlers = {
  [LEGACY.FOOTBALL]: applyOptimisticFootball,
};
