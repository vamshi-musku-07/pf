import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

/**
 * Legacy redirect — tournament Watch live now opens the team page in spectator mode.
 */
export default function SpectateGameRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const teamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  useEffect(() => {
    if (!gameId) {
      router.replace(backTo || "/tournament");
      return;
    }
    if (teamId) {
      router.replace({
        pathname: `/team/${teamId}`,
        params: {
          gameId: String(gameId),
          spectate: "1",
          initialTab: "STATS",
          backTo: backTo || "/tournament",
        },
      });
    } else {
      router.replace(backTo || "/tournament");
    }
  }, [backTo, gameId, router, teamId]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1223" }}>
      <ActivityIndicator size="large" color="#9AEA62" />
    </View>
  );
}
