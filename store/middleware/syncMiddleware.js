import { enqueueEvent } from "../../features/liveGame/liveGameSlice";
import { kickSyncWorker } from "../../features/liveGame/sync/syncWorker";

/**
 * Side-effect middleware: any time an event is enqueued, kick the background
 * sync worker. The worker self-debounces, so spamming is fine — 10 fast taps
 * still result in one batched HTTP request.
 */
export const syncMiddleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  if (action?.type === enqueueEvent.type) {
    const gameId = action.payload?.gameId;
    if (gameId) kickSyncWorker(storeApi, gameId);
  }
  return result;
};
