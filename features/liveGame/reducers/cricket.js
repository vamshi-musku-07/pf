// Legacy-passthrough reducer for Cricket.

import { applyOptimisticCricketUpdate } from "../../../components/game/hooks/cricketState";
import { LEGACY } from "../events/eventTypes";

export const handlers = {
  [LEGACY.CRICKET]: (state, evt) => {
    const body = evt?.payload?.body;
    if (!state || !body) return state;
    try {
      return applyOptimisticCricketUpdate(state, body) || state;
    } catch {
      return state;
    }
  },
};
