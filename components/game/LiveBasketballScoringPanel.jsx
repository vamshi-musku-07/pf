// Live-architecture wrapper around BasketballScoringPanelMobile.
//
// Basketball panel surface: onEvent(eventType, teamSide, playerId, extraData).
// This wrapper:
//   - Reads derivedGame = serverState + pendingEvents from Redux
//   - Dispatches LEGACY_BASKETBALL events to the local-first queue
//   - Never blocks on network sync (isUpdating={false})
//   - Locks onto derivedGame after first hydration (no stale-prop flicker)

import React, { useCallback } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import BasketballScoringPanelMobile from "./BasketballScoringPanel";

export default function LiveBasketballScoringPanel({ gameId, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};
  const sport = game?.sport || {};

  if (__DEV__ && game) {
    // eslint-disable-next-line no-console
    console.debug("[LiveBasketball]", gameId, "hydrated=", hasHydrated,
      "score=", sport?.score, "quarter=", sport?.currentQuarter);
  }

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleEvent = useCallback(
    (eventType, side, playerId, extraData = {}) => {
      dispatchEvent({
        type: LEGACY.BASKETBALL,
        payload: {
          body: {
            eventType,
            teamSide: side,
            teamId: teamIdForSide(side),
            playerId: playerId || null,
            quarter: extraData?.quarter ?? sport?.currentQuarter ?? 1,
            timestamp: new Date().toISOString(),
            ...(extraData || {}),
          },
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, base.teamId, base.opponentTeamId, sport?.currentQuarter]
  );

  return (
    <BasketballScoringPanelMobile
      {...rest}
      currentGame={game}
      onEvent={handleEvent}
      isUpdating={false}
    />
  );
}
