import { Ionicons } from "@expo/vector-icons";
import { CREATE_TEAM_SPORT_ICONS } from "@/constants/sports";
import { SkeletonTeamList } from "@/components/Skeleton";
import { showToast } from "@/context/ToastContext";
import MarqueeText from "@/components/MarqueeText";
import { useState, useCallback, useRef } from "react";
import { saveTeamsList, loadTeamsList, removeTeamFromCache } from "@/lib/teamCache";
import { clearUpcomingCache } from "@/lib/homeUpcomingCache";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getTeamsAPI, deleteTeamAPI } from "@/services/TeamApi";
import { getUserInvitationsAPI } from "@/services/PlayerApi";

const PAGE_LIMIT = 10;

const sportIcons = CREATE_TEAM_SPORT_ICONS;
const defaultIcon = CREATE_TEAM_SPORT_ICONS.Football;

const TeamCard = ({ team, onLongPress, onPress, T, isDark }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const icon = sportIcons[team.sport] || defaultIcon;
  const teamMetaLine = [team.sport, team.teamType || "Team", team.ageGroup]
    .filter(Boolean)
    .join(" • ");

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(team)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
        onLongPress={onLongPress ? () => onLongPress(team) : undefined}
        delayLongPress={350}
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: T.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          width: "100%",
          ...(isDark && { borderWidth: 1, borderColor: T.border }),
        }}
        accessibilityLabel={`${team.teamName}, ${team.sport} team`}
        accessibilityRole="button"
        accessibilityHint="Opens team dashboard"
      >
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? T.surfaceAlt : "#000", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Image source={icon} style={{ width: 48, height: 48 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", fontSize: 17, textTransform: "uppercase", color: T.text }}>{team.teamName}</Text>
          {teamMetaLine ? (
            <Text style={{ fontWeight: "600", color: T.textDim }}>{teamMetaLine}</Text>
          ) : null}
          <MarqueeText
            style={{ color: T.textMuted, fontSize: 14 }}
            containerStyle={{ flex: 1 }}
          >
            {team.location}
          </MarqueeText>
        </View>
        <Ionicons name="chevron-forward" size={22} color={T.iconMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const Teams = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);
  const [teamMode, setTeamMode] = useState("owned");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const mapJoinedTeams = useCallback((invitations, searchStr = "") => {
    const normalizedSearch = searchStr.trim().toLowerCase();

    return (invitations || [])
      .filter((inv) =>
        inv.isAccepted &&
        inv.teamId &&
        inv.isActive !== false &&
        !inv.isRemoved &&
        !inv.teamDeleted
      )
      .map((inv) => ({
        _id: inv.teamId,
        teamName: inv.teamName || "Joined Team",
        sport: inv.sport || "",
        teamType: inv.playerRoleTitle || inv.playerRole || "Member",
        ageGroup: "",
        season: inv.season || "",
        location: inv.location || "",
        teamlogo: inv.teamLogo || null,
        joinedViaInvitation: true,
      }))
      .filter((team) => {
        if (!normalizedSearch) return true;
        return [team.teamName, team.sport, team.location, team.season]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      });
  }, []);

  // Fetch a specific page
  const fetchPage = useCallback(async (pageNum, searchStr, append = false) => {
    if (!isSignedIn) return;
    try {
      const params = { page: pageNum, limit: PAGE_LIMIT };
      if (searchStr && searchStr.trim()) params.search = searchStr.trim();
      const result = await getTeamsAPI(params);
      const fetched = result.data || result.teams || [];
      const pagination = result.pagination || {};
      setHasNextPage(pagination.hasNextPage || false);
      setTotal(pagination.total || fetched.length);
      setTeams((prev) => append ? [...prev, ...fetched] : fetched);
      setPage(pageNum);
      // Save to cache only for the first page with no search query.
      // This is what gets shown instantly on the next visit.
      if (pageNum === 1 && !searchStr) {
        saveTeamsList(fetched);
      }
    } catch {
      if (!append) setTeams([]);
    }
  }, [isSignedIn]);

  const fetchJoinedTeams = useCallback(async (searchStr = "") => {
    if (!isSignedIn) return;
    try {
      const result = await getUserInvitationsAPI();
      const fetched = mapJoinedTeams(result.data || [], searchStr);
      setTeams(fetched);
      setTotal(fetched.length);
      setHasNextPage(false);
      setPage(1);
    } catch {
      setTeams([]);
      setTotal(0);
      setHasNextPage(false);
    }
  }, [isSignedIn, mapJoinedTeams]);

  // Initial load & focus refresh
  const initialLoad = useCallback(async () => {
    if (!isSignedIn) return;

    // Try to show cached data instantly — user sees real team names right away.
    if (teamMode === "joined") {
      setLoading(true);
      await fetchJoinedTeams(search);
      setLoading(false);
      return;
    }

    const cached = await loadTeamsList();
    if (cached) {
      setTeams(cached);
      setLoading(false);
      // Silently refresh in background — list updates without any spinner.
      fetchPage(1, search, false);
    } else {
      // No cache yet (first launch) — show skeleton until data arrives.
      setLoading(true);
      await fetchPage(1, search, false);
      setLoading(false);
    }
  }, [isSignedIn, search, fetchPage, fetchJoinedTeams, teamMode]);

  useFocusEffect(useCallback(() => {
    initialLoad();
  }, [initialLoad]));

  // Pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    if (teamMode === "joined") {
      await fetchJoinedTeams(search);
    } else {
      await fetchPage(1, search, false);
    }
    setRefreshing(false);
  };

  // Load more (next page)
  const loadMore = async () => {
    if (teamMode === "joined" || loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    await fetchPage(page + 1, search, true);
    setLoadingMore(false);
  };

  // Debounced search — sends to backend
  const handleSearchChange = (text) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearch(text);
      setLoading(true);
      if (teamMode === "joined") {
        await fetchJoinedTeams(text);
      } else {
        await fetchPage(1, text, false);
      }
      setLoading(false);
    }, 400);
  };

  const switchTeamMode = async (nextMode) => {
    if (nextMode === teamMode) return;
    setTeamMode(nextMode);
    setSearch(searchInput);
    setLoading(true);
    if (nextMode === "joined") {
      await fetchJoinedTeams(searchInput);
    } else {
      await fetchPage(1, searchInput, false);
    }
    setLoading(false);
  };

  const handleTeamPress = useCallback((team) => {
    router.push({ pathname: `/team/${team._id}`, params: { backTo: "/(tabs)/teams" } });
  }, [router]);

  const openMenu = (team) => { setSelectedTeam(team); setMenuVisible(true); };
  const closeMenu = () => setMenuVisible(false);

  const handleUpdatePress = () => {
    const team = selectedTeam;
    closeMenu();
    setSelectedTeam(null);

    if (!team?._id) return;

    setTimeout(() => {
      router.push({
        pathname: "/(tabs)/CreateTeam",
        params: { mode: "edit", teamId: team._id },
      });
    }, 120);
  };

  const handleDeletePress = () => {
    const team = selectedTeam;
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        "Delete Team",
        `Are you sure you want to delete "${team?.teamName}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setSelectedTeam(null) },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (!team?._id) return;
              setDeleting(true);
              try {
                await deleteTeamAPI(team._id);
                setTeams((prev) => prev.filter((t) => t._id !== team._id));
                setTotal((prev) => Math.max(0, prev - 1));
                await removeTeamFromCache(team._id);
                await clearUpcomingCache();
              } catch (err) {
                showToast(err?.response?.data?.message || "Failed to delete team", "error");
              } finally {
                setDeleting(false);
                setSelectedTeam(null);
              }
            },
          },
        ]
      );
    }, 300);
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator color={T.text} />
        </View>
      );
    }
    if (teamMode === "owned" && hasNextPage) {
      return (
        <TouchableOpacity
          onPress={loadMore}
          style={{
            marginTop: 8,
            marginBottom: 16,
            backgroundColor: T.surface,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: "center",
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          <Text style={{ color: T.text, fontWeight: "700", fontSize: 14 }}>Load More</Text>
        </TouchableOpacity>
      );
    }
    return <View style={{ height: 150 }} />;
  };

  return (
    <View style={{ backgroundColor: T.bg, flex: 1, paddingTop: 40, padding: 20 }}>
      <StatusBar barStyle={T.statusBar} />
      {/* Search Bar */}
      <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: T.inputBg,
          borderRadius: 16,
          paddingHorizontal: 16,
          height: 56,
          borderWidth: 1,
          borderColor: T.inputBorder,
        }}>
          <Ionicons name="search" size={20} color={T.iconMuted} />
          <TextInput
            style={{ flex: 1, marginLeft: 12, color: T.text, fontWeight: "500" }}
            placeholder="Search teams..."
            placeholderTextColor={T.textMuted}
            value={searchInput}
            onChangeText={handleSearchChange}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={20} color={T.iconMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/tournament", params: { backTo: "/(tabs)/teams" } })}
          style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "#081126", alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Tournaments"
        >
          <Ionicons name="trophy" size={22} color="#BAF072" />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", backgroundColor: T.segmentBg, borderRadius: 14, padding: 4 }}>
          {[
            { key: "owned", label: "Your Teams" },
            { key: "joined", label: "Joined Teams" },
          ].map((item) => {
            const active = teamMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => switchTeamMode(item.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: active ? (isDark ? "#081126" : T.segmentActive) : "transparent",
                }}
              >
                <Text style={{ color: active ? (isDark ? "#9AEA62" : T.segmentActiveText) : T.textMuted, fontSize: 12, fontWeight: "800" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Count pill */}
      {!loading && total > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: T.textMuted, fontSize: 13 }}>
            {teams.length} of {total} team{total !== 1 ? "s" : ""}
            {search ? ` for "${search}"` : ""}
          </Text>
        </View>
      )}

      {loading ? (
        <SkeletonTeamList count={6} />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item._id || item.teamName}
          renderItem={({ item }) => (
            <TeamCard team={item} onLongPress={teamMode === "owned" ? openMenu : undefined} onPress={handleTeamPress} T={T} isDark={isDark} />
          )}
          contentContainerStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          windowSize={7}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[T.refresh]} tintColor={T.refresh} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: T.textMuted, fontSize: 16 }}>
                {search
                  ? `No teams found for "${search}"`
                  : teamMode === "joined"
                    ? "No joined teams found"
                    : "No teams found"}
              </Text>
            </View>
          }
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
        />
      )}

      {/* ── Bottom Sheet Modal ── */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={closeMenu}>
        <Pressable onPress={closeMenu} style={{ flex: 1, backgroundColor: "" }} />
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderColor: T.border }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: T.borderSubtle, alignSelf: "center", marginTop: 10, marginBottom: 14 }} />
          <View style={{ paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: T.borderSubtle, marginBottom: 6 }}>
            <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" }}>Selected Team</Text>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: "800", marginTop: 3 }}>{selectedTeam?.teamName}</Text>
          </View>
          <TouchableOpacity onPress={handleUpdatePress} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(154,234,98,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="create-outline" size={19} color="#9AEA62" />
            </View>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: "600" }}>Update</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: T.borderSubtle, marginHorizontal: 20 }} />
          <TouchableOpacity onPress={handleDeletePress} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
            </View>
            <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "600" }}>Delete</Text>
          </TouchableOpacity>
          <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
            <TouchableOpacity onPress={closeMenu} activeOpacity={0.7} style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: T.border }}>
              <Text style={{ color: T.textMuted, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default Teams;
