// Thin facade over the existing GameSocketService that funnels every
// server push through the version-guarded liveGame slice.
//
// You DO NOT have to migrate existing sockets at once — both can coexist.

import {
  joinGameRoom,
  onGameUpdate,
} from "@/services/GameSocketService";
import { applyServerPush } from "../liveGameSlice";
import { getDeviceId } from "../../../utils/deviceId";

// ── Eager device-ID warm-up ──────────────────────────────────────────────────
// getDeviceId() reads from AsyncStorage on first call, then caches the result
// in a module-level variable (see utils/deviceId.js). Warm it up NOW so that
// when the first socket push arrives (typically 100-500ms later), the cached
// value is already populated and `isOwnDevice` is resolved synchronously.
// Without this, there is a ~120ms window where `isOwnDevice=false` and the
// heuristic fallback in applyServerPush mis-fires if markInflight hasn't run.
getDeviceId().catch(() => {});

export function subscribeLiveGameSocket(store, gameId) {
  const dispatch = store.dispatch;

  // Pre-resolve our deviceId so the sync handler can dedup precisely
  // without awaiting on every push.
  let localDeviceId = null;
  Promise.resolve(getDeviceId()).then((id) => { localDeviceId = id || null; }).catch(() => {});

  let unsub = null;

  const handler = (payload) => {
    // payload shape from the batch endpoint:
    //   { type, version, deviceId, appliedSeqs, game: { base, sport } }
    // Legacy emits omit `version` / `appliedSeqs`.
    const game = payload?.game || payload;
    if (!game) return;

    // Pull version from explicit fields ONLY — DO NOT fall back to Date.now().
    // The old Date.now() fallback effectively bypassed the version guard
    // (every push appeared newer than the previous), which let stale
    // snapshots overwrite optimistic state → flicker (10→11→10→11).
    const version =
      Number(payload?.version) ||
      Number(game?.version) ||
      Number(game?.base?.version) ||
      Number(game?.serverVersion) ||
      0;

    if (!version) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug("[liveGame.socket] DROP push without version", { gameId, type: payload?.type });
      }
      return;
    }

    const appliedSeqs = Array.isArray(payload?.appliedSeqs) ? payload.appliedSeqs : null;
    const deviceId = payload?.deviceId || null;
    const isOwnDevice = !!(deviceId && localDeviceId && deviceId === localDeviceId);

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.debug("[liveGame.socket] push", {
        gameId,
        type: payload?.type,
        incomingVersion: version,
        deviceId,
        localDeviceId,
        isOwnDevice,
        appliedSeqs,
      });
    }

    dispatch(applyServerPush({ gameId, snapshot: game, version, appliedSeqs, isOwnDevice }));
  };

  try {
    joinGameRoom(gameId);
    unsub = onGameUpdate(handler);
  } catch {
    /* socket service may be lazy — ignore */
  }

  return () => {
    try {
      unsub?.();
      // Do not leaveGameRoom here — GameScreen / useGameSocket owns room membership.
      // Leaving when a Live panel unmounts broke live updates on other tabs.
    } catch {
      /* noop */
    }
  };
}
