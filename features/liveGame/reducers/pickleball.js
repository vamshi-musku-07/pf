// Legacy-passthrough reducer for Pickleball.

import {
  applyOptimisticPickleballUpdate,
  applyOptimisticPickleballUndo,
} from "../../../components/game/hooks/pickleballState";
import { LEGACY } from "../events/eventTypes";

const DEV = typeof __DEV__ !== "undefined" && __DEV__;

function applyOptimisticPickleball(state, evt) {
  const body = evt?.payload?.body;
  if (!state || !body) {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[pickleball.reducer] SKIP — no state or body", { type: evt?.type, clientSeq: evt?.clientSeq });
    }
    return state;
  }

  // Undo — replay-based rewind (works for both pending and committed events).
  if (body.eventType === "undo") {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[pickleball.reducer] UNDO — applying replay-based undo", {
        clientSeq: evt.clientSeq,
        optimisticId: evt.optimisticId,
        eventCount: state.sport?.events?.length,
        pointScoreBefore: state.sport?.currentPointScore,
        servingTeamBefore: state.sport?.servingTeam,
      });
    }
    try {
      const { nextGame } = applyOptimisticPickleballUndo(state);
      if (DEV) {
        // eslint-disable-next-line no-console
        console.debug("[pickleball.reducer] UNDO — result", {
          pointScoreAfter: nextGame?.sport?.currentPointScore,
          servingTeamAfter: nextGame?.sport?.servingTeam,
          eventCountAfter: nextGame?.sport?.events?.length,
        });
      }
      return nextGame || state;
    } catch (err) {
      if (DEV) {
        // eslint-disable-next-line no-console
        console.warn("[pickleball.reducer] UNDO ERROR", { err: err?.message });
      }
      return state;
    }
  }

  if (DEV) {
    // eslint-disable-next-line no-console
    console.debug("[pickleball.reducer] APPLY", {
      clientSeq: evt.clientSeq,
      optimisticId: evt.optimisticId,
      eventType: body.eventType,
      teamSide: body.teamSide,
      teamId: body.teamId,
      servingTeamBefore: state.sport?.servingTeam,
      serverNumberBefore: state.sport?.serverNumber,
      pointScoreBefore: state.sport?.currentPointScore,
    });
  }

  try {
    const next = applyOptimisticPickleballUpdate(state, body, body.teamSide) || state;

    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[pickleball.reducer] RESULT", {
        clientSeq: evt.clientSeq,
        eventType: body.eventType,
        teamSide: body.teamSide,
        pointScoreBefore: state.sport?.currentPointScore,
        pointScoreAfter: next.sport?.currentPointScore,
        servingTeamAfter: next.sport?.servingTeam,
        serverNumberAfter: next.sport?.serverNumber,
        applied: next !== state,
      });
    }

    return next;
  } catch (err) {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.warn("[pickleball.reducer] ERROR — returning prev state", { clientSeq: evt.clientSeq, err: err?.message });
    }
    return state;
  }
}

export const handlers = {
  [LEGACY.PICKLEBALL]: applyOptimisticPickleball,
};
