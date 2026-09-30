// Live-architecture wrapper around FootballScoringPanelMobile.
//
// Football panel surface: onEvent(eventType, teamSide, playerId, extraData).
// This wrapper:
//   - Reads derivedGame = serverState + pendingEvents from Redux
//   - Dispatches LEGACY_FOOTBALL events to the local-first queue
//   - Never blocks on network sync (isUpdating={false})
//   - Locks onto derivedGame after first hydration (no stale-prop flicker)
//   - Passes onSubstitution / onMatchStateChange / onTimerAdjust through
//     unchanged — those have their own API paths and are not event-sourced.
//
// REPLAY CONTRACT:
//   derivedGame = clone(serverState) + replay(pendingEvents)
//   NEVER render from rest.currentGame after hydration.
//   NEVER allow stale v=0 polls to overwrite serverState (hydrateGame guard).

import React, { useCallback, useEffect, useRef } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import { useSelector } from "react-redux";
import FootballScoringPanelMobile from "./FootballScoringPanel";

const DEV = typeof __DEV__ !== "undefined" && __DEV__;

export default function LiveFootballScoringPanel({ gameId, undoRef, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot, queueHealth } = useLiveGame(gameId);
  const serverVersion = useSelector((s) => s.liveGame?.byGameId?.[gameId]?.serverVersion || 0);
  const serverScore = useSelector((s) => s.liveGame?.byGameId?.[gameId]?.serverState?.sport?.score);

  // ── Log incoming REST poll snapshots before they are synced ──
  const lastLoggedVersionRef = useRef(-1);
  useEffect(() => {
    if (!DEV || !rest.currentGame) return;
    const v = Number(rest.currentGame?.base?.version) || 0;
    if (v !== lastLoggedVersionRef.current) {
      lastLoggedVersionRef.current = v;
      // eslint-disable-next-line no-console
      console.debug("[LiveFootball] REST poll snapshot", {
        gameId,
        incomingVersion: v,
        serverVersion,
        incomingScore: rest.currentGame?.sport?.score,
        serverScore,
        eventCount: rest.currentGame?.sport?.events?.length,
        willDrop: v === 0 && serverVersion > 0 ? "YES (v=0 bypass guard)" : v > 0 && v < serverVersion ? "YES (stale)" : "NO",
      });
    }
  }, [rest.currentGame]);

  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};
  const sport = game?.sport || {};

  // ── Log derived-game lifecycle ──
  useEffect(() => {
    if (!DEV || !game) return;
    // eslint-disable-next-line no-console
    console.debug("[LiveFootball] derivedGame updated", {
      gameId,
      hasHydrated,
      serverVersion,
      serverScore,
      derivedScore: sport?.score,
      pending: queueHealth?.pending,
      inflight: queueHealth?.inflight,
      failed: queueHealth?.failed,
      eventCount: sport?.events?.length,
    });
  }, [sport?.score?.home, sport?.score?.away, queueHealth?.pending]);

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleUndo = useCallback(() => {
    const side = rest.isSelfOwnedOpponent ? null : (rest.userSide || "home");
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[LiveFootball] dispatch undo", {
        gameId,
        teamSide: side,
        eventCount: sport?.events?.length,
      });
    }
    dispatchEvent({
      type: LEGACY.FOOTBALL,
      payload: {
        body: {
          eventType: "undo",
          teamSide: side,
          teamId: side ? teamIdForSide(side) : null,
          playerId: null,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }, [dispatchEvent, rest.userSide, rest.isSelfOwnedOpponent, gameId, sport?.events?.length, base.teamId, base.opponentTeamId]);

  useEffect(() => {
    if (undoRef) undoRef.current = handleUndo;
    return () => {
      if (undoRef) undoRef.current = null;
    };
  }, [undoRef, handleUndo]);

  const handleEvent = useCallback(
    (eventType, side, playerId, extraData = {}) => {
      if (DEV) {
        // eslint-disable-next-line no-console
        console.debug("[LiveFootball] dispatchEvent", {
          gameId,
          eventType,
          side,
          playerId,
          serverVersion,
          serverScore,
          pendingBefore: queueHealth?.pending,
        });
      }
      dispatchEvent({
        type: LEGACY.FOOTBALL,
        payload: {
          body: {
            eventType,
            teamSide: side,
            teamId: teamIdForSide(side),
            playerId: playerId || null,
            timestamp: new Date().toISOString(),
            ...(extraData || {}),
          },
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, base.teamId, base.opponentTeamId]
  );

  return (
    <FootballScoringPanelMobile
      {...rest}
      currentGame={game}
      onEvent={handleEvent}
      isUpdating={false}
    />
  );
}

