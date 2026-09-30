import createApiService from "@/lib/apiService";
import { GAME_API_URL } from "@/config/api";

const gameApi = createApiService(GAME_API_URL);

/**
 * POST /games/:id/events:batch
 *
 * Request:
 *   {
 *     deviceId, sinceVersion,
 *     events: [{ clientSeq, type, payload, ts }, ...]
 *   }
 *
 * Response:
 *   {
 *     version, appliedSeqs: number[], rejected: [{ clientSeq, reason }],
 *     state: <full game snapshot>
 *   }
 */
export async function postEventsBatch(gameId, body, options = {}) {
  try {
    const res = await gameApi.post(`/games/${gameId}/events:batch`, body, {
      signal: options.signal,
    });
    return res.data;
  } catch (err) {
    const status = err?.response?.status || 0;
    const reason = err?.response?.data?.error || err?.message || "network";
    const wrapped = new Error(reason);
    wrapped.status = status;
    wrapped.fatal = status === 409 || status === 422 || status === 400;
    throw wrapped;
  }
}

export async function fetchGameSnapshot(gameId) {
  const res = await gameApi.get(`/games/${gameId}`);
  // The endpoint returns { success, data: { base, sport } }.
  // Unwrap so callers receive { base, sport } directly.
  const raw = res.data;
  return raw?.data || raw;
}
