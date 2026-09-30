import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { createSharedGameAPI, endGameAPI, getGameByIdAPI } from "@/services/GameApi";
import { getTournamentsForTeamAPI, getMyTournamentsAPI } from "@/services/TournamentApi";
import { SPORT_ICONS as sportIcons, DEFAULT_SPORT_ICON as defaultIcon } from "@/constants/sports";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { normalizeGameModel } from "@/lib/gameModel";
import { isGameFinished } from "../../../components/game/hooks/gameStatus";
import { logoRequireMap, EventIcon, formatDate } from "./helpers";
import TeamTournamentsStrip from "./TeamTournamentsStrip";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const TABLE_TENNIS_MATCH_FORMATS = [
  { value: "best_of_3", label: "Best of 3" },
  { value: "best_of_5", label: "Best of 5" },
  { value: "best_of_7", label: "Best of 7" },
];

const DEFAULT_HOCKEY_MATCH_FORMAT = {
  structureType: "quarters",
  periodCount: 4,
  periodDurationMinutes: 15,
  label: "4 quarters",
};

const normalizeHockeyMatchFormat = (matchFormat) => {
  if (!matchFormat) return DEFAULT_HOCKEY_MATCH_FORMAT;
  if (typeof matchFormat === "string") {
    if (matchFormat === "halves_35" || matchFormat === "2_halves") {
      return { structureType: "halves", periodCount: 2, periodDurationMinutes: 35, label: "2 halves" };
    }
    return DEFAULT_HOCKEY_MATCH_FORMAT;
  }
  const structureType = matchFormat.structureType === "halves" ? "halves" : "quarters";
  const periodCount = Number(matchFormat.periodCount) || (structureType === "halves" ? 2 : 4);
  const periodDurationMinutes = Number(matchFormat.periodDurationMinutes) || (structureType === "halves" ? 35 : 15);
  return {
    structureType,
    periodCount,
    periodDurationMinutes,
    label: matchFormat.label || `${periodCount} ${structureType}`,
  };
};

const getTableTennisMatchFormatLabel = (matchFormat) =>
  TABLE_TENNIS_MATCH_FORMATS.find((option) => option.value === matchFormat)?.label || "Best of 5";

const getHockeyMatchFormatLabel = (matchFormat) => {
  const normalized = normalizeHockeyMatchFormat(matchFormat);
  return normalized.structureType === "halves"
    ? `2 halves x ${normalized.periodDurationMinutes} min`
    : `4 quarters x ${normalized.periodDurationMinutes} min`;
};

const getEntityId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id || value.id || null;
};

const sizedRemoteSource = (source, width, height) => {
  if (source && typeof source === "object" && source.uri) {
    return { ...source, width, height };
  }
  return source;
};

const GAME_STATUS_PRIORITY = {
  live: 4,
  in_progress: 4,
  scheduled: 3,
  pending: 2,
  finished: 1,
};

const toCurrentGameModel = (value) => {
  return normalizeGameModel(value);
};

const getSharedBaseGame = (games, teamId, opponentId, sport) => {
  if (!teamId || !opponentId) return null;

  // Regular team Home must never pick up tournament fixtures — those are
  // scored only by tournament admins from the tournament screen.
  const matches = (games || []).filter((game) => {
    const base = game?.base || game;
    if (base?.tournamentId || base?.fixtureId) return false;
    const baseTeamId = getEntityId(base?.teamId);
    const baseOpponentId = getEntityId(base?.opponentTeamId);
    const baseSport = base?.sport || game?.sport;
    const isSharedMatch =
      (baseTeamId === teamId && baseOpponentId === opponentId) ||
      (baseTeamId === opponentId && baseOpponentId === teamId);

    return isSharedMatch && (!sport || baseSport === sport);
  });

  matches.sort((left, right) => {
    const leftBase = left?.base || left;
    const rightBase = right?.base || right;
    const leftPriority =
      GAME_STATUS_PRIORITY[leftBase?.status] ?? 0;
    const rightPriority =
      GAME_STATUS_PRIORITY[rightBase?.status] ?? 0;

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (
      new Date(rightBase?.startTime || rightBase?.createdAt || 0) -
      new Date(leftBase?.startTime || leftBase?.createdAt || 0)
    );
  });

  return matches[0] || null;
};

export default function HomeTab({
  team,
  players,
  schedules,
  games,
  isOwner,
  onTabChange,
  onSetGameId,
  refreshing,
  onRefresh,
}) {
  const router = useRouter();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [opponent, setOpponent] = useState(null);
  const [opponentLoading, setOpponentLoading] = useState(true);
  const [tournamentEntry, setTournamentEntry] = useState(null);
  const [teamTournaments, setTeamTournaments] = useState([]);
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [selectedMatchFormat, setSelectedMatchFormat] = useState("best_of_5");
  const [selectedHockeyFormat, setSelectedHockeyFormat] = useState(DEFAULT_HOCKEY_MATCH_FORMAT);
  const hydratedMatchFormatGameIdRef = useRef(null);
  const teamId = getEntityId(team);
  const opponentId = getEntityId(opponent);

  const loadOpponent = useCallback(async () => {
    setOpponentLoading(true);
    try {
      const opps = team?.opponents || [];
      if (opps.length > 0 && opps[0].opponentTeamId) {
        const opponentValue = opps[0].opponentTeamId;
        const rawOppId = getEntityId(opponentValue);
        let nextOpponent =
          opponentValue && typeof opponentValue === "object"
            ? opponentValue
            : null;

        if (rawOppId && (!nextOpponent?.teamName || !nextOpponent?.sport)) {
          const res = await getTeamByIdAPI(rawOppId);
          nextOpponent = res.data || res.team || res;
        }

        setOpponent(nextOpponent);
      } else {
        setOpponent(null);
        setCurrentGame(null);
      }
    } catch {
      setOpponent(null);
      setCurrentGame(null);
    } finally {
      setOpponentLoading(false);
    }
  }, [team]);

  useEffect(() => {
    loadOpponent();
  }, [loadOpponent]);

  const loadTournament = useCallback(async () => {
    if (!teamId) {
      setTournamentEntry(null);
      setTeamTournaments([]);
      return;
    }
    setTournamentLoading(true);
    try {
      const [entriesRes, listRes] = await Promise.allSettled([
        getTournamentsForTeamAPI(teamId),
        getMyTournamentsAPI([teamId]),
      ]);
      const entries =
        entriesRes.status === "fulfilled"
          ? (entriesRes.value?.data || []).filter(
              (e) => e?.tournament?._id && e.tournament.status !== "cancelled",
            )
          : [];
      const list =
        listRes.status === "fulfilled"
          ? (listRes.value?.data || []).filter((t) => t?._id && t.status !== "cancelled")
          : entries.map((e) => e.tournament).filter(Boolean);
      setTeamTournaments(list);
      const active =
        entries.find(
          (e) =>
            e.tournament.status !== "completed" &&
            e.tournament.status !== "cancelled",
        ) || entries[0] || null;
      setTournamentEntry(active);
    } catch {
      setTournamentEntry(null);
      setTeamTournaments([]);
    } finally {
      setTournamentLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    if (refreshing) loadTournament();
  }, [refreshing, loadTournament]);

  const tournamentFixture = tournamentEntry?.highlightFixture || null;
  const tournamentIsHome =
    tournamentFixture && teamId
      ? String(tournamentFixture.homeTeamId) === String(teamId)
      : false;
  const tournamentOpponent =
    tournamentFixture && teamId
      ? tournamentIsHome
        ? {
            name: tournamentFixture.awayTeamName,
            id: tournamentFixture.awayTeamId,
            logo: tournamentFixture.awayTeamLogo,
          }
        : {
            name: tournamentFixture.homeTeamName,
            id: tournamentFixture.homeTeamId,
            logo: tournamentFixture.homeTeamLogo,
          }
      : null;
  const tournamentOurLogo = tournamentFixture
    ? tournamentIsHome
      ? tournamentFixture.homeTeamLogo
      : tournamentFixture.awayTeamLogo
    : null;
  const tournamentIsLive =
    tournamentFixture?.gameStatus === "live" ||
    tournamentFixture?.gameStatus === "halftime" ||
    tournamentFixture?.status === "live";
  const tournamentVsSameOpponent =
    !!opponentId &&
    !!tournamentOpponent?.id &&
    String(tournamentOpponent.id) === String(opponentId);

  const openTournament = () => {
    if (!tournamentEntry?.tournament?._id) return;
    router.push({
      pathname: `/tournament/${tournamentEntry.tournament._id}`,
      params: { backTo: `/team/${teamId}`, teamId: String(teamId) },
    });
  };

  const watchTournamentLive = () => {
    if (!tournamentFixture?.gameId) return;
    router.push({
      pathname: `/team/${teamId}`,
      params: {
        initialTab: "STATS",
        gameId: String(tournamentFixture.gameId),
        spectate: "1",
        backTo: tournamentEntry?.tournament?._id
          ? `/tournament/${tournamentEntry.tournament._id}`
          : `/team/${teamId}`,
      },
    });
  };

  useEffect(() => {
    if (!opponentId || !teamId) {
      setCurrentGame(null);
      return;
    }

    const sharedBaseGame = getSharedBaseGame(
      games,
      teamId,
      opponentId,
      team?.sport,
    );
    if (!sharedBaseGame) {
      setCurrentGame(null);
      return;
    }

    const fallbackGame = toCurrentGameModel(sharedBaseGame);
    setCurrentGame(fallbackGame);

    const gameId = getEntityId(sharedBaseGame);
    if (!gameId) return;

    // Always fetch fresh game data so stale "scheduled" status doesn't
    // flash "Start Game" when the game is already live or finished.
    let cancelled = false;
    setGameLoading(true);

    (async () => {
      try {
        const gameRes = await getGameByIdAPI(gameId);
        if (cancelled) return;
        const nextGame = toCurrentGameModel(gameRes);
        if (nextGame) setCurrentGame(nextGame);
      } catch {
        // Keep the fallback on network error
      } finally {
        if (!cancelled) setGameLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [games, opponentId, team?.sport, teamId]);

  const currentGameId = getEntityId(currentGame?.base) || getEntityId(currentGame);
  const gameStatus = currentGame?.base?.status || currentGame?.status || null;
  const effectiveGameStatus = isGameFinished(currentGame) ? "finished" : gameStatus;

  useEffect(() => {
    if (!currentGameId || effectiveGameStatus !== "live") return undefined;

    let cancelled = false;
    const refreshLiveGame = async () => {
      try {
        const gameRes = await getGameByIdAPI(currentGameId);
        if (cancelled) return;
        const nextGame = toCurrentGameModel(gameRes);
        if (nextGame) {
          setCurrentGame(nextGame);
        }
      } catch {
        // Keep the current snapshot when background refresh fails.
      }
    };

    refreshLiveGame();
    const intervalId = setInterval(refreshLiveGame, 3000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentGameId, effectiveGameStatus]);

  const isTableTennis = team?.sport === "TableTennis" || team?.sport === "Table Tennis";
  const isHockey = team?.sport === "Hockey";
  const lockedMatchFormat =
    isTableTennis && currentGameId && effectiveGameStatus !== "finished" && effectiveGameStatus !== null
      ? currentGame?.sport?.matchFormat
      : null;
  const activeMatchFormat = lockedMatchFormat || selectedMatchFormat;
  const canSelectMatchFormat = isTableTennis && (!currentGameId || effectiveGameStatus === "finished" || effectiveGameStatus === null);
  const lockedHockeyFormat =
    isHockey && currentGameId && effectiveGameStatus !== "finished" && effectiveGameStatus !== null
      ? normalizeHockeyMatchFormat(currentGame?.sport?.matchFormat)
      : null;
  const activeHockeyFormat = lockedHockeyFormat || selectedHockeyFormat;
  const canSelectHockeyFormat = isHockey && (!currentGameId || effectiveGameStatus === "finished" || effectiveGameStatus === null);
  const rawFinalScore =
    currentGame?.base?.result?.finalScore || currentGame?.result?.finalScore;

  useEffect(() => {
    if (!isTableTennis) return;

    if (!currentGameId) {
      hydratedMatchFormatGameIdRef.current = null;
      return;
    }

    if (
      currentGame?.sport?.matchFormat &&
      hydratedMatchFormatGameIdRef.current !== currentGameId
    ) {
      setSelectedMatchFormat(currentGame.sport.matchFormat);
      hydratedMatchFormatGameIdRef.current = currentGameId;
    }
  }, [isTableTennis, currentGameId, currentGame?.sport?.matchFormat]);

  useEffect(() => {
    if (!isHockey) return;

    if (!currentGameId) {
      hydratedMatchFormatGameIdRef.current = null;
      return;
    }

    if (
      currentGame?.sport?.matchFormat &&
      hydratedMatchFormatGameIdRef.current !== `hockey-${currentGameId}`
    ) {
      setSelectedHockeyFormat(normalizeHockeyMatchFormat(currentGame.sport.matchFormat));
      hydratedMatchFormatGameIdRef.current = `hockey-${currentGameId}`;
    }
  }, [isHockey, currentGameId, currentGame?.sport?.matchFormat]);

  // Resolve the best available final score — sport-aware fallback chain
  const finalScore = (() => {
    if (rawFinalScore?.home || rawFinalScore?.away) return rawFinalScore;

    const s    = currentGame?.sport;
    const sport = currentGame?.base?.sport || team?.sport;
    if (!s && !rawFinalScore) return null;

    if (sport === "Pickleball") {
      // 1. Games won
      const h = s?.score?.home || 0;
      const a = s?.score?.away || 0;
      if (h || a) return { home: h, away: a };
      // 2. Derive games won from gameScores array
      const gs = s?.gameScores || [];
      if (gs.length > 0) {
        const hw = gs.filter(g => g.player1Points > g.player2Points).length;
        const aw = gs.filter(g => g.player2Points > g.player1Points).length;
        if (hw || aw) return { home: hw, away: aw };
      }
      // 3. Current set's point score (game ended mid-set)
      const p1 = s?.currentPointScore?.player1 || 0;
      const p2 = s?.currentPointScore?.player2 || 0;
      if (p1 || p2) return { home: p1, away: p2 };
      return rawFinalScore;
    }

    if (sport === "Tennis" || sport === "TableTennis" || sport === "Badminton") {
      const gs = s?.gameScores || s?.setScores || [];
      const hw = gs.filter(g => g.winner === "player1").length;
      const aw = gs.filter(g => g.winner === "player2").length;
      if (hw || aw) return { home: hw, away: aw };
    }

    if (sport === "Volleyball") {
      const h = s?.result?.setsWon?.home
        ?? (s?.sets || []).filter(st => st.winner === "home").length;
      const a = s?.result?.setsWon?.away
        ?? (s?.sets || []).filter(st => st.winner === "away").length;
      if (h || a) return { home: h, away: a };
    }

    // Generic: score.home/away → homeScore/awayScore
    const h = s?.score?.home || s?.homeScore || 0;
    const a = s?.score?.away || s?.awayScore || 0;
    if (h || a) return { home: h, away: a };
    return rawFinalScore;
  })();

  // Score from the current user's team perspective (their score first, opponent second)
  const isHomeTeam = getEntityId(currentGame?.base?.teamId) === teamId;
  const userScore     = finalScore ? (isHomeTeam ? finalScore.home : finalScore.away) : null;
  const opponentScore = finalScore ? (isHomeTeam ? finalScore.away : finalScore.home) : null;

  // Resolve logo source safely — fallback to defaultIcon when mapping/uri missing
  const resolveLogoSource = (teamObj, logoOverride) => {
    try {
      if (!teamObj && !logoOverride) return defaultIcon;
      const logoKey =
        logoOverride ?? teamObj?.teamlogo ?? teamObj?.teamLogo ?? teamObj?.logo;
      if (logoKey) {
        const mapped = logoRequireMap[logoKey];
        if (mapped) return mapped;
        if (typeof logoKey === "string" && (logoKey.startsWith("http") || logoKey.startsWith("/"))) {
          return { uri: logoKey };
        }
      }
      return sportIcons[teamObj?.sport] || defaultIcon;
    } catch {
      return defaultIcon;
    }
  };

  const handleStartGame = async () => {
    if (!opponent || !teamId || !opponentId) return;
    setStartingGame(true);
    try {
      let gameId = currentGameId;
      if (!gameId) {
        try {
          const createRes = await createSharedGameAPI({
            sport: team.sport,
            teamId,
            opponentTeamId: opponentId,
            venue: `${team.location || "Home"} Field`,
            startTime: new Date().toISOString(),
            ...(isTableTennis ? { matchFormat: selectedMatchFormat } : {}),
            ...(isHockey ? { matchFormat: selectedHockeyFormat } : {}),
          });

          const createdGame = toCurrentGameModel(createRes);
          const createdGameId =
            getEntityId(createdGame?.base) || getEntityId(createdGame);

          if (createdGame) {
            setCurrentGame(createdGame);
          }

          gameId = createdGameId;
        } catch (createErr) {
          if (createErr.response?.data?.existingGameId) {
            gameId = createErr.response.data.existingGameId;
            setCurrentGame((prev) => prev || { base: { _id: gameId, status: "scheduled" } });
          } else {
            throw createErr;
          }
        }
      }
      if (!gameId) {
        Alert.alert("Error", "Could not find or create a game");
        return;
      }
      if (onSetGameId) onSetGameId(gameId);
      onTabChange("STATS");
    } catch {
      Alert.alert("Error", "Failed to start game");
    } finally {
      setStartingGame(false);
    }
  };

  const handleNewGame = async () => {
    if (!opponent || !teamId || !opponentId) return;
    setStartingGame(true);
    try {
      const createParams = {
        sport: team.sport,
        teamId,
        opponentTeamId: opponentId,
        venue: `${team.location || "Home"} Field`,
        startTime: new Date().toISOString(),
        ...(isTableTennis ? { matchFormat: selectedMatchFormat } : {}),
        ...(isHockey ? { matchFormat: selectedHockeyFormat } : {}),
      };

      let createRes;
      try {
        createRes = await createSharedGameAPI(createParams);
      } catch (createErr) {
        if (createErr.response?.data?.existingGameId) {
          // The previous auto-ended game wasn't closed on the server yet.
          // Force-close it and retry creating a fresh game.
          const stuckId = createErr.response.data.existingGameId;
          try { await endGameAPI(stuckId, {}); } catch (_) { /* ignore */ }
          createRes = await createSharedGameAPI(createParams);
        } else {
          throw createErr;
        }
      }

      const createdGame = toCurrentGameModel(createRes);
      const newGameId = getEntityId(createdGame?.base) || getEntityId(createdGame);

      if (newGameId) {
        setCurrentGame(createdGame);
        if (onSetGameId) onSetGameId(newGameId);
        onTabChange("STATS");
      } else {
        Alert.alert("Error", "Could not create a new game");
      }
    } catch {
      Alert.alert("Error", "Failed to create new game");
    } finally {
      setStartingGame(false);
    }
  };

  const activePlayers = (players || []).filter(
    (p) => p.role === "player" || (!p.role && !p.isNonPlayer),
  );
  // Deduplicate by eventType+startDate before slicing — the schedules array may
  // contain both teams' copies of the same event when isSelfOwnedOpponent is set.
  const _upcomingRaw = (schedules || [])
    .filter((s) => new Date(s.date || s.startDate) > new Date())
    .sort((a, b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate));
  const _upcomingSeen = new Set();
  const upcomingSchedules = _upcomingRaw
    .filter((s) => {
      try {
        const key = `${s.eventType}_${new Date(s.startDate || s.date).toISOString()}`;
        if (_upcomingSeen.has(key)) return false;
        _upcomingSeen.add(key);
        return true;
      } catch { return true; }
    })
    .slice(0, 3);

  return (
    <ScrollView
      className="flex-1 px-4 pt-4"
      {...(isDark ? { style: { backgroundColor: T.bg } } : {})}
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
      {/* Opponent vs Section — leave branded black card alone (light + dark) */}
      <View className="bg-black relative rounded-2xl p-5 mb-4 shadow-2xl ">
        {opponent ? (
          <>
            {tournamentEntry?.tournament?._id ? (
              <View
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(186,240,114,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(186,240,114,0.35)",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Ionicons name="trophy" size={16} color="#BAF072" />
                  <Text style={{ color: "#BAF072", fontSize: 12, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                    {tournamentEntry.tournament.name}
                  </Text>
                  {tournamentIsLive ? (
                    <View style={{ backgroundColor: "#22C55E", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>LIVE</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: "#CBD5E1", fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                  {tournamentVsSameOpponent
                    ? "This opponent is also in your tournament. Friendly scoring stays here; tournament scoring is only by the tournament admin."
                    : "Your team is in a tournament. Open it to view fixtures — tournament matches are scored by the organizer."}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={openTournament}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: "#BAF072",
                    }}
                  >
                    <Text style={{ color: "#081126", fontWeight: "800", fontSize: 12 }}>Open tournament</Text>
                  </TouchableOpacity>
                  {tournamentFixture?.gameId ? (
                    <TouchableOpacity
                      onPress={watchTournamentLive}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.25)",
                      }}
                    >
                      <Text style={{ color: "#E5E7EB", fontWeight: "800", fontSize: 12 }}>
                        {tournamentIsLive ? "Watch tourney" : "Tourney score"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.08)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>
                FRIENDLY / TEAM MATCH
              </Text>
            </View>

            <View className="flex-row items-center justify-between mb-4 mx-4">
              <View className="items-center ">
                <ExpoImage
                  source={sizedRemoteSource(resolveLogoSource(team), 96, 96)}
                  style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#fff", padding: 8 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text
                  className="font-bold text-gray-100 mt-1 text-center"
                  numberOfLines={1}
                >
                  {team.teamName}
                </Text>
                {/* <Text className="text-gray-400 text-xs">
                  {activePlayers.length} players
                </Text> */}
              </View>
              <View className="items-center">
                <Text className="text-3xl font-black text-gray-400">VS</Text>
              </View>
              <View className="items-center ">
                <ExpoImage
                  source={sizedRemoteSource(resolveLogoSource(opponent), 96, 96)}
                  style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#fff", padding: 8 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text
                  className="font-bold text-gray-100 mt-1 text-center"
                  numberOfLines={1}
                >
                  {opponent.teamName}
                </Text>
                {/* <Text className="text-gray-400 text-xs">
                  {opponent.location || opponent.sport}
                </Text> */}
              </View>

              <View className="absolute h-25 w-25 -bottom-28  left-1/2 -translate-x-1/2 bg-black rounded-full px-3 py-1 shadow-lg" />
            </View>
            {isTableTennis && (
              <View
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.09)",
                }}
              >
                <Text className="text-gray-400 text-xs font-bold uppercase" style={{ letterSpacing: 1.2, marginBottom: 10 }}>
                  Match Format
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {TABLE_TENNIS_MATCH_FORMATS.map((option) => {
                    const selected = activeMatchFormat === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => canSelectMatchFormat && setSelectedMatchFormat(option.value)}
                        disabled={!canSelectMatchFormat}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: "center",
                          backgroundColor: selected ? "#9AEA62" : "rgba(255,255,255,0.06)",
                          borderWidth: 1,
                          borderColor: selected ? "#9AEA62" : "rgba(255,255,255,0.12)",
                          opacity: canSelectMatchFormat ? 1 : 0.75,
                        }}
                      >
                        <Text style={{ color: selected ? "#081126" : "#E5E7EB", fontSize: 12, fontWeight: "800" }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!canSelectMatchFormat && (
                  <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 10 }}>
                    This game is already created. Current format: {getTableTennisMatchFormatLabel(activeMatchFormat)}.
                  </Text>
                )}
              </View>
            )}
            {isHockey && (
              <View
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.09)",
                }}
              >
                <Text className="text-gray-400 text-xs font-bold uppercase" style={{ letterSpacing: 1.2, marginBottom: 10 }}>
                  Hockey Format
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                  {[
                    { key: "quarters", label: "4 Quarters" },
                    { key: "halves", label: "2 Halves" },
                  ].map((option) => {
                    const selected = activeHockeyFormat.structureType === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => canSelectHockeyFormat && setSelectedHockeyFormat((current) => ({
                          structureType: option.key,
                          periodCount: option.key === "halves" ? 2 : 4,
                          periodDurationMinutes: current.periodDurationMinutes || (option.key === "halves" ? 35 : 15),
                          label: option.label,
                        }))}
                        disabled={!canSelectHockeyFormat}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: "center",
                          backgroundColor: selected ? "#9AEA62" : "rgba(255,255,255,0.06)",
                          borderWidth: 1,
                          borderColor: selected ? "#9AEA62" : "rgba(255,255,255,0.12)",
                          opacity: canSelectHockeyFormat ? 1 : 0.75,
                        }}
                      >
                        <Text style={{ color: selected ? "#081126" : "#E5E7EB", fontSize: 12, fontWeight: "800" }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <View>
                    <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 }}>
                      Period Length
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 4 }}>
                      {activeHockeyFormat.periodDurationMinutes} min each
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => canSelectHockeyFormat && setSelectedHockeyFormat((current) => ({
                        ...current,
                        periodDurationMinutes: Math.max(5, (current.periodDurationMinutes || 15) - 5),
                      }))}
                      disabled={!canSelectHockeyFormat}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", opacity: canSelectHockeyFormat ? 1 : 0.5 }}
                    >
                      <Ionicons name="remove" size={18} color="#E5E7EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => canSelectHockeyFormat && setSelectedHockeyFormat((current) => ({
                        ...current,
                        periodDurationMinutes: Math.min(35, (current.periodDurationMinutes || 15) + 5),
                      }))}
                      disabled={!canSelectHockeyFormat}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", opacity: canSelectHockeyFormat ? 1 : 0.5 }}
                    >
                      <Ionicons name="add" size={18} color="#E5E7EB" />
                    </TouchableOpacity>
                  </View>
                </View>
                {!canSelectHockeyFormat && (
                  <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 10 }}>
                    This game is already created. Current format: {getHockeyMatchFormatLabel(activeHockeyFormat)}.
                  </Text>
                )}
              </View>
            )}
            {/* Game status — owner */}
            {/* Loading skeleton while fresh game data is being fetched */}
            {gameLoading && (
              <View
                className="py-3.5 rounded-xl items-center flex-row justify-center gap-2"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
              >
                <ActivityIndicator size="small" color="#9AEA62" />
                <Text className="text-gray-400 text-sm font-semibold">Loading game status…</Text>
              </View>
            )}
            {!gameLoading && isOwner && effectiveGameStatus === "live" && (
              <TouchableOpacity
                onPress={() => {
                  if (onSetGameId) onSetGameId(currentGame?.base?._id || currentGame?._id);
                  onTabChange("STATS");
                }}
                className="py-3.5 rounded-xl items-center flex-row justify-center gap-2"
                style={{ backgroundColor: "#EF4444" }}
              >
                {/* <View className="w-2.5 h-2.5 rounded-full bg-white" style={{ opacity: 0.85 }} /> */}
                <Text className="text-white font-bold text-base">
                  GAME STARTED
                </Text>
              </TouchableOpacity>
            )}
            {!gameLoading && isOwner && effectiveGameStatus === "finished" && (
              <View>
                <View className="flex-row items-center justify-center gap-2 mb-2.5">
                  <Ionicons
                    name="stop-circle-outline"
                    size={16}
                    color="#A855F7"
                  />
                  <Text className="text-purple-500 font-bold text-sm">
                    GAME OVER
                  </Text>
                  {/* {finalScore && (
                    <Text style={{ color: "#fff" }} className="font-bold text-sm">
                      {userScore} – {opponentScore}
                    </Text>
                  )} */}
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      if (onSetGameId) onSetGameId(currentGame?.base?._id || currentGame?._id);
                      onTabChange("STATS");
                    }}
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{
                      backgroundColor: "rgba(168,85,247,0.12)",
                      borderWidth: 1,
                      borderColor: "rgba(168,85,247,0.4)",
                    }}
                  >
                    <Text className="text-purple-500 font-bold text-sm">
                      View
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNewGame}
                    disabled={startingGame}
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{
                      backgroundColor: "#9AEA62",
                      opacity: startingGame ? 0.6 : 1,
                    }}
                  >
                    {startingGame ? (
                      <ActivityIndicator size="small" color="#081126" />
                    ) : (
                      <Text className="text-[#081126] font-bold text-sm">
                        New Game
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!gameLoading && isOwner && (effectiveGameStatus === "scheduled" || effectiveGameStatus === null) && (
              <TouchableOpacity
                onPress={handleStartGame}
                disabled={startingGame}
                className="bg-[#081126] py-3.5 rounded-xl items-center flex-row justify-center gap-2"
                style={{ opacity: startingGame ? 0.6 : 1 }}
              >
                {startingGame ? (
                  <ActivityIndicator size="small" color="#9AEA62" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#9AEA62" />
                    <Text className="text-[#9AEA62] font-bold text-base">
                      Start Game
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {/* Game status — non-owner */}
            {!gameLoading && !isOwner && effectiveGameStatus === "live" && (
              <TouchableOpacity
                onPress={() => {
                  if (onSetGameId) onSetGameId(currentGame?.base?._id || currentGame?._id);
                  onTabChange("STATS");
                }}
                className="py-3.5 rounded-xl items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: "rgba(239,68,68,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(239,68,68,0.35)",
                }}
              >
                <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <Text className="text-red-500 font-bold text-sm">
                  GAME STARTED — TAP TO JOIN
                </Text>
              </TouchableOpacity>
            )}
            {!gameLoading && !isOwner && effectiveGameStatus === "finished" && (
              <View>
                <View className="flex-row items-center justify-center gap-2 mb-2.5">
                  <Ionicons
                    name="stop-circle-outline"
                    size={16}
                    color="#A855F7"
                  />
                  <Text className="text-purple-500 font-bold text-sm">
                    GAME OVER
                  </Text>
                  {finalScore && (
                    <Text style={{ color: "#fff" }} className="font-bold text-sm">
                      {userScore} – {opponentScore}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (onSetGameId) onSetGameId(currentGame?.base?._id || currentGame?._id);
                    onTabChange("STATS");
                  }}
                  className="py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: "rgba(168,85,247,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(168,85,247,0.4)",
                  }}
                >
                  <Text className="text-purple-500 font-bold text-sm">
                    View Game
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!gameLoading && !isOwner &&
              (effectiveGameStatus === "scheduled" || effectiveGameStatus === null) && (
                <View
                  className="py-3.5 rounded-xl items-center"
                  style={{ backgroundColor: "#F3F4F6" }}
                >
                  <Text className="text-gray-500 font-semibold text-sm">
                    Waiting for owner to start
                  </Text>
                </View>
              )}
          </>
        ) : opponentLoading || tournamentLoading ? (
          /* Centered spinner while opponent / tournament loads */
          <View style={{ height: 140, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <ActivityIndicator size="large" color="#9AEA62" />
            <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600" }}>Loading…</Text>
          </View>
        ) : tournamentFixture && tournamentOpponent?.name ? (
          <>
            <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(186,240,114,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 }}>
              <Text style={{ color: "#BAF072", fontSize: 11, fontWeight: "800" }}>
                {tournamentEntry?.tournament?.name || "Tournament"}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-4 mx-4">
              <View className="items-center flex-1">
                <ExpoImage
                  source={sizedRemoteSource(resolveLogoSource(team, tournamentOurLogo), 96, 96)}
                  style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#fff", padding: 8 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text className="font-bold text-gray-100 mt-1 text-center" numberOfLines={2}>
                  {team.teamName}
                </Text>
              </View>
              <View className="items-center px-3">
                <Text className="text-3xl font-black text-gray-400">VS</Text>
                {tournamentFixture.label ? (
                  <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 4, textAlign: "center" }}>
                    {tournamentFixture.label}
                  </Text>
                ) : null}
              </View>
              <View className="items-center flex-1">
                <ExpoImage
                  source={sizedRemoteSource(
                    resolveLogoSource(opponent, tournamentOpponent?.logo),
                    96,
                    96,
                  )}
                  style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#fff", padding: 8 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text className="font-bold text-gray-100 mt-1 text-center" numberOfLines={2}>
                  {tournamentOpponent.name}
                </Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {tournamentFixture.gameId ? (
                <TouchableOpacity
                  onPress={watchTournamentLive}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: tournamentIsLive ? "#9AEA62" : "#9AEA62",
                  }}
                >
                  <Text style={{ color: "#081126", fontWeight: "800", fontSize: 14 }}>
                    {tournamentIsLive ? "Watch live" : "View live scores"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: "#F3F4F6" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "600", fontSize: 13 }}>
                    Match not started yet
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={openTournament}
                style={{ paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "700", fontSize: 13 }}>View tournament</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="items-center py-4">
            <ExpoImage
              source={TEAM_EMPTY_ICONS.opponent}
              style={TEAM_EMPTY_ICON_STYLE}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
            <Text className="text-gray-400 mt-2 font-medium">
              No opponent selected
            </Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => onTabChange("OPPONENTS")}
                className="mt-3 bg-[#081126] px-5 py-2.5 rounded-xl"
              >
                <Text className="text-[#9AEA62] font-bold text-sm">
                  Add Opponent
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {teamTournaments.length > 0 ? (
        <View
          className="rounded-3xl p-5 mb-4 border border-white/20"
          style={{
            backgroundColor: isDark ? T.surface : "#f2f4f5",
            shadowColor: "#0B1324",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <TeamTournamentsStrip teamId={teamId} tournaments={teamTournaments} isDark={isDark} />
        </View>
      ) : null}

      {/* Upcoming Events */}
      <View
        className="mt-10 rounded-3xl p-5 mb-4"
        style={{
          backgroundColor: isDark ? T.surface : "#f2f4f5",
          borderWidth: 1,
          borderColor: isDark ? T.border : "rgba(255,255,255,0.2)",
          shadowColor: "#0B1324",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-lg font-black" style={{ color: isDark ? T.text : "#081126" }}>
              Upcoming Events
            </Text>
            <Text className="text-[11px] mt-0.5" style={{ color: isDark ? T.textMuted : "#5F6B7B" }}>
              Next {upcomingSchedules.length} scheduled
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onTabChange("SCHEDULE")}
            className="px-3 py-1.5 rounded-sm"
            style={{
              backgroundColor: "#060c1b",
              shadowColor: "#081126",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-[#9AEA62] font-bold text-xs">View All</Text>
          </TouchableOpacity>
        </View>

        {upcomingSchedules.length === 0 ? (
          <View
            className="items-center py-8 rounded-2xl"
            style={{
              backgroundColor: isDark ? T.surfaceAlt : "rgba(255,255,255,0.7)",
              borderWidth: 1,
              borderColor: isDark ? T.borderSubtle : "rgba(148,163,184,0.2)",
            }}
          >
            <ExpoImage
              source={TEAM_EMPTY_ICONS.events}
              style={TEAM_EMPTY_ICON_STYLE}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
            <Text className="font-semibold" style={{ color: isDark ? T.textDim : "#64748B" }}>No upcoming events</Text>
          </View>
        ) : (
          upcomingSchedules.map((ev, idx) => {
            const etConfig = {
              game:     { bg: "#DCFCE7", color: "#166534" },
              practice: { bg: "#DBEAFE", color: "#1E40AF" },
              other:    { bg: "#FEF3C7", color: "#92400E" },
            };
            const et = etConfig[ev.eventType] || etConfig.other;
            return (
              <View
              className="relative"
                key={ev._id || idx}
                style={{
                  backgroundColor: isDark ? T.surface : "#FFFFFF",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? T.border : "rgba(148,163,184,0.16)",
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                  marginBottom: idx === upcomingSchedules.length - 1 ? 0 : 10,
                  overflow: "hidden",
                }}
              >
                {/* Accent strip */}

                <View className="relative" style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                {/* <View className="rounded-tl-full rounded-bl-full absolute right-0 h-full w-30 " style={{  backgroundColor: et.color }} /> */}
                  {/* Row 1 — icon + title + type pill */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <EventIcon type={ev.eventType} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontWeight: "700", color: isDark ? T.text : "#0F172A", fontSize: 14 }}
                        numberOfLines={1}
                      >
                        {ev.title
                          ? ev.title.charAt(0).toUpperCase() + ev.title.slice(1)
                          : (ev.eventType || "Event").charAt(0).toUpperCase() + (ev.eventType || "Event").slice(1)}
                      </Text>
                      <Text style={{ color: isDark ? T.textDim : "#64748B", fontSize: 11, marginTop: 2 }}>
                        {formatDate(ev.date || ev.startDate)}
                        {ev.time ? `  •  ${ev.time}` : ""}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: et.bg,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: et.color, textTransform: "capitalize" }}>
                        {ev.eventType || "event"}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2 — location (own row, full width, truncates cleanly) */}
                  {ev.location ? (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={isDark ? T.textMuted : "#94A3B8"} />
                      <Text
                        style={{ fontSize: 11, color: isDark ? T.textDim : "#64748B", flex: 1 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {ev.location}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Players Preview — own team + opponent */}
      {/* <View className="bg-white  rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-gray-900">
            Players ({activePlayers.length + opponentPlayers.filter((p) => p.role === "player" || !p.role).length})
          </Text>
          <TouchableOpacity onPress={() => onTabChange("TEAM")}>
            <Text className="text-[#42612b] font-semibold text-sm">View All</Text>
          </TouchableOpacity>
        </View>

        {activePlayers.length === 0 && opponentPlayers.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="person-add-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-2">No players added yet</Text>
          </View>
        ) : (
          <>
          
            {activePlayers.length > 0 && (
              <View className="mb-3">
                <View className="flex-row items-center gap-2 mb-2">

                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 0.5 }} numberOfLines={1}>
                    {team.teamName?.toUpperCase()}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  {activePlayers.slice(0, 6).map((p) => (
                    <View key={p._id || p.id} className="items-center w-14">
                      <PlayerAvatar player={p} size={44} />
                      <Text className="text-xs text-gray-600 mt-1 text-center" numberOfLines={1}>
                        {p.firstName}
                      </Text>
                    </View>
                  ))}
                  {activePlayers.length > 6 && (
                    <View className="items-center w-14 justify-center">
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontWeight: "700", color: "#64748B", fontSize: 12 }}>+{activePlayers.length - 6}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

        
            {opponentPlayers.filter((p) => p.role === "player" || !p.role).length > 0 && opponent && (
              <>
                <View style={{ height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 }} />
                <View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 0.5 }} numberOfLines={1}>
                      {opponent.teamName?.toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-3">
                    {opponentPlayers.filter((p) => p.role === "player" || !p.role).slice(0, 6).map((p) => (
                      <View key={p._id || p.id} className="items-center w-14">
                        <PlayerAvatar player={p} size={44} />
                        <Text className="text-xs text-gray-600 mt-1 text-center" numberOfLines={1}>
                          {p.firstName}
                        </Text>
                      </View>
                    ))}
                    {opponentPlayers.filter((p) => p.role === "player" || !p.role).length > 6 && (
                      <View className="items-center w-14 justify-center">
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontWeight: "700", color: "#EF4444", fontSize: 12 }}>+{opponentPlayers.filter((p) => p.role === "player" || !p.role).length - 6}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </View> */}

      {/* Team Overview — original light markup; dark overrides only when isDark */}
      <View
        className={
          isDark
            ? "relative rounded-3xl p-6 mb-6 shadow-2xl"
            : "relative bg-gray-100 rounded-3xl p-6 mb-6  shadow-2xl border border-white/10"
        }
        style={
          isDark
            ? {
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: T.border,
              }
            : {
                boxShadow:
                  "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                transform: "translateY(-2px)",
              }
        }
      >
        <View className="mb-5">
          <Text
            className="text-xs font-bold text-gray-800 uppercase tracking-wider"
            style={isDark ? { color: T.text } : undefined}
          >
            Team Overview
          </Text>
        </View>

        {/* 3D Stats Cards Row */}
        <View className="flex-row gap-3 mb-5">
          <View
            className={
              isDark
                ? "flex-1 rounded-2xl p-3"
                : "flex-1 bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/20"
            }
            style={
              isDark
                ? {
                    backgroundColor: T.surfaceAlt,
                    borderWidth: 1,
                    borderColor: T.borderSubtle,
                  }
                : {
                    boxShadow:
                      "0 8px 20px -6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }
            }
          >
            <Text
              className="text-2xl font-black text-gray-600"
              style={isDark ? { color: T.text } : undefined}
            >
              {team.sport}
            </Text>
            <Text
              className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wide"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              Sport
            </Text>
          </View>

          <View
            className={
              isDark
                ? "flex-1 rounded-2xl p-3"
                : "flex-1 bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/20"
            }
            style={
              isDark
                ? {
                    backgroundColor: T.surfaceAlt,
                    borderWidth: 1,
                    borderColor: T.borderSubtle,
                  }
                : {
                    boxShadow:
                      "0 8px 20px -6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }
            }
          >
            <Text
              className="text-2xl font-black text-gray-600"
              style={isDark ? { color: T.text } : undefined}
            >
              {team.teamType}
            </Text>
            <Text
              className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wide"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              Type
            </Text>
          </View>
        </View>

        {/* Info Grid with Icons */}
        <View className="space-y-2">
          <View
            className={
              isDark
                ? "flex-row items-center justify-between rounded-xl p-3"
                : "flex-row items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10"
            }
            style={
              isDark
                ? { backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.borderSubtle }
                : undefined
            }
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-indigo-500/20 items-center justify-center">
                <Ionicons name="calendar" size={18} color="#3748e8" />
              </View>
              <Text
                className="text-sm font-semibold text-gray-500"
                style={isDark ? { color: T.textDim } : undefined}
              >
                Season
              </Text>
            </View>
            <Text
              className="text-sm font-bold text-gray-900"
              style={isDark ? { color: T.text } : undefined}
            >
              {team.season}
            </Text>
          </View>

          <View
            className={
              isDark
                ? "flex-row items-center justify-between rounded-xl p-3"
                : "flex-row items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10"
            }
            style={
              isDark
                ? { backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.borderSubtle }
                : undefined
            }
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-pink-500/20 items-center justify-center">
                <Ionicons name="people" size={18} color="#e84398" />
              </View>
              <Text
                className="text-sm font-semibold text-gray-500"
                style={isDark ? { color: T.textDim } : undefined}
              >
                Age Group
              </Text>
            </View>
            <Text
              className="text-sm font-bold text-gray-900"
              style={isDark ? { color: T.text } : undefined}
            >
              {team.ageGroup}
            </Text>
          </View>

          <View
            className={
              isDark
                ? "flex-row items-center justify-between rounded-xl p-3"
                : "flex-row items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10"
            }
            style={
              isDark
                ? { backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.borderSubtle }
                : undefined
            }
          >
            <View className="flex-row items-center gap-3" style={{ flexShrink: 0 }}>
              <View className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center">
                <Ionicons name="location" size={18} color="#0eec93" />
              </View>
              <Text
                className="text-sm font-semibold text-gray-500"
                style={isDark ? { color: T.textDim } : undefined}
              >
                Location
              </Text>
            </View>
            <Text
              className="text-sm font-bold text-gray-900"
              style={{
                ...(isDark ? { color: T.text } : {}),
                flex: 1,
                flexShrink: 1,
                textAlign: "right",
                marginLeft: 8,
              }}
            >
              {team.location}
            </Text>
          </View>
        </View>
      </View>



 

      <View className="h-24" />
    </ScrollView>
  );
}

// =============================================
// TEAM TAB - Add/Edit/Delete Players (with dual-roster for self-owned opponents)
// =============================================
