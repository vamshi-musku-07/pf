// Legacy-passthrough reducer for Volleyball.

import { applyIncrementalVolleyballEvent } from "../../../components/game/hooks/volleyballState";
import { LEGACY } from "../events/eventTypes";

export const handlers = {
  [LEGACY.VOLLEYBALL]: (state, evt) => {
    const body = evt?.payload?.body;
    if (!state || !body) return state;
    try {
      return applyIncrementalVolleyballEvent(state, body) || state;
    } catch {
      return state;
    }
  },
};
