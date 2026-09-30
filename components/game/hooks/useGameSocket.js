import { useEffect, useRef } from "react";
import * as Speech from "expo-speech";
import {
  initializeGameSocket,
  joinGameRoom,
  leaveGameRoom,
  onCommentaryUpdate,
  onGameEvent,
  onGameUpdate,
  onSocketReconnect,
} from "@/services/GameSocketService";
import { normalizeGameModel, mergeGamePermissions } from "@/lib/gameModel";
import { applyTimerSnapshot, mergeTimerSnapshot } from "./useGameTimer";
import { useTimerAlerts } from "./useTimerAlerts";
import { isGameFinished } from "./gameStatus";

export function useGameSocket({
  gameId,
  sport,
  isOwner,
  teamId,
  teamName,
  playCommentaryAudio,
  voiceEnabledRef,
  commentarySoundRef,
  fetchGameRef,
  isMountedRef,
  currentGameRef,
  incomingGameReconcilerRef,
  setCurrentGame,
  setGameOver,
  setGameTime,
}) {
  const {
    alertPause,
    alertResume,
    alertBasketballPause,
    alertBasketballResume,
    alertQuarterEnd,
    setCommentaryPlayer,
  } = useTimerAlerts();

  // Keep teamName in a ref so changes to it (e.g. data loading from "" → real
  // name) do NOT tear down and rebuild the socket connection.
  const teamNameRef = useRef(teamName);
  useEffect(() => { teamNameRef.current = teamName; }, [teamName]);

  // Inject commentary player so AI voice is used for pause/resume
  useEffect(() => {
    if (playCommentaryAudio) setCommentaryPlayer(playCommentaryAudio);
  }, [playCommentaryAudio, setCommentaryPlayer]);

  // Track the previous isRunning so we only fire alerts on transitions,
  // not on every beacon tick or late-join init.
  const prevIsRunningRef = useRef(null); // null = not yet received any timer event
  // When the local owner triggers pause/resume, skip the toast from the socket echo
  const skipNextTimerToastRef = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    let unsubCommentary     = null;
    let unsubGameEvent      = null;
    let unsubGameUpdate     = null;
    let unsubReconnect      = null;

    // Join immediately — don't wait for initializeGameSocket to resolve.
    joinGameRoom(gameId);

    initializeGameSocket().then(() => {
      joinGameRoom(gameId);

      unsubReconnect = onSocketReconnect(() => {
        joinGameRoom(gameId);
        fetchGameRef.current?.();
      });

      unsubGameUpdate = onGameUpdate((data) => {
        if (data?.gameId && String(data.gameId) !== String(gameId)) return;

        // ── Server-authoritative timer sync ────────────────────────────────
        // Applied to ALL devices (owner + every viewer).
        // applyTimerSnapshot compensates for network latency via serverTimestamp
        // so every device snaps to the exact same reference point.
        if (data.type === "time_update" && setGameTime) {
          const newIsRunning = !!data.isRunning;
          const prev = prevIsRunningRef.current;
          const gameAlreadyFinished = isGameFinished(currentGameRef.current);

          // Fire alerts only on genuine state transitions (not beacons or init)
          if (!gameAlreadyFinished && prev !== null && prev !== newIsRunning) {
            // Skip echo toast if this device triggered the pause/resume
            if (skipNextTimerToastRef.current) {
              skipNextTimerToastRef.current = false;
            } else {
              const currentBase = currentGameRef.current?.base || {};
              const homeTeamId = String(currentBase?.teamId || "");
              const awayTeamId = String(currentBase?.opponentTeamId || "");
              const actingTeamId = String(data.actingTeamId || "");
              let actingTeamName = data.actingTeamName || "";

              if (!actingTeamName && actingTeamId) {
                if (actingTeamId === awayTeamId) actingTeamName = data.awayTeamName || "";
                else if (actingTeamId === homeTeamId) actingTeamName = data.homeTeamName || "";
              }

              if (!actingTeamName) {
                actingTeamName = data.teamSide === "away"
                  ? (data.awayTeamName || "Away team")
                  : (data.homeTeamName || teamNameRef.current || "Home team");
              }

              if (!newIsRunning && data.timerReason === "basketball_quarter_end") {
                alertQuarterEnd(data.periodNumber);
              } else if (sport === "Basketball" && !newIsRunning) {
                alertBasketballPause();
              } else if (sport === "Basketball") {
                alertBasketballResume();
              } else if (!newIsRunning) {
                alertPause(actingTeamName);
              } else {
                alertResume(actingTeamName);
              }
            }
          }

          prevIsRunningRef.current = newIsRunning;
          const snapshot = applyTimerSnapshot(data, sport);
          setGameTime((prevState) => mergeTimerSnapshot(prevState, snapshot, sport));
          return;
        }

        if (data?.game) {
          try {
            // Only apply if the data has proper {base, sport} structure
            // Backend sometimes sends just sportGame (e.g., undo events) which would corrupt state
            const rawGame = data.game?.data || data.game;
            if (rawGame?.base && rawGame?.sport) {
              const game = normalizeGameModel(data.game);
              const merged = mergeGamePermissions(currentGameRef.current, game);
              if (merged?.base && merged?.sport && isMountedRef.current) {
                if (incomingGameReconcilerRef?.current) {
                  const reconciled = incomingGameReconcilerRef.current(merged);
                  if (reconciled !== false) {
                    setCurrentGame(() => mergeGamePermissions(currentGameRef.current, reconciled || merged));
                  }
                } else {
                  setCurrentGame(mergeGamePermissions(currentGameRef.current, merged));
                }
                setGameOver(isGameFinished(merged));
              }
            } else if (data.type === "event_undone" && rawGame && currentGameRef.current?.base && isMountedRef.current) {
              const game = normalizeGameModel({
                base: currentGameRef.current.base,
                sport: rawGame,
              });
              const merged = mergeGamePermissions(currentGameRef.current, game);
              if (incomingGameReconcilerRef?.current) {
                const reconciled = incomingGameReconcilerRef.current(merged);
                if (reconciled !== false) {
                  setCurrentGame(() => mergeGamePermissions(currentGameRef.current, reconciled || merged));
                  setGameOver(isGameFinished(reconciled || merged));
                }
              } else {
                setCurrentGame(mergeGamePermissions(currentGameRef.current, merged));
                setGameOver(isGameFinished(merged));
              }
            } else {
              // Partial update — just re-fetch to get full consistent state
              fetchGameRef.current?.();
            }
          } catch {
            fetchGameRef.current?.();
          }
        }
      });

      unsubGameEvent = onGameEvent((data) => {
        if (data?.gameId && String(data.gameId) !== String(gameId)) return;
        if (sport === "Chess") return;
        fetchGameRef.current?.();
      });

      unsubCommentary = onCommentaryUpdate((data) => {
        if (data?.gameId && String(data.gameId) !== String(gameId)) return;
        if (!voiceEnabledRef.current || !data?.commentary) return;
        const audioBuffer = data.audioData?.success ? data.audioData?.audioBuffer : null;
        playCommentaryAudio(audioBuffer, data.commentary);
      });
    });

    return () => {
      unsubCommentary?.();
      unsubGameEvent?.();
      unsubGameUpdate?.();
      unsubReconnect?.();
      leaveGameRoom(gameId);
      if (commentarySoundRef.current) {
        try { commentarySoundRef.current.pause(); commentarySoundRef.current.remove(); } catch {}
        commentarySoundRef.current = null;
      }
      Speech.stop();
    };
  // teamName intentionally excluded — kept in teamNameRef to avoid reconnecting
  // the socket every time game data loads and the team name changes from "" to
  // its real value. alertPause/alertResume are stable useCallback values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameId,
    sport,
    playCommentaryAudio,
    alertPause,
    alertResume,
    alertBasketballPause,
    alertBasketballResume,
    alertQuarterEnd,
    incomingGameReconcilerRef,
  ]);

  return {
    alertPause,
    alertResume,
    alertBasketballPause,
    alertBasketballResume,
    skipNextTimerToastRef,
  };
}
