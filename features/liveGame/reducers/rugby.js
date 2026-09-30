// Legacy-passthrough reducer for Rugby.

import { applyOptimisticRugbyUpdate, applyOptimisticRugbyUndo } from "../../../components/game/hooks/rugbyState";
import { LEGACY } from "../events/eventTypes";

export const handlers = {
  [LEGACY.RUGBY]: (state, evt) => {
    const body = evt?.payload?.body;
    if (!state || !body) return state;
    try {
      if (body.eventType === "undo") {
        return applyOptimisticRugbyUndo(state).nextGame || state;
      }
      return applyOptimisticRugbyUpdate(state, body) || state;
    } catch {
      return state;
    }
  },
};
