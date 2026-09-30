import { useState, useRef, useCallback, useEffect } from "react";
import { Alert } from "react-native";

// How many times to attempt a single event within one reconnect cycle
const ATTEMPTS_PER_CYCLE = 3;
// Base delay between attempts — doubles each retry (1 s → 2 s → 4 s)
const RETRY_BASE_MS = 1000;
// Hard cap: discard the event after this many total attempts across all reconnect cycles
// (ATTEMPTS_PER_CYCLE × cycles = 3 × 3 = 9 before permanent discard)
const MAX_TOTAL_ATTEMPTS = 9;

/**
 * Manages a queue of game-event API calls that were triggered while the device
 * was offline.  When the connection comes back, the queue drains in order with
 * per-attempt exponential backoff.  Events that still fail are re-queued for the
 * next reconnect cycle.  Events that exhaust MAX_TOTAL_ATTEMPTS are discarded
 * and the coach is alerted so they know that score update was lost.
 *
 * @param {boolean}   isOnline      – live network flag from useNetworkStatus
 * @param {function}  fetchGame     – called after a successful full drain
 * @param {React.MutableRefObject} isMountedRef – guards state updates after unmount
 */
export function useOfflineQueue(isOnline, fetchGame, isMountedRef) {
  const [offlineQueue,  setOfflineQueue]  = useState([]);  // drives the badge count
  const [syncingLabel,  setSyncingLabel]  = useState(null); // drives "Syncing…" text in badge
  const offlineQueueRef = useRef([]);
  const isDrainingRef   = useRef(false);   // prevents concurrent drain runs

  // ── Drain on reconnect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || offlineQueueRef.current.length === 0) return;
    if (isDrainingRef.current) return; // already draining — isOnline can flicker

    const drain = async () => {
      isDrainingRef.current = true;

      // Snapshot the queue and clear it immediately so new offline events
      // queued DURING the drain go into a fresh list, not the one we're processing.
      const snapshot = [...offlineQueueRef.current];
      offlineQueueRef.current = [];
      setOfflineQueue([]);

      const requeue = []; // items that still failed after all attempts

      for (const item of snapshot) {
        // Stop mid-drain if the component unmounted (e.g. user navigated away)
        if (!isMountedRef.current) {
          // Preserve un-processed items so they're not silently dropped
          requeue.push(...snapshot.slice(snapshot.indexOf(item)));
          break;
        }

        setSyncingLabel(item.label);

        let succeeded = false;
        for (let attempt = 0; attempt < ATTEMPTS_PER_CYCLE; attempt++) {
          if (attempt > 0) {
            // Exponential backoff: 1 s → 2 s → 4 s
            await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
          }
          try {
            await item.eventFn();
            succeeded = true;
            break;
          } catch (err) {
            console.warn(
              `[OfflineQueue] Attempt ${attempt + 1}/${ATTEMPTS_PER_CYCLE} failed for "${item.label}":`,
              err?.message,
            );
          }
        }

        if (!succeeded) {
          const totalAttempts = (item.totalAttempts || 0) + ATTEMPTS_PER_CYCLE;

          if (totalAttempts < MAX_TOTAL_ATTEMPTS) {
            // Re-queue — will retry on the next reconnect
            requeue.push({ ...item, totalAttempts });
            console.warn(
              `[OfflineQueue] Re-queued "${item.label}" (${totalAttempts}/${MAX_TOTAL_ATTEMPTS} total attempts)`,
            );
          } else {
            // Permanently failed — warn the coach
            console.error(`[OfflineQueue] Permanently discarding "${item.label}" after ${totalAttempts} attempts`);
            if (isMountedRef.current) {
              Alert.alert(
                "Score Sync Failed",
                `"${item.label}" could not be saved after multiple attempts and has been discarded. Please log the score manually.`,
                [{ text: "OK" }],
              );
            }
          }
        }
      }

      if (!isMountedRef.current) {
        isDrainingRef.current = false;
        return;
      }

      setSyncingLabel(null);
      isDrainingRef.current = false;

      if (requeue.length > 0) {
        // Prepend re-queued failures so they drain first on the next reconnect
        offlineQueueRef.current = [...requeue, ...offlineQueueRef.current];
        setOfflineQueue([...offlineQueueRef.current]);
      } else {
        // Full success — refresh game state to pick up any server-side changes
        fetchGame();
      }
    };

    drain();
  }, [isOnline]);

  // ── Queue-or-fire wrapper ─────────────────────────────────────────────────
  /**
   * When online  → executes `eventFn()` immediately and returns its result.
   * When offline → stores the event in the queue, shows an alert, returns null.
   *
   * The caller should treat a null return as "event queued — skip fetchGame()".
   */
  const queueOrFire = useCallback(
    async (eventFn, label = "event") => {
      if (isOnline) return eventFn();

      const item = { eventFn, label, totalAttempts: 0, queuedAt: Date.now() };
      offlineQueueRef.current = [...offlineQueueRef.current, item];
      setOfflineQueue([...offlineQueueRef.current]);

      Alert.alert(
        "You're Offline",
        `"${label}" has been queued and will sync automatically when your connection returns.\n(${offlineQueueRef.current.length} pending)`,
        [{ text: "OK" }],
      );
      return null;
    },
    [isOnline],
  );

  return { offlineQueue, offlineQueueRef, syncingLabel, queueOrFire };
}
