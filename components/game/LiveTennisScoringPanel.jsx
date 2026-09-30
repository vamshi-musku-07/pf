// Drop-in live wrapper for Tennis. Identical surface to TennisScoringPanel,
// but reads from derivedGame and dispatches LEGACY_TENNIS events to the
// local-first queue. Buttons never block on network.

import React, { useCallback, useEffect } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import TennisScoringPanel from "./TennisScoringPanel";

export default function LiveTennisScoringPanel({ gameId, undoRef, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};

  if (__DEV__ && game) {
    // eslint-disable-next-line no-console
    console.debug("[LiveTennis]", gameId, "hydrated=", hasHydrated,
      "score=", game?.sport?.currentPointScore, "sets=", game?.sport?.setsWon);
  }

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleScore = useCallback(
    (eventType, side, playerId) => {
      dispatchEvent({
        type: LEGACY.TENNIS,
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

  const handleUndo = useCallback(() => {
    dispatchEvent({
      type: LEGACY.TENNIS,
      payload: {
        body: {
          eventType: "undo",
          timestamp: new Date().toISOString(),
        },
      },
    });
  }, [dispatchEvent]);

  useEffect(() => {
    if (undoRef) undoRef.current = handleUndo;
    return () => { if (undoRef) undoRef.current = null; };
  }, [undoRef, handleUndo]);

  return (
    <TennisScoringPanel
      {...rest}
      currentGame={game}
      onScore={handleScore}
      isUpdating={false}
    />
  );
}
