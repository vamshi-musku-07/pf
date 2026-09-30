import React, { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import VolleyballScoringPanel from "./VolleyballScoringPanel";

export default function LiveVolleyballScoringPanel({ gameId, ...rest }) {
  const UI = useGameScoringTheme();
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  useSyncExternalSnapshot(rest.currentGame, syncExternalSnapshot);
  const { game, hasHydrated } = useHydrationLockedGame(derivedGame, rest.currentGame);
  const base = game?.base || {};

  if (__DEV__ && game) {
    // eslint-disable-next-line no-console
    console.debug("[LiveVolleyball]", gameId, "hydrated=", hasHydrated,
      "score=", game?.sport?.score, "set=", game?.sport?.currentSet);
  }

  const teamIdForSide = (side) =>
    side === "home" ? base.teamId : base.opponentTeamId;

  const handleScore = useCallback(
    (eventType, side, playerId, extras = {}) => {
      dispatchEvent({
        type: LEGACY.VOLLEYBALL,
        payload: {
          body: {
            eventType,
            teamSide: side,
            teamId: teamIdForSide(side),
            playerId: playerId || null,
            timestamp: new Date().toISOString(),
            ...extras,
          },
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, base.teamId, base.opponentTeamId]
  );

  if (!game && !rest.currentGame) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <ActivityIndicator size="large" color={UI.accent} />
        <Text style={{ color: UI.muted, marginTop: 12, fontSize: 13 }}>Loading volleyball…</Text>
      </View>
    );
  }

  return (
    <VolleyballScoringPanel
      {...rest}
      currentGame={game}
      onScore={handleScore}
      isUpdating={rest.isUpdating}
    />
  );
}
