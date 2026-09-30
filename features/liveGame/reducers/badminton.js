// Legacy-passthrough reducer for Badminton.

import {
  applyOptimisticBadmintonUpdate,
  applyOptimisticBadmintonUndo,
} from "../../../components/game/hooks/badmintonState";
import { LEGACY } from "../events/eventTypes";

export const handlers = {
  [LEGACY.BADMINTON]: (state, evt) => {
    const body = evt?.payload?.body;
    if (!state || !body) return state;
    try {
      // ── Undo: remove the last optimistic scoring event and re-derive score ──
      // MUST go through Redux (not legacy setCurrentGame path) so that
      // derivedGame = serverState + pendingEvents is always consistent.
      if (body.eventType === 'undo') {
        const dev = typeof __DEV__ !== 'undefined' && __DEV__;
        if (dev) {
          // eslint-disable-next-line no-console
          console.debug('[BADMINTON.UNDO] applying optimistic undo', {
            scoreBefore: state?.sport?.score,
            pendingEventCount: state?.sport?.events?.length,
          });
        }
        const { nextGame, removedEvent } = applyOptimisticBadmintonUndo(state);
        if (dev) {
          // eslint-disable-next-line no-console
          console.debug('[BADMINTON.UNDO] result', {
            scoreAfter: nextGame?.sport?.score,
            removedEventType: removedEvent?.eventType,
            removedTeamSide: removedEvent?.teamSide,
          });
        }
        return nextGame || state;
      }

      // Legacy signature: (prev, eventType, teamSide, selectedPlayer)
      const dev = typeof __DEV__ !== 'undefined' && __DEV__;
      if (dev) {
        // eslint-disable-next-line no-console
        console.debug('[BADMINTON.SCORE] applying optimistic event', {
          eventType: body.eventType,
          teamSide: body.teamSide,
          scoreBefore: state?.sport?.score,
        });
      }
      const next = applyOptimisticBadmintonUpdate(
        state,
        body.eventType,
        body.teamSide,
        body.playerId
      ) || state;
      if (dev) {
        // eslint-disable-next-line no-console
        console.debug('[BADMINTON.SCORE] score after', { scoreAfter: next?.sport?.score });
      }
      return next;
    } catch {
      return state;
    }
  },
};
