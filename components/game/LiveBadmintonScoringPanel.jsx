import React, { useCallback, useEffect } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import BadmintonScoringPanel from "./BadmintonScoringPanel";

export default function LiveBadmintonScoringPanel({ gameId, undoRef, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleScore = useCallback(
    (eventType, side, playerId) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[LiveBadminton] dispatch score', { eventType, side, playerId });
      }
      dispatchEvent({
        type: LEGACY.BADMINTON,
        payload: {
          body: {
            eventType,
            teamSide: side,
            teamId: teamIdForSide(side),
            playerId: playerId || null,
            timestamp: new Date().toISOString(),
          },
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, base.teamId, base.opponentTeamId]
  );

  // Undo: dispatched through Redux so derivedGame = serverState + pendingEvents
  // stays coherent. NEVER call the legacy setCurrentGame / removeLastEventAPI
  // path — that causes a double-undo and 0-0 flash.
  const handleUndo = useCallback(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.debug('[LiveBadminton] dispatch undo', {
        derivedScore: game?.sport?.score,
        pendingEventsCount: game?.sport?.events?.length,
      });
    }
    dispatchEvent({
      type: LEGACY.BADMINTON,
      payload: {
        body: {
          eventType: 'undo',
          timestamp: new Date().toISOString(),
        },
      },
    });
  }, [dispatchEvent, game?.sport?.score, game?.sport?.events?.length]);

  useEffect(() => {
    if (undoRef) undoRef.current = handleUndo;
    return () => { if (undoRef) undoRef.current = null; };
  }, [undoRef, handleUndo]);

  return (
    <BadmintonScoringPanel
      {...rest}
      currentGame={game}
      onScore={handleScore}
      isUpdating={false}
    />
  );
}
