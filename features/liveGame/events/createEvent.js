// Pure event factory. clientSeq + optimisticId are populated by middleware
// (it needs slice state to assign monotonically), so we leave them undefined here.

let _idCounter = 0;
const genId = () => `${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;

export function createEvent({ type, payload = {} }) {
  return {
    type,
    payload,
    clientSeq: 0,        // filled by syncMiddleware
    optimisticId: genId(),
    ts: Date.now(),
    status: "queued",    // "queued" | "inflight" | "failed"
    attempts: 0,
  };
}
