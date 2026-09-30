import { createSlice } from "@reduxjs/toolkit";
import { withCricketReconciledSnapshot } from "./cricketSnapshot";
import {
  countVolleyballRallyEvents,
  volleyballSetScoreSignature,
} from "../../components/game/hooks/volleyballState";

function incomingConflictsWithLocalAuthority(g, snapshot) {
  if (!snapshot) return false;
  if (g.localAuthorityScoreSig != null) {
    return volleyballSetScoreSignature(snapshot) !== g.localAuthorityScoreSig;
  }
  if (g.localAuthorityRallyCount != null) {
    return countVolleyballRallyEvents(snapshot) !== g.localAuthorityRallyCount;
  }
  return false;
}

function ackedSeqsMax(arr) {
  let m = 0;
  for (const n of arr) if (n > m) m = n;
  return m;
}

function dropAckedPendingEvents(g, ackedSeqs) {
  const acked = new Set((ackedSeqs || []).map((seq) => Number(seq)));
  g.pendingEvents = g.pendingEvents.filter((e) => !acked.has(Number(e.clientSeq)));
  const stillPending = new Set(g.pendingEvents.map((e) => e.optimisticId));
  g.inflightIds = g.inflightIds.filter((id) => stillPending.has(id));
}

/**
 * Per-game state shape:
 * {
 *   serverState:        last authoritative snapshot from server (full game doc)
 *   serverVersion:      monotonic version assigned by server
 *   lastAckedClientSeq: highest clientSeq the server has acknowledged
 *   nextClientSeq:      monotonic local counter (next event will use this)
 *   pendingEvents:      [{ clientSeq, optimisticId, type, payload, ts, status, attempts }]
 *   inflightIds:        optimisticIds currently mid-POST
 *   failedIds:          optimisticIds permanently rejected (need user attention)
 * }
 */
const initialPerGame = () => ({
  serverState: null,
  serverVersion: 0,
  lastAckedClientSeq: 0,
  nextClientSeq: 1,
  pendingEvents: [],
  inflightIds: [],
  failedIds: [],
  syncBarrier: 0,
  localAuthorityRallyCount: null,
  localAuthorityScoreSig: null,
});

const slice = createSlice({
  name: "liveGame",
  initialState: { byGameId: {} },
  reducers: {
    ensureGame(state, { payload: { gameId } }) {
      if (!state.byGameId[gameId]) {
        state.byGameId[gameId] = initialPerGame();
      }
    },

    // Set base server snapshot. Drops the call if version is strictly older.
    //
    // ── Version guard rules ──
    //
    // Guard 1 (v=0 bypass fix — PRIMARY regression fix):
    //   When a REST poll returns a snapshot without a version field,
    //   `base.version` is undefined → v=0. The OLD guard was:
    //     `g.serverVersion && v && v < g.serverVersion`
    //   With v=0 that becomes `serverVersion && false && ...` = FALSE
    //   → snapshot ALWAYS accepted, even after a batch ack at version N!
    //   This is the root cause of score rollback and card resurrection:
    //   the stale v=0 snapshot overwrites the correct serverState, then
    //   the next real-version poll "restores" it → visible flicker.
    //
    // Guard 2 (strictly older non-zero version):
    //   A poll at version N-1 arriving after we've moved to version N
    //   must be dropped. This is the original intent of the guard.
    //
    // Guard 3 (same-version allowed):
    //   Setup actions (batting order, lineup changes) update the sport
    //   document WITHOUT incrementing baseGame.version. They return the
    //   current version N. With `<` (not `<=`) we still accept those so
    //   the scoring panel can advance past "Match Setup". Pending events
    //   are always replayed on top, so there is no regression risk.
    hydrateGame(state, { payload: { gameId, snapshot, version } }) {
      const v = Number(version) || 0;
      if (!state.byGameId[gameId]) state.byGameId[gameId] = initialPerGame();
      const g = state.byGameId[gameId];
      const sv = g.serverVersion || 0;

      // Guard 1 — reject version-0 snapshot once we have a real version.
      if (v === 0 && sv > 0) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug('[liveGame.hydrateGame] DROP v=0 snapshot (serverVersion=' + sv + ')', { gameId });
        }
        return;
      }

      // Guard 2 — reject strictly older non-zero version.
      if (v > 0 && v < sv) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug('[liveGame.hydrateGame] DROP stale v=' + v + ' (serverVersion=' + sv + ')', { gameId });
        }
        return;
      }

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const sp = snapshot?.sport;
        // eslint-disable-next-line no-console
        console.debug('[liveGame.hydrateGame] ACCEPT v=' + v + ' (was=' + sv + ')', {
          gameId,
          score: sp?.score,
          eventCount: Array.isArray(sp?.events) ? sp.events.length : '?',
          pendingAfter: g.pendingEvents.length,
        });
      }

      if (incomingConflictsWithLocalAuthority(g, snapshot)) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.hydrateGame] DROP (conflicts with local undo authority)", { gameId });
        }
        return;
      }

      g.serverState = withCricketReconciledSnapshot(snapshot);
      // Never regress serverVersion with a v=0 call (v=0 means unversioned REST data).
      g.serverVersion = v > 0 ? v : sv;
    },

    // Append a new optimistic event. clientSeq assigned here so middleware
    // doesn't need to mutate the action payload.
    enqueueEvent: {
      reducer(state, { payload }) {
        const { gameId, event } = payload;
        if (!state.byGameId[gameId]) state.byGameId[gameId] = initialPerGame();
        const g = state.byGameId[gameId];
        const ev = { ...event, clientSeq: g.nextClientSeq };
        g.nextClientSeq += 1;
        g.pendingEvents.push(ev);
        g.localAuthorityRallyCount = null;
        g.localAuthorityScoreSig = null;
      },
      prepare({ gameId, event }) {
        return { payload: { gameId, event } };
      },
    },

    markInflight(state, { payload: { gameId, optimisticIds } }) {
      const g = state.byGameId[gameId];
      if (!g) return;
      const idSet = new Set(optimisticIds);
      g.inflightIds.push(...optimisticIds);
      g.pendingEvents.forEach((e) => {
        if (idSet.has(e.optimisticId)) e.status = "inflight";
      });
    },

    // Server accepted a batch — drop those events from queue, advance version.
    ackBatch(state, { payload: { gameId, ackedSeqs, newServerState, newVersion, barrierAtSend } }) {
      const g = state.byGameId[gameId];
      if (!g) return;

      const barrierStale =
        barrierAtSend != null && Number(barrierAtSend) < Number(g.syncBarrier || 0);
      const authorityStale = incomingConflictsWithLocalAuthority(g, newServerState);
      if (barrierStale || authorityStale) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.ackBatch] DROP stale batch response", {
            gameId,
            barrierStale,
            authorityStale,
            barrierAtSend,
            syncBarrier: g.syncBarrier,
          });
        }
        dropAckedPendingEvents(g, ackedSeqs);
        return;
      }

      const v = Number(newVersion) || 0;
      if (v && v <= g.serverVersion) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug('[liveGame.ackBatch] STALE ack', { gameId, incoming: v, current: g.serverVersion, ackedSeqs });
        }
        // Stale ack arrived after a newer push; still drop the acked events
        // from queue so we don't double-apply, but don't regress version/state.
        dropAckedPendingEvents(g, ackedSeqs);
        const stillPending = new Set(g.pendingEvents.map((e) => e.optimisticId));
        g.inflightIds = g.inflightIds.filter((id) => stillPending.has(id));
        return;
      }
      g.serverState = withCricketReconciledSnapshot(newServerState);
      g.serverVersion = v;
      if (ackedSeqs.length) {
        g.lastAckedClientSeq = Math.max(g.lastAckedClientSeq, ...ackedSeqs);
      }
      dropAckedPendingEvents(g, ackedSeqs);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[liveGame.ackBatch]', { gameId, newVersion: v, ackedSeqs, pendingAfter: g.pendingEvents.length });
      }
    },

    // Server rejected (or network failed) — fatal = remove + mark failed.
    nackBatch(state, { payload: { gameId, optimisticIds, fatal } }) {
      const g = state.byGameId[gameId];
      if (!g) return;
      const idSet = new Set(optimisticIds);
      g.pendingEvents.forEach((e) => {
        if (idSet.has(e.optimisticId)) {
          e.attempts += 1;
          e.status = fatal ? "failed" : "queued";
        }
      });
      if (fatal) {
        g.failedIds.push(...optimisticIds);
        g.pendingEvents = g.pendingEvents.filter((e) => !idSet.has(e.optimisticId));
      }
      g.inflightIds = g.inflightIds.filter((id) => !idSet.has(id));
    },

    // Incoming socket push. Version-guarded.
    //
    // CRITICAL: when the server pushes a snapshot at version V, it has
    // already applied every event up to V. Any pending events in our
    // queue whose clientSeq is included in `appliedSeqs` (for our own
    // deviceId) are ALREADY part of `snapshot` — replaying them on top
    // of the snapshot would cause score OVERSHOOT (e.g. 5 → 7 → 6).
    //
    // Fallback when the push doesn't carry deviceId/appliedSeqs (legacy
    // emit paths): if version advances, drop everything currently marked
    // `inflight`. Those events were sent to the server in a batch that
    // hasn't HTTP-acked yet, but the version bump proves they were
    // committed. The HTTP ack will arrive shortly and be a harmless no-op.
    applyServerPush(state, { payload: { gameId, snapshot, version, appliedSeqs, isOwnDevice } }) {
      const g = state.byGameId[gameId];
      if (!g) return;
      const v = Number(version) || 0;
      if (!v || v <= g.serverVersion) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug('[liveGame.applyServerPush] DROPPED stale push', {
            gameId, incoming: v, current: g.serverVersion,
          });
        }
        return;
      }

      if (incomingConflictsWithLocalAuthority(g, snapshot)) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.applyServerPush] DROP (conflicts with local undo authority)", {
            gameId,
            incoming: v,
          });
        }
        return;
      }

      g.serverState = withCricketReconciledSnapshot(snapshot);
      g.serverVersion = v;

      // Precise dedup path.
      let removedSeqs = [];
      if (appliedSeqs && appliedSeqs.length && isOwnDevice) {
        const acked = new Set(appliedSeqs);
        const before = g.pendingEvents.length;
        g.pendingEvents = g.pendingEvents.filter((e) => !acked.has(e.clientSeq));
        if (acked.size && g.pendingEvents.length < before) {
          removedSeqs = [...acked];
          if (ackedSeqsMax(appliedSeqs) > g.lastAckedClientSeq) {
            g.lastAckedClientSeq = ackedSeqsMax(appliedSeqs);
          }
        }
        const stillPending = new Set(g.pendingEvents.map((e) => e.optimisticId));
        g.inflightIds = g.inflightIds.filter((id) => stillPending.has(id));
      } else if (g.inflightIds.length) {
        // Heuristic fallback: any inflight event has already been seen by
        // the server (we sent it) and is provably committed since version
        // advanced. Drop them to prevent re-replay on top of the snapshot.
        const inflightSet = new Set(g.inflightIds);
        const removed = g.pendingEvents.filter((e) => inflightSet.has(e.optimisticId));
        removedSeqs = removed.map((e) => e.clientSeq);
        g.pendingEvents = g.pendingEvents.filter((e) => !inflightSet.has(e.optimisticId));
        g.inflightIds = [];
      }

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[liveGame.applyServerPush]', {
          gameId,
          newVersion: v,
          isOwnDevice,
          appliedSeqsCount: appliedSeqs?.length || 0,
          removedFromPending: removedSeqs,
          pendingAfter: g.pendingEvents.length,
          inflightAfter: g.inflightIds.length,
          scoreAfter: snapshot?.sport?.score,
        });
      }
    },

    // Manual rollback (e.g., user dismisses a failed event).
    rollbackOptimistic(state, { payload: { gameId, optimisticId } }) {
      const g = state.byGameId[gameId];
      if (!g) return;
      g.pendingEvents = g.pendingEvents.filter((e) => e.optimisticId !== optimisticId);
      g.failedIds = g.failedIds.filter((id) => id !== optimisticId);
      g.inflightIds = g.inflightIds.filter((id) => id !== optimisticId);
    },

    // Merge an externally-fetched snapshot (e.g. legacy useGameData polling
    // or a legacy setup endpoint like setBattingOrder / setupLineup that
    // bypasses the batch event log).
    //
    // SAFETY: only applied when the queue is completely idle
    // (pendingEvents.length === 0 && inflightIds.length === 0). Otherwise
    // we could overwrite optimistic state with stale data.
    //
    // Does NOT advance serverVersion — future batch acks still version-gate
    // against the last truly authoritative version.
    mergeExternalSnapshot(state, { payload: { gameId, snapshot } }) {
      const g = state.byGameId[gameId];
      if (!g) return;
      if (!snapshot) return;
      if (g.pendingEvents.length > 0 || g.inflightIds.length > 0) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug('[liveGame.mergeExternalSnapshot] SKIP (queue busy)', {
            gameId, pending: g.pendingEvents.length, inflight: g.inflightIds.length,
          });
        }
        return;
      }
      if (incomingConflictsWithLocalAuthority(g, snapshot)) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.mergeExternalSnapshot] DROP (conflicts with local undo authority)", {
            gameId,
          });
        }
        return;
      }
      g.serverState = withCricketReconciledSnapshot(snapshot);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[liveGame.mergeExternalSnapshot] applied', { gameId });
      }
    },

    // Authoritative reset after cricket undo (or similar): replace serverState
    // and drop all optimistic queue entries so derivedGame cannot replay
    // deliveries that the server has already removed.
    forceResetFromServer(state, {
      payload: { gameId, snapshot, version, localAuthorityRallyCount, localAuthorityScoreSig },
    }) {
      if (!snapshot) return;
      if (!state.byGameId[gameId]) state.byGameId[gameId] = initialPerGame();
      const g = state.byGameId[gameId];
      const v = Number(version) || Number(snapshot?.base?.version) || 0;
      const sv = g.serverVersion || 0;

      if (v === 0 && sv > 0) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.forceResetFromServer] DROP v=0 snapshot", { gameId });
        }
        return;
      }
      if (v > 0 && v < sv) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.debug("[liveGame.forceResetFromServer] DROP stale v=" + v, { gameId });
        }
        return;
      }

      g.syncBarrier = Number(g.syncBarrier || 0) + 1;
      g.serverState = withCricketReconciledSnapshot(snapshot);
      g.serverVersion = v > 0 ? v : sv;
      g.pendingEvents = [];
      g.inflightIds = [];
      g.failedIds = [];
      if (localAuthorityRallyCount != null) {
        g.localAuthorityRallyCount = Number(localAuthorityRallyCount);
      }
      if (localAuthorityScoreSig != null) {
        g.localAuthorityScoreSig = String(localAuthorityScoreSig);
      }
    },

    clearGame(state, { payload: { gameId } }) {
      delete state.byGameId[gameId];
    },
  },
});

export const {
  ensureGame,
  hydrateGame,
  enqueueEvent,
  markInflight,
  ackBatch,
  nackBatch,
  applyServerPush,
  rollbackOptimistic,
  mergeExternalSnapshot,
  forceResetFromServer,
  clearGame,
} = slice.actions;

export default slice.reducer;
