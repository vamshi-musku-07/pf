// Live-architecture wrapper around PickleballScoringPanel.
//
// Pickleball panel surface: onScore(eventType, side, playerId, extras).
// This wrapper:
//   - Reads derivedGame = serverState + pendingEvents from Redux
//   - Dispatches LEGACY_PICKLEBALL events to the local-first queue
//   - Never blocks on network sync (isUpdating={false})
//   - Locks onto derivedGame after first hydration (no stale-prop flicker)
//
// REPLAY CONTRACT:
//   derivedGame = clone(serverState) + replay(pendingEvents)
//   NEVER render from rest.currentGame after hydration.
//   NEVER allow stale v=0 polls to overwrite serverState (hydrateGame guard).
//   NEVER use advanceServeAfterServerLoss in rally_won handling � when
//   serverNumber=1 that function keeps serve on the losing team, causing the
//   wrong team to receive the point.

import React, { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import PickleballScoringPanel from "./PickleballScoringPanel";

const DEV = typeof __DEV__ !== "undefined" && __DEV__;

export default function LivePickleballScoringPanel({ gameId, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot, queueHealth } =
    useLiveGame(gameId);
  const serverVersion = useSelector(
    (s) => s.liveGame?.byGameId?.[gameId]?.serverVersion || 0,
  );
  const serverScore = useSelector(
    (s) => s.liveGame?.byGameId?.[gameId]?.serverState?.sport?.currentPointScore,
  );
  const serverServingTeam = useSelector(
    (s) => s.liveGame?.byGameId?.[gameId]?.serverState?.sport?.servingTeam,
  );

  // -- Log incoming REST poll snapshots --
  const lastLoggedVersionRef = useRef(-1);
  useEffect(() => {
    if (!DEV || !rest.currentGame) return;
    const v = Number(rest.currentGame?.base?.version) || 0;
    if (v !== lastLoggedVersionRef.current) {
      lastLoggedVersionRef.current = v;
      // eslint-disable-next-line no-console
      console.debug("[LivePickleball] REST poll snapshot", {
        gameId,
        incomingVersion: v,
        serverVersion,
        incomingScore: rest.currentGame?.sport?.currentPointScore,
        incomingServingTeam: rest.currentGame?.sport?.servingTeam,
        serverScore,
        willDrop:
          v === 0 && serverVersion > 0
            ? "YES (v=0 guard)"
            : v > 0 && v < serverVersion
              ? "YES (stale)"
              : "NO",
      });
    }
  }, [rest.currentGame]);

  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};
  const sport = game?.sport || {};

  // -- Log derived-game lifecycle --
  useEffect(() => {
    if (!DEV || !game) return;
    // eslint-disable-next-line no-console
    console.debug("[LivePickleball] derivedGame updated", {
      gameId,
      hasHydrated,
      serverVersion,
      serverScore,
      serverServingTeam,
      derivedScore: sport?.currentPointScore,
      derivedServingTeam: sport?.servingTeam,
      derivedServerNumber: sport?.serverNumber,
      pending: queueHealth?.pending,
      inflight: queueHealth?.inflight,
      failed: queueHealth?.failed,
    });
  }, [
    sport?.currentPointScore?.player1,
    sport?.currentPointScore?.player2,
    sport?.servingTeam,
    queueHealth?.pending,
  ]);

  const teamIdForSide = useCallback(
    (side) => (side === "home" ? base.teamId : base.opponentTeamId),
    [base.teamId, base.opponentTeamId],
  );

  // Pickleball panel signature: onScore(eventType, side, playerId, extras)
  const handleScore = useCallback(
    (eventType, side, playerId, extras = {}) => {
      if (DEV) {
        // eslint-disable-next-line no-console
        console.debug("[LivePickleball] dispatchEvent", {
          gameId,
          eventType,
          side,
          playerId: playerId || null,
          teamId: teamIdForSide(side),
          serverVersion,
          serverServingTeam,
          derivedServingTeam: sport?.servingTeam,
          derivedServerNumber: sport?.serverNumber,
          pointScoreBefore: sport?.currentPointScore,
          pendingBefore: queueHealth?.pending,
        });
      }
      dispatchEvent({
        type: LEGACY.PICKLEBALL,
        payload: {
          body: {
            eventType,
            teamSide: side,
            teamId: teamIdForSide(side),
            playerId: playerId || null,
            timestamp: new Date().toISOString(),
            ...(extras || {}),
          },
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, teamIdForSide],
  );

  // Undo: dispatches an "undo" event through the live queue.
  // This works whether the last scoring event is still pending (queue not yet
  // sent) OR already ACKed (event committed to server). The server handles
  // "undo" by replaying history minus the last event; the client reducer
  // applies applyOptimisticPickleballUndo for the optimistic rewind.
  const handleUndo = useCallback(() => {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[LivePickleball] handleUndo — dispatching undo event");
    }
    dispatchEvent({
      type: LEGACY.PICKLEBALL,
      payload: {
        body: {
          eventType: "undo",
          // teamSide/teamId are unused by the server undo handler but required
          // to pass the schema guard; use neutral placeholder values.
          teamSide: "home",
          teamId: null,
          playerId: null,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }, [dispatchEvent]);

  return (
    <PickleballScoringPanel
      {...rest}
      currentGame={game}
      onScore={handleScore}
      onUndo={handleUndo}
      // Never gate UI on sync -- pickleball needs instant tap response.
      isUpdating={false}
    />
  );
}
