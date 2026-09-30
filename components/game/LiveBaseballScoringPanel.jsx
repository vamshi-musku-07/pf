// Live-architecture wrapper around BaseballScoringPanelMobile.
//
// Baseball panel surface: onEvent(eventType, teamSide, playerId, extraData).
// This wrapper:
//   - Reads derivedGame = serverState + pendingEvents from Redux
//   - Dispatches LEGACY_BASEBALL events to the local-first queue
//   - Never blocks on network sync (isUpdating={false})
//   - Locks onto derivedGame after first hydration (no stale-prop flicker)

import React, { useCallback } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import BaseballScoringPanel from "./BaseballScoringPanel";

export default function LiveBaseballScoringPanel({ gameId, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};

  if (__DEV__ && game) {
    // eslint-disable-next-line no-console
    console.debug("[LiveBaseball]", gameId, "hydrated=", hasHydrated,
      "score=", game?.sport?.score, "inning=", game?.sport?.currentInning,
      "half=", game?.sport?.inningHalf, "count=", game?.sport?.currentCount);
  }

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleEvent = useCallback(
    (eventType, side, playerId, extras = {}) => {
      dispatchEvent({
        type: LEGACY.BASEBALL,
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
    [dispatchEvent, base.teamId, base.opponentTeamId]
  );

  return (
    <BaseballScoringPanel
      {...rest}
      currentGame={game}
      onEvent={handleEvent}
    />
  );
}
