import { useState, useRef, useEffect, useCallback } from "react";
import { AppState } from "react-native";
import { sendGameTimeUpdate } from "@/services/GameSocketService";

const COUNTDOWN_SPORTS = new Set(["Hockey", "IceHockey", "Basketball"]);

const toTotalSeconds = (state = {}) => (
  (Number(state?.minutes) || 0) * 60 + (Number(state?.seconds) || 0)
);

const toClockState = (totalSeconds, isRunning) => ({
  minutes: Math.floor(totalSeconds / 60),
  seconds: totalSeconds % 60,
  isRunning: !!isRunning,
});

// Apply a server-authoritative timer snapshot to local state.
// Compensates for network latency using serverTimestamp so all clients
// display the same value regardless of when they receive the event.
export function applyTimerSnapshot(data, sport) {
  const { isRunning, minutes, seconds, serverTimestamp } = data;
  const base = (minutes ?? 0) * 60 + (seconds ?? 0);
  let adjusted = base;
  if (isRunning && serverTimestamp) {
    const networkMs = Date.now() - new Date(serverTimestamp).getTime();
    const networkSec = Math.max(0, networkMs / 1000);
    adjusted = COUNTDOWN_SPORTS.has(sport)
      ? Math.max(0, base - networkSec)
      : base + networkSec;
  }
  const normalizedTotal = COUNTDOWN_SPORTS.has(sport)
    ? Math.max(0, Math.ceil(adjusted - 1e-6))
    : Math.max(0, Math.floor(adjusted));
  return toClockState(normalizedTotal, isRunning);
}

export function mergeTimerSnapshot(prevState, nextState, sport) {
  if (!COUNTDOWN_SPORTS.has(sport)) return nextState;
  if (!prevState?.isRunning || !nextState?.isRunning) return nextState;

  const prevTotal = toTotalSeconds(prevState);
  const nextTotal = toTotalSeconds(nextState);

  // Ignore 1-second upward beacon corrections while a countdown is running.
  // Larger jumps still apply so manual resets or period changes come through.
  if (nextTotal > prevTotal && nextTotal <= prevTotal + 1) {
    return prevState;
  }

  return nextState;
}

export function useGameTimer(
  sport,
  gameStatus,
  gameId,
  isOwner,
  serverTimerState,
  teamNames,
  actingTeamId,
  actingTeamName,
) {
  const [gameTime, setGameTime] = useState({ minutes: 0, seconds: 0, isRunning: false });
  const timerRef    = useRef(null);
  const gameTimeRef = useRef(gameTime);
  gameTimeRef.current = gameTime;

  // Track whether we have ever received authoritative state from the server.
  // Before that, we keep the default; after that, we never fall back to defaults.
  const hasServerState = useRef(false);

  // ── Init from server timerState when game first loads ─────────────────
  useEffect(() => {
    if (!serverTimerState || hasServerState.current) return;
    if (serverTimerState.serverTimestamp == null) return; // empty record
    hasServerState.current = true;
    setGameTime(applyTimerSnapshot(serverTimerState, sport));
  }, [serverTimerState, sport]);

  // ── AppState: compensate for time spent in background ─────────────────
  const appStateRef = useRef(AppState.currentState);
  const bgAtRef     = useRef(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "active" && next !== "active") {
        bgAtRef.current = Date.now();
      } else if (prev !== "active" && next === "active" && bgAtRef.current) {
        if (gameTimeRef.current.isRunning) {
          const elapsed = Math.floor((Date.now() - bgAtRef.current) / 1000);
          setGameTime((cur) => {
            const total    = cur.minutes * 60 + cur.seconds;
            const adjusted = COUNTDOWN_SPORTS.has(sport)
              ? Math.max(0, total - elapsed)
              : total + elapsed;
            return { ...cur, minutes: Math.floor(adjusted / 60), seconds: Math.floor(adjusted % 60) };
          });
        }
        bgAtRef.current = null;
      }
    });
    return () => sub.remove();
  }, [sport]);

  // ── Local tick — display smoothness only; server beacons correct drift ─
  useEffect(() => {
    if (gameTime.isRunning && gameStatus === "live") {
      timerRef.current = setInterval(() => {
        setGameTime((prev) => {
          if (!prev.isRunning) return prev;
          if (COUNTDOWN_SPORTS.has(sport)) {
            if (prev.minutes === 0 && prev.seconds === 0) return { ...prev, isRunning: false };
            const ns = prev.seconds - 1;
            if (ns < 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
            return { ...prev, seconds: ns };
          }
          const ns = prev.seconds + 1;
          if (ns >= 60) return { ...prev, minutes: prev.minutes + 1, seconds: 0 };
          return { ...prev, seconds: ns };
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameTime.isRunning, gameStatus, sport]);

  // ── Default values when game goes live (only if server gave no state) ──
  useEffect(() => {
    if (gameStatus !== "live" || hasServerState.current) return;
    setGameTime((cur) => {
      if (cur.minutes === 0 && cur.seconds === 0 && !cur.isRunning) {
        if (sport === "Hockey")     return { minutes: 15, seconds: 0, isRunning: false };
        if (sport === "IceHockey") return { minutes: 20, seconds: 0, isRunning: false };
        if (sport === "Basketball") return { minutes: 10, seconds: 0, isRunning: false };
      }
      return cur;
    });
  }, [gameStatus, sport]);

  // ── Broadcast current timer to server (owner only) ────────────────────
  const broadcastTimer = useCallback((state, metadata = {}) => {
    if (!isOwner || !gameId) return;
    const s = state || gameTimeRef.current;
    sendGameTimeUpdate(gameId, {
      isRunning: s.isRunning,
      minutes:   s.minutes,
      seconds:   s.seconds,
      homeTeamName: teamNames?.home || "",
      awayTeamName: teamNames?.away || "",
      actingTeamId: actingTeamId || "",
      actingTeamName: actingTeamName || "",
      timerReason: metadata.timerReason || "",
      periodNumber: metadata.periodNumber || null,
    });
  }, [actingTeamId, actingTeamName, isOwner, gameId, teamNames]);

  // ── Periodic beacon — owner rebroadcasts every 5 s while running ──────
  // Viewers use the beacon to correct any drift accumulated since last sync.
  useEffect(() => {
    if (!isOwner || !gameId || !gameTime.isRunning || gameStatus !== "live") return;
    const id = setInterval(() => broadcastTimer(), 5000);
    return () => clearInterval(id);
  }, [isOwner, gameId, gameTime.isRunning, gameStatus, broadcastTimer]);

  // ── Pause / Resume ────────────────────────────────────────────────────
  const handlePauseResume = useCallback((ownerFlag) => {
    if (!ownerFlag) return;
    const newIsRunning = !gameTimeRef.current.isRunning;
    const newState = { ...gameTimeRef.current, isRunning: newIsRunning };
    setGameTime(newState);
    broadcastTimer(newState);
  }, [broadcastTimer]);

  // ── syncTimerNow: called after sport handlers change the timer ─────────
  // e.g. after handleStartGame or end-of-period resets.
  const syncTimerNow = useCallback((overrideState = null, metadata = {}) => {
    broadcastTimer(overrideState || gameTimeRef.current, metadata);
  }, [broadcastTimer]);

  return { gameTime, setGameTime, timerRef, handlePauseResume, syncTimerNow };
}
