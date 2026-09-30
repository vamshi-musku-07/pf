// Live-architecture wrapper around TableTennisScoringPanelMobile.
//
// Drop-in usage:
//
//   <LiveTableTennisScoringPanel gameId={gameId} userSide="home" ... />
//
// Internally:
//   - Reads derivedGame = serverState + pendingEvents from Redux
//   - Dispatches TT_* events to the local-first queue on every tap
//   - Never blocks on isUpdating — buttons stay live during sync
//
// The underlying panel UI is unchanged.

import React, { useCallback, useEffect } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { TT } from "../../features/liveGame/events/eventTypes";
import TableTennisScoringPanel from "./TableTennisScoringPanel";

// Map legacy panel event strings -> canonical TT_* event types.
function toLiveEvent(legacyType, side) {
  switch (legacyType) {
    case "pointWon":
    case "winner":
    case "return_winner":
    case "forehand_smash":
    case "forehand_attack":
    case "backhand_smash":
    case "backhand_attack":
      return { type: TT.POINT, payload: { side, reason: legacyType } };
    case "serve_ace":
      return { type: TT.SERVE_ACE, payload: { side } };
    case "unforced_error":
    case "forced_error":
    case "forehand_error":
    case "backhand_error":
    case "net_ball":
    case "out_of_bounds":
    case "double_bounce":
    case "receive_error":
      // Panel passes the side that committed the error; scorer is the opponent.
      return { type: TT.UNFORCED_ERROR, payload: { side, reason: legacyType } };
    case "serve_error":
    case "double_fault":
      return { type: TT.SERVE_ERROR, payload: { side, reason: legacyType } };
    case "timeout":
      return { type: TT.TIMEOUT, payload: { side } };
    default:
      return null;
  }
}

export default function LiveTableTennisScoringPanel({ gameId, undoRef, ...rest }) {
  const { derivedGame, dispatchEvent, queueHealth, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game } = useHydrationLockedGame(derivedGame, rest.currentGame);

  const handleScore = useCallback(
    (legacyType, side /*, selectedPlayer */) => {
      const live = toLiveEvent(legacyType, side);
      if (!live) return;
      dispatchEvent(live);
    },
    [dispatchEvent]
  );

  const handleUndo = useCallback(() => {
    const dev = typeof __DEV__ !== 'undefined' && __DEV__;
    if (dev) {
      // eslint-disable-next-line no-console
      console.debug('[LiveTableTennisScoringPanel] handleUndo dispatching TT.UNDO');
    }
    dispatchEvent({ type: TT.UNDO, payload: {} });
  }, [dispatchEvent]);

  useEffect(() => {
    if (undoRef) undoRef.current = handleUndo;
    return () => { if (undoRef) undoRef.current = null; };
  }, [undoRef, handleUndo]);

  return (
    <TableTennisScoringPanel
      {...rest}
      currentGame={game}
      onScore={handleScore}
      // Critical: never gate buttons on network sync. Local queue handles it.
      isUpdating={false}
      // Optional: surface queue health to a small badge in the panel if desired.
      liveQueueHealth={queueHealth}
    />
  );
}
