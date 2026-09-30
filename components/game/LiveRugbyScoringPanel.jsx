import React, { useCallback, useEffect } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import RugbyScoringPanel from "./RugbyScoringPanel";

// Rugby panel uses onEvent(eventType, teamSide, playerId).
export default function LiveRugbyScoringPanel({ gameId, undoRef, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleEvent = useCallback(
    (eventType, side, playerId) => {
      const body = {
        eventType,
        teamSide: side,
        teamId: teamIdForSide(side),
        playerId: playerId || null,
        timestamp: new Date().toISOString(),
      };
      // Include optimistic sin-bin expiry so derivedGame.sport.cards is
      // populated immediately (player blocked from selection at once).
      // Server recomputes sinBinUntil authoritatively on its side.
      if (eventType === "yellow_card") {
        body.sinBinUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      }
      dispatchEvent({ type: LEGACY.RUGBY, payload: { body } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, base.teamId, base.opponentTeamId]
  );

  const handleUndo = useCallback(() => {
    dispatchEvent({
      type: LEGACY.RUGBY,
      payload: { body: { eventType: "undo", timestamp: new Date().toISOString() } },
    });
  }, [dispatchEvent]);

  // Register the undo function with the parent so the header button can call it.
  useEffect(() => {
    if (undoRef) undoRef.current = handleUndo;
    return () => { if (undoRef) undoRef.current = null; };
  }, [undoRef, handleUndo]);

  return (
    <RugbyScoringPanel
      {...rest}
      currentGame={game}
      onEvent={handleEvent}
      isUpdating={false}
    />
  );
}
