// Legacy-passthrough reducer for Tennis.
// Delegates to the existing optimistic applier so we reuse battle-tested rules.

import {
  applyOptimisticTennisUpdate,
  applyOptimisticTennisUndo,
} from "../../../components/game/hooks/tennisState";
import { LEGACY } from "../events/eventTypes";

export const handlers = {
  [LEGACY.TENNIS]: (state, evt) => {
    const body = evt?.payload?.body;
    if (!state || !body) return state;
    try {
      if (body.eventType === "undo") {
        const { nextGame } = applyOptimisticTennisUndo(state);
        return nextGame || state;
      }
      return applyOptimisticTennisUpdate(state, body) || state;
    } catch {
      return state;
    }
  },
};
