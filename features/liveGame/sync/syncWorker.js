import { markInflight, ackBatch, nackBatch } from "../liveGameSlice";
import { postEventsBatch } from "../transport/httpClient";
import { backoff } from "./backoff";
import { getDeviceId } from "../../../utils/deviceId";
import { getCommentaryPrefsForGame } from "../../../lib/commentaryPrefsStore";
import { emitCommentaryPlayback } from "../../../lib/commentaryPlaybackBus";

const BATCH_WINDOW_MS = 120;   // coalesce taps that arrive within 120ms
const MAX_BATCH = 25;          // hard cap per request

function pickTeamNamesFromBatch(batch) {
  for (const e of batch) {
    const body = e.payload?.body || e.payload || {};
    if (body.homeTeamName && body.awayTeamName) {
      return { homeTeamName: body.homeTeamName, awayTeamName: body.awayTeamName };
    }
  }
  return {};
}

// Per-game scheduler handle so we don't run multiple workers in parallel
const tickers = new Map();
const running = new Set();
const inflightControllers = new Map();

/** Abort an in-flight batch POST (e.g. after undo) so a stale ack cannot restore points. */
export function cancelInflightSync(gameId) {
  const controller = inflightControllers.get(gameId);
  if (controller) {
    controller.abort();
    inflightControllers.delete(gameId);
  }
  const ticker = tickers.get(gameId);
  if (ticker) {
    clearTimeout(ticker);
    tickers.delete(gameId);
  }
}

/**
 * Kick the worker for a game. Safe to call on every dispatch — it self-debounces.
 * Called from syncMiddleware after every enqueueEvent.
 */
export function kickSyncWorker(store, gameId) {
  if (running.has(gameId) || tickers.has(gameId)) return;
  const t = setTimeout(() => {
    tickers.delete(gameId);
    runOnce(store, gameId);
  }, BATCH_WINDOW_MS);
  tickers.set(gameId, t);
}

async function runOnce(store, gameId) {
  if (running.has(gameId)) return;
  running.add(gameId);

  try {
    const g = store.getState().liveGame?.byGameId?.[gameId];
    if (!g) return;

    const queued = g.pendingEvents.filter((e) => e.status === "queued");
    if (queued.length === 0) return;

    const batch = queued.slice(0, MAX_BATCH);
    const optimisticIds = batch.map((e) => e.optimisticId);
    const barrierAtSend = g.syncBarrier || 0;
    store.dispatch(markInflight({ gameId, optimisticIds }));

    const abortController = new AbortController();
    inflightControllers.set(gameId, abortController);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.debug('[syncWorker] sending batch', {
        gameId,
        size: batch.length,
        clientSeqs: batch.map((e) => e.clientSeq),
        sinceVersion: g.serverVersion,
        totalPending: g.pendingEvents.length,
      });
    }

    const deviceId = await getDeviceId();
    const teamNames = pickTeamNamesFromBatch(batch);
    const body = {
      deviceId,
      sinceVersion: g.serverVersion,
      commentaryPrefs: getCommentaryPrefsForGame(gameId),
      ...teamNames,
      events: batch.map((e) => ({
        clientSeq: e.clientSeq,
        type: e.type,
        payload: e.payload,
        ts: e.ts,
      })),
    };

    try {
      const raw = await postEventsBatch(gameId, body, { signal: abortController.signal });
      const res =
        raw?.appliedSeqs != null || raw?.version != null
          ? raw
          : raw?.data || raw;
      const appliedSeqs = res?.appliedSeqs || [];
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[syncWorker] batch response', {
          gameId,
          appliedSeqs,
          rejected: (res?.rejected || []).length,
          version: res?.version,
        });
      }
      store.dispatch(
        ackBatch({
          gameId,
          ackedSeqs: appliedSeqs,
          newServerState: res?.state,
          newVersion: res?.version,
          barrierAtSend,
        }),
      );

      // Play commentary from batch HTTP response — reliable even when socket room isn't joined yet.
      if (res?.commentary?.commentary) {
        emitCommentaryPlayback({
          gameId,
          commentary: res.commentary.commentary,
          audioData: res.commentary.audioData,
        });
      }
      // If server explicitly rejected some events (e.g., illegal in current state),
      // mark them fatal.
      const rejected = res?.rejected || [];
      if (rejected.length) {
        const rejectedSeqs = new Set(rejected.map((r) => r.clientSeq));
        const rejectedIds = batch
          .filter((e) => rejectedSeqs.has(e.clientSeq))
          .map((e) => e.optimisticId);
        if (rejectedIds.length) {
          store.dispatch(
            nackBatch({ gameId, optimisticIds: rejectedIds, fatal: true })
          );
        }
      }
    } catch (err) {
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
        return;
      }
      const fatal = !!err.fatal;
      store.dispatch(nackBatch({ gameId, optimisticIds, fatal }));
      if (!fatal) {
        const attempts = (batch[0]?.attempts || 0) + 1;
        setTimeout(() => kickSyncWorker(store, gameId), backoff(attempts));
      }
    }
  } finally {
    inflightControllers.delete(gameId);
    running.delete(gameId);
    // Drain anything queued while we were busy
    const after = store.getState().liveGame?.byGameId?.[gameId];
    if (after?.pendingEvents?.some((e) => e.status === "queued")) {
      kickSyncWorker(store, gameId);
    }
  }
}

/** Re-drive every game with pending events (call on app start after rehydrate). */
export function resumeAllQueues(store) {
  const byGameId = store.getState().liveGame?.byGameId || {};
  for (const gameId of Object.keys(byGameId)) {
    const g = byGameId[gameId];
    // Reset any "inflight" left over from a crash back to "queued"
    if (g.inflightIds?.length) {
      const inflightIdSet = new Set(g.inflightIds);
      store.dispatch(
        nackBatch({
          gameId,
          optimisticIds: g.pendingEvents
            .filter((e) => inflightIdSet.has(e.optimisticId))
            .map((e) => e.optimisticId),
          fatal: false,
        })
      );
    }
    if (g.pendingEvents?.length) kickSyncWorker(store, gameId);
  }
}
