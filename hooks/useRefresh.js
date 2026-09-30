import { useState, useCallback, useRef, useEffect } from "react";
import { createAudioPlayer } from "expo-audio";

let dropPlayer = null;

function playDropSound() {
  try {
    if (!dropPlayer) {
      dropPlayer = createAudioPlayer(require("@/assets/sounds/water_drop.wav"));
    } else {
      dropPlayer.seekTo(0);
    }
    dropPlayer.play();
  } catch {
    // silently ignore sound errors
  }
}

/**
 * Hook that provides refreshing state + onRefresh handler with water droplet sound.
 * Uses a ref to always call the latest version of fetchFn, preventing stale closures
 * from causing pull-to-refresh to silently do nothing.
 * @param {Function} fetchFn - async function to call on refresh
 * @returns {{ refreshing: boolean, onRefresh: () => Promise<void> }}
 */
export function useRefresh(fetchFn) {
  const [refreshing, setRefreshing] = useState(false);

  // Keep a ref to the latest fetchFn so onRefresh never captures a stale copy
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  // silent=true suppresses the water-drop sound (used for programmatic/focus fetches).
  const onRefresh = useCallback(async (silent = false) => {
    setRefreshing(true);
    try {
      await fetchFnRef.current();
    } finally {
      setRefreshing(false);
      if (!silent) playDropSound();
    }
  }, []); // stable reference — always calls the latest fetchFn via ref

  return { refreshing, onRefresh };
}
