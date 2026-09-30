import { useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameScoreRow } from "./helpers";
import { startGameAPI } from "@/services/GameApi";
import CricketStatsDashboard from "@/components/game/CricketStatsDashboard";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

export default function StatsTab({ games, team, players, isOwner = false, onSelectGame, refreshing, onRefresh }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const insets = useSafeAreaInsets();
  const bottomContentPad = Math.max(insets.bottom + 28, 48);
  const [startingGameId, setStartingGameId] = useState(null);
  const finished = (games || []).filter((g) => g?.base?.status === "finished");
  const live = (games || []).filter((g) => g?.base?.status === "live");
  const scheduled = (games || []).filter(
    (g) => g?.base?.status === "scheduled",
  );
  const hasAnyGame = (games || []).length > 0;
  const isChessTeam = String(team?.sport || "").toLowerCase() === "chess";
  const isCricketTeam = String(team?.sport || "").toLowerCase() === "cricket";

  const handleStartScheduledGame = async (gameId) => {
    if (!gameId || startingGameId) return;
    setStartingGameId(gameId);
    try {
      await startGameAPI(gameId);
      onSelectGame && onSelectGame(gameId);
    } catch {
      Alert.alert("Unable to start game", "Please try again.");
    } finally {
      setStartingGameId(null);
    }
  };

  const cardStyle = isDark
    ? {
        backgroundColor: T.surface,
        borderWidth: 1,
        borderColor: T.border,
      }
    : undefined;

  return (
    <ScrollView
      className="flex-1 px-4 pt-4"
      {...(isDark ? { style: { backgroundColor: T.bg } } : {})}
      contentContainerStyle={{ paddingBottom: bottomContentPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={!!refreshing}
          onRefresh={onRefresh}
          colors={["#081126"]}
          tintColor={isDark ? T.refresh : "#081126"}
        />
      }
    >
      {!hasAnyGame && (
        <View
          className={`items-center py-8 mb-2 rounded-2xl shadow-sm ${isDark ? "" : "bg-white"}`}
          style={cardStyle}
        >
          <ExpoImage
            source={TEAM_EMPTY_ICONS.opponent}
            style={TEAM_EMPTY_ICON_STYLE}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text
            className="text-gray-500 font-bold text-base mt-1"
            style={isDark ? { color: T.textDim } : undefined}
          >
            Game not started
          </Text>
          <Text
            className="text-gray-400 text-sm mt-1 text-center px-4"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            Add an opponent and start a game to track stats here
          </Text>
        </View>
      )}

      {live.map((g, idx) => (
        <TouchableOpacity
          key={g._id || idx}
          onPress={() => onSelectGame && onSelectGame(g._id || g.base?._id)}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-3"
          style={isDark ? { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)" } : undefined}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-2 h-2 rounded-full bg-red-500" />
            <Text className="text-red-500 font-bold text-xs uppercase">
              Live — Tap to view
            </Text>
          </View>
          <GameScoreRow game={g} teamName={team.teamName} isDark={isDark} />
        </TouchableOpacity>
      ))}

      {scheduled.length > 0 && (
        <>
          <Text
            className="text-lg font-bold text-gray-900 mb-3"
            style={isDark ? { color: T.text } : undefined}
          >
            Scheduled
          </Text>
          {scheduled.map((g, idx) => (
            <View
              key={g._id || idx}
              className={`rounded-xl p-4 mb-3 shadow-sm ${isDark ? "" : "bg-white"}`}
              style={cardStyle}
            >
              <TouchableOpacity
                onPress={() => onSelectGame && onSelectGame(g._id || g.base?._id)}
              >
              <GameScoreRow game={g} teamName={team.teamName} isDark={isDark} />
              <Text
                className="text-blue-500 text-xs text-center mt-2 font-semibold"
                style={isDark ? { color: "#93C5FD" } : undefined}
              >
                Tap to manage game
              </Text>
              </TouchableOpacity>
              {isOwner && isChessTeam && (
                <TouchableOpacity
                  onPress={() => handleStartScheduledGame(g._id || g.base?._id)}
                  disabled={startingGameId === (g._id || g.base?._id)}
                  className="mt-3 rounded-lg py-2.5 items-center"
                  style={{ backgroundColor: "#16a34a", opacity: startingGameId === (g._id || g.base?._id) ? 0.6 : 1 }}
                >
                  {startingGameId === (g._id || g.base?._id) ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-xs font-bold">▶ Start Match</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {isCricketTeam && (
        <CricketStatsDashboard
          games={games}
          teamId={team?._id}
          players={players}
          isDark={isDark}
        />
      )}

      <Text
        className="text-lg font-bold text-gray-900 mb-3"
        style={isDark ? { color: T.text } : undefined}
      >
        Match History
      </Text>
      {finished.length === 0 ? (
        <View className="items-center py-10">
          <ExpoImage
            source={TEAM_EMPTY_ICONS.stats}
            style={TEAM_EMPTY_ICON_STYLE}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text
            className="text-gray-400 mt-1"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            No completed games yet
          </Text>
        </View>
      ) : (
        finished.map((g, idx) => (
          <TouchableOpacity
            key={g._id || idx}
            onPress={() => onSelectGame && onSelectGame(g._id || g.base?._id)}
            className={`rounded-xl p-4 mb-3 shadow-sm ${isDark ? "" : "bg-white"}`}
            style={cardStyle}
          >
            <GameScoreRow game={g} teamName={team.teamName} isDark={isDark} />
            <Text
              className="text-gray-400 text-xs text-center mt-2"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              {g.base?.sport} {"\u2022"}{" "}
              {new Date(g.base?.createdAt || g.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// =============================================
// MAIN DASHBOARD SCREEN
// =============================================
