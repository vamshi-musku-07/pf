// One-stop React hook for any sport panel.
// Usage in a component:
//
//   const { derivedGame, score, dispatchEvent, queueHealth } = useLiveGame(gameId);
//   <Pressable onPress={() => dispatchEvent({ type: TT.POINT, payload: { side: "home" } })} />
//
// Reads ALWAYS go through derivedGame = serverState + pendingEvents.

import { useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector, useStore, shallowEqual } from "react-redux";

import {
  ensureGame,
  enqueueEvent,
  hydrateGame,
  rollbackOptimistic,
  mergeExternalSnapshot,
} from "../liveGameSlice";
import {
  createDerivedGameSelector,
  selectQueueHealth,
  selectPendingEvents,
} from "../selectors";
import { createEvent } from "../events/createEvent";
import { subscribeLiveGameSocket } from "../transport/socketClient";
import { fetchGameSnapshot } from "../transport/httpClient";

export function useLiveGame(gameId, { autoHydrate = true } = {}) {
  const dispatch = useDispatch();

  // Memoized per-mount derived-game selector
  const selectDerived = useMemo(createDerivedGameSelector, []);
  const derivedGame = useSelector(
    (state) => selectDerived(state, gameId),
    shallowEqual
  );
  const queueHealth = useSelector(
    (state) => selectQueueHealth(state, gameId),
    shallowEqual
  );
  // NOTE: pendingEvents is NOT selected here for rendering — it is only
  // read on-demand inside undoOptimistic via store.getState() to avoid
  // stale-closure bugs when the user taps undo faster than React re-renders.

  // Ensure per-game slot exists
  useEffect(() => {
    if (gameId) dispatch(ensureGame({ gameId }));
  }, [gameId, dispatch]);

  // Initial hydration from REST (only if we don't already have a snapshot)
  useEffect(() => {
    if (!gameId || !autoHydrate) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchGameSnapshot(gameId);
        if (cancelled) return;
        // Use the real BaseGame version so the stale-guard in hydrateGame
        // works correctly (prevents overwriting a fresher socket-pushed state).
        // Do NOT fall back to Date.now() — that always beats the version
        // counter and would corrupt serverState with a stale REST snapshot.
        const version =
          Number(snapshot?.base?.version) ||
          Number(snapshot?.version) ||
          0;
        dispatch(hydrateGame({ gameId, snapshot, version }));
      } catch {
        /* leave serverState null; UI shows loading */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, autoHydrate, dispatch]);

  // Live updates via socket — version-guarded inside the slice
  useEffect(() => {
    if (!gameId) return undefined;
    const socketStore = { dispatch, getState: () => null }; // socketClient only needs dispatch
    return subscribeLiveGameSocket({ dispatch, getState: socketStore.getState }, gameId);
  }, [gameId, dispatch]);

  const store = useStore();

  const dispatchEvent = useCallback(
    ({ type, payload }) => {
      if (!gameId || !type) return;
      const event = createEvent({ type, payload });
      dispatch(enqueueEvent({ gameId, event }));
    },
    [gameId, dispatch]
  );

  const undoOptimistic = useCallback(
    (optimisticId) => {
      if (!gameId) return;
      // Read fresh state at call time to avoid stale-closure with useCallback.
      // This is critical: if the user taps undo before React re-renders after
      // scoring, a closure over pendingEvents from the previous render would
      // be empty and undo would silently do nothing.
      const pending = selectPendingEvents(store.getState(), gameId);
      const id = optimisticId || pending[pending.length - 1]?.optimisticId;
      if (!id) return;
      dispatch(rollbackOptimistic({ gameId, optimisticId: id }));
    },
    [gameId, dispatch, store]
  );

  // Merge legacy non-event mutations (setup actions: batting order,
  // opening bowler, volleyball/baseball lineups, toss, etc.) into the
  // live slice. These bypass the batch endpoint and only show up in the
  // parent screen's `currentGame` prop.
  //
  // CRITICAL: never hydrate while the outbound queue is busy. A REST poll
  // or fetchGame() during fast volleyball taps would overwrite serverState
  // with a stale snapshot, then pending events replay on top → score resets,
  // flicker, and "old scores coming back".
  const syncExternalSnapshot = useCallback(
    (snapshot) => {
      if (!gameId || !snapshot) return;
      const live = store.getState().liveGame?.byGameId?.[gameId];
      if ((live?.pendingEvents?.length || 0) > 0 || (live?.inflightIds?.length || 0) > 0) {
        return;
      }
      const version =
        Number(snapshot?.base?.version) ||
        Number(snapshot?.version) ||
        0;
      dispatch(
        hydrateGame({
          gameId,
          snapshot,
          version,
        }),
      );
    },
    [gameId, dispatch, store],
  );

  return {
    derivedGame,
    queueHealth,
    dispatchEvent,
    undoOptimistic,
    syncExternalSnapshot,
  };
}
