import { useState, useEffect, useRef, useCallback } from "react";
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { io } from "socket.io-client";
import { createTeamAPI, getTeamByIdAPI, getTeamsAPI, addOpponentsAPI, deleteOpponentAPI, getOpponentsAPI } from "@/services/TeamApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { findSharedGameAPI, getGameByIdAPI } from "@/services/GameApi";
import { CREATE_TEAM_SPORT_ICONS as sportIcons } from "@/constants/sports";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { sportsMatch } from "@/lib/sportMatch";
import { quickCreateLogos, logoUrlMap, Badge } from "./helpers";
import CricketHeadToHead from "@/components/game/CricketHeadToHead";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const defaultIcon = sportIcons.Football;

// ── Overlapping player avatars (same style as frontend) ────────────────────────
const AVATAR_COLORS = ["#3B82F6","#22C55E","#EAB308","#EF4444","#A855F7","#EC4899","#6366F1","#14B8A6"];
function MiniAvatar({ player, index, ringColor = "#fff" }) {
  const name = `${player.firstName || ""}${player.lastName || ""}`;
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  if (player.playerimage)
    return (
      <ExpoImage
        source={{ uri: player.playerimage, width: 26, height: 26 }}
        style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: ringColor, marginLeft: index === 0 ? 0 : -8 }}
        contentFit="cover"
        cachePolicy="memory-disk"
        decodeFormat="rgb"
      />
    );
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length], alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ringColor, marginLeft: index === 0 ? 0 : -8 }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{letter}</Text>
    </View>
  );
}
function TeamMembersAvatars({ players = [], maxDisplay = 5, isDark = false }) {
  const safe = Array.isArray(players) ? players : [];
  if (safe.length === 0) {
    return (
      <Text style={{ color: isDark ? "#71717A" : "#9CA3AF", fontSize: 10, fontStyle: "italic" }}>
        No players
      </Text>
    );
  }
  const shown = safe.slice(0, maxDisplay);
  const remaining = safe.length - maxDisplay;
  const ring = isDark ? "#16161A" : "#fff";
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((p, i) => (
        <MiniAvatar key={p._id || i} player={p} index={i} ringColor={ring} />
      ))}
      {remaining > 0 && (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#6B7280", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ring, marginLeft: -8 }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

export default function OpponentsTab({ team, teamId, onRefresh, refreshing, pullRefresh, onOpponentAdded }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasLiveGame, setHasLiveGame] = useState(false);

  const triggerConfettiAndRedirect = () => {
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      onOpponentAdded?.();
    }, 2200);
  };

  const alertGameLive = () =>
    Alert.alert(
      "Game in Progress",
      "You cannot change the opponent while a game is in progress.",
      [{ text: "OK" }]
    );

  const OPAGE_LIMIT = 10;
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [storedOpponents, setStoredOpponents] = useState([]);
  const [oppPage, setOppPage] = useState(1);
  const [oppHasNext, setOppHasNext] = useState(false);
  const [oppTotal, setOppTotal] = useState(0);
  const [loadingMoreOpps, setLoadingMoreOpps] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [showMyTeams, setShowMyTeams] = useState(false);
  const myTeamsSheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const renderSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );
  const [newName, setNewName] = useState("");
  const [selectedLogoId, setSelectedLogoId] = useState(1);
  const [customLogoAsset, setCustomLogoAsset] = useState(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const searchTimerRef = useRef(null);
  const [opponentPlayersMap, setOpponentPlayersMap] = useState({});
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [addedOpponentIds, setAddedOpponentIds] = useState(() => new Set());

  useEffect(() => {
    loadData();
  }, []);

  // Check live game status via findSharedGameAPI (same as HomeTab)
  const checkLiveGame = async (opponentId) => {
    if (!opponentId) { setHasLiveGame(false); return; }
    try {
      const findRes = await findSharedGameAPI(teamId, opponentId, team?.sport || "Football");
      const gameId = findRes?.data?.base?._id || findRes?.data?._id;
      if (!gameId) { setHasLiveGame(false); return; }
      const gameRes = await getGameByIdAPI(gameId);
      const gameData = gameRes?.data || gameRes;
      const status = gameData?.base?.status || gameData?.status || null;
      setHasLiveGame(status === "live");
    } catch {
      setHasLiveGame(false);
    }
  };

  // Fetch one page of opponents from backend
  const teamSport = team?.sport || "";

  const fetchOpponentsPage = async (pageNum, searchStr, append = false, seasonStr, locationStr) => {
    try {
      const params = { currentTeamId: teamId, page: pageNum, limit: OPAGE_LIMIT };
      if (teamSport) params.sport = teamSport;
      if (searchStr && searchStr.trim()) params.search = searchStr.trim();
      if (seasonStr && seasonStr.trim()) params.season = seasonStr.trim();
      if (locationStr && locationStr.trim()) params.city = locationStr.trim();
      const stRes = await getOpponentsAPI(params);
      let list = stRes.data || stRes.opponents || stRes.teams || [];
      // Client-side sport filter (safety net when API build lacks sport query support)
      if (teamSport && Array.isArray(list)) {
        list = list.filter((t) => sportsMatch(t?.sport, teamSport));
      }
      const pagination = stRes.pagination || {};
      setOppHasNext(pagination.hasNextPage || false);
      setOppTotal(pagination.total ?? list.length);
      setOppPage(pageNum);
      setStoredOpponents((prev) => append ? [...prev, ...list] : (Array.isArray(list) ? list : []));
    } catch {
      if (!append) setStoredOpponents([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const teamRes = await getTeamByIdAPI(teamId);
      const td = teamRes.data || teamRes.team || teamRes;
      const opps = td.opponents || [];
      setAddedOpponentIds(
        new Set(
          opps
            .map((o) => o.opponentTeamId?._id || o.opponentTeamId)
            .filter(Boolean)
            .map((id) => String(id)),
        ),
      );

      if (opps.length > 0 && opps[0].opponentTeamId) {
        try {
          const oppId = opps[0].opponentTeamId?._id || opps[0].opponentTeamId;
          const oppRes = await getTeamByIdAPI(oppId);
          const opp = oppRes.data || oppRes.team || oppRes;
          setCurrentOpponent(opp);
          checkLiveGame(oppId);
        } catch {
          setCurrentOpponent(null);
          setHasLiveGame(false);
        }
      } else {
        setCurrentOpponent(null);
        setHasLiveGame(false);
      }

      await fetchOpponentsPage(1, search, false, filterSeason, filterLocation);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Debounced backend search (name / season / location all share same timer)
  const triggerSearch = (q, season, location) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchOpponentsPage(1, q, false, season, location);
    }, 400);
  };

  const searchOpponents = (q) => {
    setSearch(q);
    triggerSearch(q, filterSeason, filterLocation);
  };

  const searchBySeason = (s) => {
    setFilterSeason(s);
    triggerSearch(search, s, filterLocation);
  };

  const searchByLocation = (l) => {
    setFilterLocation(l);
    triggerSearch(search, filterSeason, l);
  };

  // Load next page of opponents
  const loadMoreOpponents = async () => {
    if (loadingMoreOpps || !oppHasNext) return;
    setLoadingMoreOpps(true);
    await fetchOpponentsPage(oppPage + 1, search, true, filterSeason, filterLocation);
    setLoadingMoreOpps(false);
  };

  // Fetch players for each opponent in the list (lazy, cached per id)
  useEffect(() => {
    if (storedOpponents.length === 0) return;
    const fetch = async () => {
      for (const opp of storedOpponents) {
        if (opponentPlayersMap[opp._id] !== undefined) continue;
        try {
          const res = await getPlayersByTeamAPI(opp._id);
          const list = res.data?.players || res.data || res.players || [];
          setOpponentPlayersMap((prev) => ({ ...prev, [opp._id]: Array.isArray(list) ? list : [] }));
        } catch {
          setOpponentPlayersMap((prev) => ({ ...prev, [opp._id]: [] }));
        }
      }
    };
    fetch();
  }, [storedOpponents]);

  const addOpponent = async (oppId) => {
    if (hasLiveGame) { alertGameLive(); return; }
    setAdding(oppId);
    try {
      await addOpponentsAPI(teamId, oppId);
      loadData();
      onRefresh();
      triggerConfettiAndRedirect();
    } catch (err) {
      Alert.alert("Couldn't add opponent", err.response?.data?.message || "Please try again.");
    } finally {
      setAdding(null);
    }
  };

  const removeOpponent = async () => {
    if (hasLiveGame) { alertGameLive(); return; }
    if (!currentOpponent) return;
    setRemoving(true);
    try {
      await deleteOpponentAPI(teamId, currentOpponent._id);
      setCurrentOpponent(null);
      loadData();
      onRefresh();
    } catch (err) {
      Alert.alert("Couldn't remove opponent", err.response?.data?.message || "Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  const loadMyTeams = async () => {
    if (hasLiveGame) { alertGameLive(); return; }
    try {
      const res = await getTeamsAPI();
      const all = res.data || res.teams || [];
      setMyTeams(
        all.filter(
          (t) => t._id !== teamId && (!teamSport || sportsMatch(t.sport, teamSport)),
        ),
      );
      setShowMyTeams(true);
      myTeamsSheetRef.current?.expand();
    } catch {
      Alert.alert("Couldn't load your teams", "Please check your connection and try again.");
    }
  };

  const addFromMyTeams = async (oppTeam) => {
    if (hasLiveGame) { alertGameLive(); return; }
    try {
      await addOpponentsAPI(teamId, oppTeam._id);
      myTeamsSheetRef.current?.close();
      setShowMyTeams(false);
      loadData();
      onRefresh();
      triggerConfettiAndRedirect();
    } catch (err) {
      Alert.alert(
        "Error",
        err.response?.data?.message || "Failed to add opponent",
      );
    }
  };

  const goToStep2 = () => {
    if (!newName.trim()) {
      return Alert.alert("Team name required", "Please enter a team name to continue.");
    }
    if (newName.trim().length < 3) {
      return Alert.alert("Team name too short", "Please use at least 3 characters for the team name.");
    }
    setCreateStep(2);
  };

  const resetCreateModal = () => {
    setShowCreate(false);
    setNewName("");
    setSelectedLogoId(1);
    setCustomLogoAsset(null);
    setCreateStep(1);
  };

  const openCreateSheet = () => {
    setShowCreate(true);
    setCreateStep(1);
  };

  const pickOpponentLogo = async () => {
    const allowed = await ensurePhotoLibraryAccess();
    if (!allowed) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;
    setCustomLogoAsset(result.assets[0]);
  };

  const quickCreate = async () => {
    if (hasLiveGame) { alertGameLive(); return; }
    setCreating(true);
    try {
      const payload = customLogoAsset
        ? (() => {
            const formData = new FormData();
            formData.append("teamName", newName.trim());
            formData.append("sport", team.sport || "Football");
            formData.append("teamType", team.teamType || "Local League");
            formData.append("ageGroup", team.ageGroup || "Open");
            if (team.location) formData.append("location", team.location);
            if (team.season) formData.append("season", team.season);
            formData.append("teamlogoFile", {
              uri: customLogoAsset.uri,
              type: customLogoAsset.mimeType || "image/jpeg",
              name: customLogoAsset.fileName || `opponent-logo-${Date.now()}.jpg`,
            });
            return formData;
          })()
        : {
            teamName: newName.trim(),
            teamlogo: logoUrlMap[selectedLogoId] || "/team-logos/boxer.webp",
            sport: team.sport || "Football",
            teamType: team.teamType || "Local League",
            ageGroup: team.ageGroup || "Open",
            ...(team.location ? { location: team.location } : {}),
            ...(team.season ? { season: team.season } : {}),
          };

      const res = await createTeamAPI(payload);
      const newTeam = res.data || res.team || res;
      const newTeamId = newTeam._id || newTeam.id;
      await addOpponentsAPI(teamId, newTeamId);
      resetCreateModal();
      loadData();
      onRefresh();
      triggerConfettiAndRedirect();
    } catch (err) {
      Alert.alert("Couldn't create opponent", err.response?.data?.message || "Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const isAddedOpponent = (oppId) => {
    if (!oppId) return false;
    return addedOpponentIds.has(String(oppId));
  };

  if (loading)
    return (
      <View
        className="flex-1 items-center justify-center"
        {...(isDark ? { style: { backgroundColor: T.bg } } : {})}
      >
        <ActivityIndicator size="large" color={isDark ? T.refresh : "#081126"} />
      </View>
    );

  return (
    <View className="flex-1" {...(isDark ? { style: { backgroundColor: T.bg } } : {})}>
 
      {/* Header buttons */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View>
          <Text
            className="text-lg  font-bold text-gray-900"
            style={isDark ? { color: T.text } : undefined}
          >
            Opponents
          </Text>
          {!!teamSport && (
            <Text
              className="text-gray-500 text-xs mt-0.5"
              style={isDark ? { color: T.textDim } : undefined}
            >
              Showing {teamSport} teams only
            </Text>
          )}
          {hasLiveGame && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" }} />
              <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "600" }}>Game in progress</Text>
            </View>
          )}
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={loadMyTeams}
            className={isDark ? "px-3 py-3 rounded-sm" : "bg-gray-300 px-3 py-3 rounded-sm"}
            style={{
              opacity: hasLiveGame ? 0.5 : 1,
              ...(isDark
                ? { backgroundColor: "#1E1E24", borderWidth: 1, borderColor: "#2A2A2E" }
                : {}),
            }}
          >
            <Text
              className="text-gray-700 font-semibold text-xs"
              style={isDark ? { color: T.text } : undefined}
            >
              My Teams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => hasLiveGame ? alertGameLive() : openCreateSheet()}
            className={isDark ? "px-3 py-3 rounded-sm" : "bg-[#081126] px-3 py-3 rounded-sm"}
            style={{
              opacity: hasLiveGame ? 0.5 : 1,
              ...(isDark
                ? { backgroundColor: "#1E1E24", borderWidth: 1, borderColor: "#2A2A2E" }
                : {}),
            }}
          >
            <Text
              className={isDark ? "font-bold text-xs" : "text-[#9AEA62] font-bold text-xs"}
              style={isDark ? { color: "#F5F5F7" } : undefined}
            >
              + Create opponent
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={pullRefresh}
            colors={[isDark ? T.refresh : "#081126"]}
            tintColor={isDark ? T.refresh : "#081126"}
          />
        }
      >
        {/* Current Opponent Section */}
        <View className="mb-4">
          <Text
            className="text-gray-500 text-xs font-bold mb-2"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            CURRENT OPPONENT
          </Text>
          {currentOpponent ? (
            <View className="bg-black   rounded-xl p-4 shadow-2xl">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-black items-center justify-center overflow-hidden">
                  <Image
                    source={sportIcons[currentOpponent.sport] || defaultIcon}
                    className="w-10 h-10"
                    resizeMode="contain"
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-bold text-gray-100 text-base">
                    {currentOpponent.teamName}
                  </Text>
                  <Text className="text-gray-200 text-sm">
                    {currentOpponent.sport}{" "}
                    {currentOpponent.location
                      ? `\u2022 ${currentOpponent.location}`
                      : ""}
                  </Text>
                  {currentOpponent.season && (
                    <Text className="text-gray-300 text-xs mt-0.5">
                      {currentOpponent.season}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={removeOpponent}
                  disabled={removing}
                  className="bg-red-500/80 px-3 py-2 rounded-sm"
                >
                  {removing ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text className="text-white font-bold text-xs">
                      Remove
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View
              className={
                isDark
                  ? "rounded-xl p-6 items-center"
                  : "bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 items-center"
              }
              style={
                isDark
                  ? {
                      backgroundColor: T.surface,
                      borderWidth: 1,
                      borderColor: T.border,
                      borderStyle: "dashed",
                    }
                  : undefined
              }
            >
              <ExpoImage
                source={TEAM_EMPTY_ICONS.opponent}
                style={TEAM_EMPTY_ICON_STYLE}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
              <Text
                className="text-gray-400 text-sm"
                style={isDark ? { color: T.textMuted } : undefined}
              >
                No opponent selected
              </Text>
              <Text
                className="text-gray-300 text-xs mt-1"
                style={isDark ? { color: T.textMuted } : undefined}
              >
                Create or add one below
              </Text>
            </View>
          )}
        </View>

        {/* Head-to-head (Cricket) */}
        {currentOpponent &&
          String(team?.sport || "").toLowerCase() === "cricket" && (
            <CricketHeadToHead
              teamId={teamId}
              opponentTeamId={currentOpponent._id}
              sport="Cricket"
              opponentName={currentOpponent.teamName}
              isDark={isDark}
            />
          )}

        {/* Search */}
        <View className="mb-2">
          <View
            className={
              isDark
                ? "flex-row items-center rounded-xl px-3 py-2.5"
                : "flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-gray-200 shadow-2xl"
            }
            style={
              isDark
                ? {
                    backgroundColor: T.surface,
                    borderWidth: 1,
                    borderColor: T.border,
                  }
                : undefined
            }
          >
            <Ionicons name="search" size={18} color={isDark ? T.textMuted : "#9CA3AF"} />
            <TextInput
              value={search}
              onChangeText={searchOpponents}
              placeholder="Search opponents..."
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
              className={isDark ? "flex-1 ml-2" : "flex-1 ml-2 text-gray-800"}
              style={isDark ? { color: T.text } : undefined}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => searchOpponents("")}>
                <Ionicons name="close-circle" size={18} color={isDark ? T.textMuted : "#9CA3AF"} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter by season & place */}
        <View className="flex-row gap-2 mb-3">
          <View
            className={
              isDark
                ? "flex-1 flex-row items-center rounded-xl px-3 py-2"
                : "flex-1 flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200"
            }
            style={
              isDark
                ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
                : undefined
            }
          >
            <Ionicons name="calendar-outline" size={15} color={isDark ? T.textMuted : "#9CA3AF"} />
            <TextInput
              value={filterSeason}
              onChangeText={searchBySeason}
              placeholder="Season..."
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
              style={{ flex: 1, marginLeft: 6, fontSize: 13, color: isDark ? T.text : "#1F2937" }}
            />
            {filterSeason.length > 0 && (
              <TouchableOpacity onPress={() => searchBySeason("")}>
                <Ionicons name="close-circle" size={15} color={isDark ? T.textMuted : "#9CA3AF"} />
              </TouchableOpacity>
            )}
          </View>
          <View
            className={
              isDark
                ? "flex-1 flex-row items-center rounded-xl px-3 py-2"
                : "flex-1 flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200"
            }
            style={
              isDark
                ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
                : undefined
            }
          >
            <Ionicons name="location-outline" size={15} color={isDark ? T.textMuted : "#9CA3AF"} />
            <TextInput
              value={filterLocation}
              onChangeText={searchByLocation}
              placeholder="Place..."
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
              style={{ flex: 1, marginLeft: 6, fontSize: 13, color: isDark ? T.text : "#1F2937" }}
            />
            {filterLocation.length > 0 && (
              <TouchableOpacity onPress={() => searchByLocation("")}>
                <Ionicons name="close-circle" size={15} color={isDark ? T.textMuted : "#9CA3AF"} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stored Opponents List */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text
            className="text-gray-500 text-xs font-bold"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            ALL OPPONENTS ({storedOpponents.length}{oppTotal > storedOpponents.length ? ` of ${oppTotal}` : ""})
          </Text>
          {search.length > 0 && (
            <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 11 }}>searching "{search}"</Text>
          )}
        </View>
        {storedOpponents.length === 0 ? (
          <View className="items-center py-8">
            <ExpoImage
              source={TEAM_EMPTY_ICONS.opponent}
              style={TEAM_EMPTY_ICON_STYLE}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
            <Text
              className="text-gray-400"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              {search || filterSeason || filterLocation ? `No opponents found` : "No opponents found"}
            </Text>
          </View>
        ) : (
          [...storedOpponents]
            .sort((a, b) => {
              if (isAddedOpponent(a._id)) return -1;
              if (isAddedOpponent(b._id)) return 1;
              return 0;
            })
            .map((opp) => {
            const added = isAddedOpponent(opp._id);
            const oppPlayers = opponentPlayersMap[opp._id];
            return (
              <View
                key={opp._id}
                className={`rounded-xl p-4 mb-3 ${
                  added
                    ? "bg-[#2AC9E7]"
                    : isDark
                      ? ""
                      : "bg-white shadow-2xl"
                }`}
                style={
                  !added && isDark
                    ? {
                        backgroundColor: T.surface,
                        borderWidth: 1,
                        borderColor: T.border,
                      }
                    : added && isDark
                      ? {
                          backgroundColor: "rgba(42,201,231,0.22)",
                          borderWidth: 1,
                          borderColor: "rgba(42,201,231,0.4)",
                        }
                      : undefined
                }
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 rounded-full bg-black items-center justify-center overflow-hidden">
                    <Image
                      source={sportIcons[opp.sport] || defaultIcon}
                      className="w-9 h-9"
                      resizeMode="contain"
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="font-bold text-gray-900"
                      style={isDark && !added ? { color: T.text } : isDark && added ? { color: "#F5F5F7" } : undefined}
                    >
                      {opp.teamName}
                    </Text>
                    <Text
                      className="text-gray-500 text-xs"
                      style={isDark ? { color: added ? "#CBD5E1" : T.textDim } : undefined}
                    >
                      {opp.sport} {opp.teamType ? `\u2022 ${opp.teamType}` : ""}
                      {opp.location ? ` \u2022 ${opp.location}` : ""}
                    </Text>
                  </View>
                  {added ? (
                    <View className="bg-black px-3 py-1.5 rounded-lg">
                      <Text className="text-white font-bold text-xs">Added</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => addOpponent(opp._id)}
                      disabled={adding === opp._id}
                      className={isDark ? "px-3 py-1.5 rounded-sm" : "bg-[#081126] px-3 py-1.5 rounded-sm"}
                      style={
                        isDark
                          ? { backgroundColor: "#1E1E24", borderWidth: 1, borderColor: "#2A2A2E" }
                          : undefined
                      }
                    >
                      {adding === opp._id ? (
                        <ActivityIndicator size="small" color={isDark ? "#F5F5F7" : "#9AEA62"} />
                      ) : (
                        <Text
                          className={isDark ? "font-bold text-xs" : "text-[#9AEA62] font-bold text-xs"}
                          style={isDark ? { color: "#F5F5F7" } : undefined}
                        >
                          Add
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {/* Player avatars row */}
                {oppPlayers !== undefined && (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: added ? (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)") : (isDark ? T.borderSubtle : "#F3F4F6"), flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TeamMembersAvatars players={oppPlayers} maxDisplay={5} isDark={isDark} />
                    {oppPlayers.length > 0 && (
                      <Text style={{ fontSize: 10, color: added ? (isDark ? "#86EFAC" : "#166534") : (isDark ? T.textMuted : "#9CA3AF"), marginLeft: 4 }}>
                        {oppPlayers.length} player{oppPlayers.length !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Pagination footer */}
        {loadingMoreOpps ? (
          <View style={{ paddingVertical: 14, alignItems: "center" }}>
            <ActivityIndicator color={isDark ? T.refresh : "#081126"} />
          </View>
        ) : oppHasNext ? (
          <TouchableOpacity
            onPress={loadMoreOpponents}
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E5E7EB",
              marginBottom: 8,
            }}
          >
            <Text style={{ color: isDark ? T.text : "#081126", fontWeight: "700", fontSize: 13 }}>
              Load More ({storedOpponents.length} of {oppTotal})
            </Text>
          </TouchableOpacity>
        ) : storedOpponents.length > 0 ? (
          <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 11, textAlign: "center", marginBottom: 8 }}>
            All {oppTotal} opponent{oppTotal !== 1 ? "s" : ""} loaded
          </Text>
        ) : null}

        <View className="h-10" />
      </ScrollView>

      {/* Quick Create Modal - 2 Steps */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 justify-center px-6">
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.45)",
            }}
          />
          <View
            style={{
              backgroundColor: isDark ? T.surface : "#FFFEF8",
              borderRadius: 22,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 18,
              elevation: 8,
              overflow: "hidden",
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? T.border : undefined,
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.45)",
                top: -12,
                left: -12,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.45)",
                top: -12,
                right: -12,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.45)",
                bottom: -12,
                left: -12,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.45)",
                bottom: -12,
                right: -12,
              }}
            />
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-xl font-bold"
                style={isDark ? { color: T.text } : undefined}
              >
                {createStep === 1 ? "Team Name" : "Choose Logo"}
              </Text>
              <TouchableOpacity
                onPress={resetCreateModal}
              >
                <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View className="flex-row gap-2 mb-5">
              <View
                className={`flex-1 h-1 rounded-full ${createStep >= 1 ? "bg-[#9AEA62]" : "bg-gray-200"}`}
                style={
                  createStep < 1 && isDark ? { backgroundColor: T.border } : undefined
                }
              />
              <View
                className={`flex-1 h-1 rounded-full ${createStep >= 2 ? "bg-[#9AEA62]" : "bg-gray-200"}`}
                style={
                  createStep < 2 && isDark ? { backgroundColor: T.border } : undefined
                }
              />
            </View>

            {createStep === 1 ? (
              <>
                <Text
                  className="text-gray-500 text-xs font-bold mb-1"
                  style={isDark ? { color: T.textMuted } : undefined}
                >
                  TEAM NAME *
                </Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  className={isDark ? "rounded-xl px-4 py-3 mb-2" : "bg-gray-100 rounded-xl px-4 py-3 mb-2"}
                  style={isDark ? { backgroundColor: T.inputBg, color: T.text } : undefined}
                  placeholder="Enter opponent team name"
                  placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                  maxLength={40}
                />
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    text={team.sport}
                    bg={isDark ? "rgba(99,102,241,0.22)" : "#E0E7FF"}
                    color={isDark ? "#A5B4FC" : "#3730A3"}
                  />
                  <Badge
                    text={team.teamType}
                    bg={isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7"}
                    color={isDark ? "#FBBF24" : "#92400E"}
                  />
                  {team.ageGroup && (
                    <Badge
                      text={team.ageGroup}
                      bg={isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7"}
                      color={isDark ? "#86EFAC" : "#166534"}
                    />
                  )}
                  {team.season && (
                    <Badge
                      text={team.season}
                      bg={isDark ? "rgba(59,130,246,0.2)" : "#DBEAFE"}
                      color={isDark ? "#93C5FD" : "#1E40AF"}
                    />
                  )}
                </View>
                <TouchableOpacity
                  onPress={goToStep2}
                  className={isDark ? "py-3.5 rounded-xl items-center" : "bg-[#081126] py-3.5 rounded-xl items-center"}
                  style={
                    isDark
                      ? { backgroundColor: "#1E1E24", borderWidth: 1, borderColor: "#2A2A2E" }
                      : undefined
                  }
                >
                  <Text
                    className={isDark ? "font-bold text-base" : "text-[#9AEA62] font-bold text-base"}
                    style={isDark ? { color: "#F5F5F7" } : undefined}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text
                  className="text-gray-500 text-xs font-bold mb-3"
                  style={isDark ? { color: T.textMuted } : undefined}
                >
                  SELECT A LOGO
                </Text>
                <TouchableOpacity
                  onPress={pickOpponentLogo}
                  className={
                    isDark
                      ? "flex-row items-center justify-center rounded-xl px-4 py-3 mb-4"
                      : "flex-row items-center justify-center bg-white border border-dashed border-gray-300 rounded-xl px-4 py-3 mb-4"
                  }
                  style={
                    isDark
                      ? {
                          backgroundColor: T.surfaceAlt,
                          borderWidth: 1,
                          borderColor: T.border,
                          borderStyle: "dashed",
                        }
                      : undefined
                  }
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={isDark ? T.text : "#111827"} />
                  <Text
                    className={isDark ? "font-semibold ml-2" : "text-black font-semibold ml-2"}
                    style={isDark ? { color: T.text } : undefined}
                  >
                    Upload from device
                  </Text>
                </TouchableOpacity>
                {customLogoAsset ? (
                  <View
                    className={
                      isDark
                        ? "rounded-xl p-3 mb-4"
                        : "bg-white border-2 border-[#9AEA62] rounded-xl p-3 mb-4"
                    }
                    style={
                      isDark
                        ? {
                            backgroundColor: T.surfaceAlt,
                            borderWidth: 2,
                            borderColor: "#9AEA62",
                          }
                        : undefined
                    }
                  >
                    <View className="flex-row items-center">
                      <Image source={{ uri: customLogoAsset.uri }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                      <View className="flex-1 ml-3">
                        <Text
                          className="text-sm font-bold text-[#081126]"
                          style={isDark ? { color: T.text } : undefined}
                        >
                          Custom logo selected
                        </Text>
                        <Text
                          className="text-xs text-gray-500"
                          style={isDark ? { color: T.textDim } : undefined}
                        >
                          This uploaded image will be used for the opponent team.
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setCustomLogoAsset(null)}
                        className={isDark ? "w-8 h-8 items-center justify-center rounded-full" : "w-8 h-8 items-center justify-center rounded-full bg-gray-100"}
                        style={isDark ? { backgroundColor: T.inputBg } : undefined}
                      >
                        <Ionicons name="close" size={16} color={isDark ? T.textDim : "#6B7280"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                <View className="flex-row flex-wrap justify-center gap-3 mb-5">
                  {quickCreateLogos.map((logo) => (
                    <TouchableOpacity
                      key={logo.id}
                      onPress={() => {
                        setCustomLogoAsset(null);
                        setSelectedLogoId(logo.id);
                      }}
                      className="items-center"
                    >
                      <View
                        className="w-16 h-16 rounded-full items-center justify-center"
                        style={{
                          borderWidth: selectedLogoId === logo.id ? 3 : 1,
                          borderColor:
                            selectedLogoId === logo.id
                              ? "#9AEA62"
                              : (isDark ? T.border : "#E5E7EB"),
                          backgroundColor: isDark ? T.surfaceAlt : undefined,
                        }}
                      >
                        <Image
                          source={logo.source}
                          style={{ width: 56, height: 56 }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text
                        className="text-[10px] text-gray-500 mt-1"
                        style={isDark ? { color: T.textMuted } : undefined}
                      >
                        {logo.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setCreateStep(1)}
                    className={isDark ? "flex-1 py-3 rounded-xl items-center" : "flex-1 bg-gray-100 py-3 rounded-xl items-center"}
                    style={isDark ? { backgroundColor: T.inputBg } : undefined}
                  >
                    <Text
                      className="font-bold text-gray-600"
                      style={isDark ? { color: T.textDim } : undefined}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={quickCreate}
                    disabled={creating}
                    className="flex-1 bg-[#9AEA62] py-3 rounded-xl items-center"
                    style={{ opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? (
                      <ActivityIndicator color="#081126" size="small" />
                    ) : (
                      <Text className="font-bold text-[#081126]">Create</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* My Teams Bottom Sheet */}
      <BottomSheet
        ref={myTeamsSheetRef}
        index={-1}
        snapPoints={["70%"]}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          ...(isDark ? { backgroundColor: T.surface } : {}),
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? T.border : "#E5E7EB",
          width: 40,
        }}
        onChange={(idx) => { if (idx === -1) setShowMyTeams(false); }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom + 16, 20) }}
          showsVerticalScrollIndicator={false}
        >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 pr-2">
                <Text
                  className="text-xl font-bold"
                  style={isDark ? { color: T.text } : undefined}
                >
                  Select From Your Teams
                </Text>
                {!!teamSport && (
                  <Text
                    className="text-gray-500 text-xs mt-1"
                    style={isDark ? { color: T.textDim } : undefined}
                  >
                    Only {teamSport} teams are shown
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => myTeamsSheetRef.current?.close()}>
                <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
              </TouchableOpacity>
            </View>
            <View>
              {myTeams.length === 0 ? (
                <Text
                  className="text-gray-400 text-center py-8"
                  style={isDark ? { color: T.textMuted } : undefined}
                >
                  {teamSport
                    ? `No other ${teamSport} teams in your account`
                    : "No other teams found"}
                </Text>
              ) : (
                [...myTeams]
                  .sort((a, b) => {
                    if (isAddedOpponent(a._id)) return -1;
                    if (isAddedOpponent(b._id)) return 1;
                    return 0;
                  })
                  .map((t) => {
                    const added = isAddedOpponent(t._id);
                    return (
                      <TouchableOpacity
                        key={t._id}
                        onPress={() => !added && addFromMyTeams(t)}
                        disabled={added}
                        activeOpacity={added ? 1 : 0.7}
                        className={
                          isDark
                            ? "flex-row items-center gap-3 py-3"
                            : "flex-row items-center gap-3 py-3 border-b border-gray-100"
                        }
                        style={{
                          ...(isDark
                            ? { borderBottomWidth: 1, borderBottomColor: T.borderSubtle }
                            : {}),
                          ...(added ? { opacity: 0.85 } : {}),
                        }}
                      >
                        <View className="w-10 h-10 rounded-full bg-black items-center justify-center overflow-hidden">
                          <Image
                            source={sportIcons[t.sport] || defaultIcon}
                            className="w-8 h-8"
                            resizeMode="contain"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="font-bold text-gray-900"
                            style={isDark ? { color: T.text } : undefined}
                          >
                            {t.teamName}
                          </Text>
                          <Text
                            className="text-gray-500 text-sm"
                            style={isDark ? { color: T.textDim } : undefined}
                          >
                            {t.sport} {t.location ? `\u2022 ${t.location}` : ""}
                          </Text>
                        </View>
                        {added ? (
                          <View
                            className={isDark ? "px-3 py-1.5 rounded-lg" : "bg-black px-3 py-1.5 rounded-lg"}
                            style={
                              isDark
                                ? { backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.border }
                                : undefined
                            }
                          >
                            <Text
                              className={isDark ? "font-bold text-xs" : "text-white font-bold text-xs"}
                              style={isDark ? { color: T.text } : undefined}
                            >
                              Added
                            </Text>
                          </View>
                        ) : (
                          <Ionicons
                            name="add-circle-outline"
                            size={24}
                            color="#9AEA62"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
              )}
            </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// =============================================
// MESSAGES TAB - Chat UI
// =============================================
