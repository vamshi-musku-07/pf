import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import TournamentCricketLoader from "@/components/tournament/TournamentCricketLoader";
import AppliedRequestCard from "@/components/tournament/AppliedRequestCard";
import TournamentListCard from "@/components/tournament/TournamentListCard";
import TournamentListSegmentedTabs from "@/components/tournament/TournamentListSegmentedTabs";
import BrowseSportSelect from "@/components/tournament/BrowseSportSelect";
import { browseSportLabel } from "@/components/tournament/BrowseSportIcons";
import LightOnDarkStatusBar from "@/components/LightOnDarkStatusBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TOURNAMENT_EMPTY_ICONS = {
  applied: require("../../assets/images/tournament-applied-empty-3d.png"),
  mine: require("../../assets/images/tournament-mine-empty-3d.png"),
};
const TOURNAMENT_HEADER_ART = require("../../assets/images/tournamentop1.png");
// Previous header kept: assets/images/tournament-header-arena-3d.jpg
import { goBackTo, BACK_TO_HOME } from "@/lib/navigationBack";
import { showToast } from "@/context/ToastContext";
import { browsePublicTournamentsAPI, browsePublicSportsAPI, getMyTournamentJoinRequestsAPI } from "@/services/TournamentApi";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { tournamentListSubtitle, resolveTournamentRoute } from "@/features/tournament/publicConfig";
import { tournamentMineRoleLabel } from "@/features/tournament/mineConfig";
import {
  normalizeListTab,
  summarizeAppliedRequests,
  tournamentStubFromRequest,
} from "@/features/tournament/appliedConfig";
import {
  BROWSE_DEFAULT_LIMIT,
  BROWSE_SEARCH_DEBOUNCE_MS,
  BROWSE_SEARCH_FETCH_LIMIT,
  BROWSE_SEARCH_MAX_CHARS,
  browseSearchHint,
  sanitizeBrowseQuery,
} from "@/features/tournament/browseConfig";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

function TournamentCard({ item, onPress, publicView, roleLabel, isDark, T }) {
  const subtitle = tournamentListSubtitle(item);
  const publicChipBg = isDark ? "rgba(34,197,94,0.16)" : "#F0FDF4";
  const publicChipText = isDark ? "#4ADE80" : "#15803D";
  const organizing = roleLabel === "Organizing";
  const roleChipBg = isDark
    ? organizing
      ? "rgba(99,102,241,0.2)"
      : "rgba(249,115,22,0.18)"
    : organizing
      ? "#EEF2FF"
      : "#FFF7ED";
  const roleChipText = isDark
    ? organizing
      ? "#A5B4FC"
      : "#FB923C"
    : organizing
      ? "#4338CA"
      : "#C2410C";

  return (
    <TournamentListCard
      title={item.name}
      subtitle={subtitle}
      sport={item?.sport}
      chipLabel={publicView ? "Public" : roleLabel || null}
      chipBg={publicView ? publicChipBg : roleLabel ? roleChipBg : undefined}
      chipText={publicView ? publicChipText : roleLabel ? roleChipText : undefined}
      onPress={onPress}
      isDark={isDark}
      T={T}
    />
  );
}

export default function TournamentListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const initialTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const { isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [listTab, setListTab] = useState(normalizeListTab(initialTab));
  const [browseList, setBrowseList] = useState([]);
  const [appliedList, setAppliedList] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [appliedLoading, setAppliedLoading] = useState(false);
  const [browseSearching, setBrowseSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [debouncedBrowseQuery, setDebouncedBrowseQuery] = useState("");
  const [browseSport, setBrowseSport] = useState(null);
  const [sportsPayload, setSportsPayload] = useState(null);
  const [sportsLoading, setSportsLoading] = useState(false);

  const browseRequestId = useRef(0);
  const appliedRequestId = useRef(0);
  const browseDebounceRef = useRef(null);
  const sportsRequestId = useRef(0);
  const activeSearchQ = sanitizeBrowseQuery(debouncedBrowseQuery);
  const searchHint = browseSearchHint(browseQuery);
  const showSportPicker = listTab === "browse" && !browseSport;

  const { tournaments, isLoading, fetchTournaments, ownedTeamIds, memberTeamIds, userId } = useMyTournaments();

  useEffect(() => {
    if (browseDebounceRef.current) clearTimeout(browseDebounceRef.current);
    browseDebounceRef.current = setTimeout(() => {
      setDebouncedBrowseQuery(browseQuery);
    }, BROWSE_SEARCH_DEBOUNCE_MS);
    return () => {
      if (browseDebounceRef.current) clearTimeout(browseDebounceRef.current);
    };
  }, [browseQuery]);

  const fetchSports = useCallback(async ({ soft = false } = {}) => {
    const requestId = ++sportsRequestId.current;
    if (!soft) setSportsLoading(true);
    try {
      const res = await browsePublicSportsAPI();
      if (requestId !== sportsRequestId.current) return;
      setSportsPayload(res?.data || null);
    } catch {
      if (requestId !== sportsRequestId.current) return;
      showToast("Failed to load sports", "error");
      setSportsPayload({ trending: { tournamentCount: 0, liveCount: 0 }, sports: [] });
    } finally {
      if (requestId === sportsRequestId.current) setSportsLoading(false);
    }
  }, []);

  const fetchBrowse = useCallback(async (rawQuery = "", { soft = false, sport } = {}) => {
    const q = sanitizeBrowseQuery(rawQuery);
    const requestId = ++browseRequestId.current;
    if (soft) setBrowseSearching(true);
    else setBrowseLoading(true);
    try {
      const sportFilter = sport && sport !== "Trending" ? sport : undefined;
      const res = await browsePublicTournamentsAPI({
        status: "discoverable",
        limit: q ? BROWSE_SEARCH_FETCH_LIMIT : BROWSE_DEFAULT_LIMIT,
        ...(q ? { q } : {}),
        ...(sportFilter ? { sport: sportFilter } : {}),
      });
      if (requestId !== browseRequestId.current) return;
      setBrowseList(res?.data || []);
    } catch {
      if (requestId !== browseRequestId.current) return;
      showToast(q ? "Search failed" : "Failed to load public tournaments", "error");
      setBrowseList([]);
    } finally {
      if (requestId === browseRequestId.current) {
        setBrowseLoading(false);
        setBrowseSearching(false);
      }
    }
  }, []);

  const fetchApplied = useCallback(async ({ soft = false } = {}) => {
    if (!isSignedIn) {
      setAppliedList([]);
      return;
    }
    const requestId = ++appliedRequestId.current;
    if (!soft) setAppliedLoading(true);
    try {
      const res = await getMyTournamentJoinRequestsAPI();
      if (requestId !== appliedRequestId.current) return;
      setAppliedList(res?.data || []);
    } catch {
      if (requestId !== appliedRequestId.current) return;
      showToast("Failed to load your applications", "error");
      setAppliedList([]);
    } finally {
      if (requestId === appliedRequestId.current) setAppliedLoading(false);
    }
  }, [isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      fetchTournaments({ force: true });
      if (listTab === "applied") fetchApplied({ soft: appliedList.length > 0 });
    }, [fetchTournaments, listTab, fetchApplied, appliedList.length]),
  );

  useEffect(() => {
    if (listTab !== "browse") return undefined;
    if (!browseSport) {
      fetchSports({ soft: !!sportsPayload });
      return undefined;
    }
    fetchBrowse(debouncedBrowseQuery, {
      soft: browseList.length > 0,
      sport: browseSport,
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listTab, browseSport, debouncedBrowseQuery, fetchBrowse, fetchSports]);

  useEffect(() => {
    if (listTab !== "applied") return undefined;
    fetchApplied({ soft: appliedList.length > 0 });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listTab, isSignedIn, fetchApplied]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (listTab === "mine") {
      await fetchTournaments({ force: true });
    } else if (listTab === "applied") {
      await fetchApplied();
    } else if (!browseSport) {
      await fetchSports();
    } else {
      await Promise.all([
        fetchBrowse(debouncedBrowseQuery, { sport: browseSport }),
        fetchSports({ soft: true }),
      ]);
    }
    setRefreshing(false);
  }, [
    listTab,
    browseSport,
    fetchTournaments,
    fetchApplied,
    fetchBrowse,
    fetchSports,
    debouncedBrowseQuery,
  ]);

  const handleListTab = (tab) => {
    setListTab(tab);
    if (tab !== "browse") setBrowseSport(null);
  };

  const clearBrowseSearch = () => setBrowseQuery("");

  const clearBrowseSport = () => {
    setBrowseSport(null);
    setBrowseQuery("");
    setDebouncedBrowseQuery("");
  };

  const appliedStats = useMemo(() => summarizeAppliedRequests(appliedList), [appliedList]);

  const openMine = useCallback(
    (id) => router.push({ pathname: `/tournament/${id}`, params: { backTo: "/tournament" } }),
    [router],
  );

  const openPublic = useCallback(
    (item) => {
      const route = resolveTournamentRoute(item, { backTo: "/tournament", isSignedIn });
      if (route) router.push(route);
    },
    [router, isSignedIn],
  );

  const openApplied = useCallback(
    (request) => {
      if (request?.status === "approved" && request?.tournamentId) {
        openMine(String(request.tournamentId));
        return;
      }
      openPublic(tournamentStubFromRequest(request));
    },
    [openMine, openPublic],
  );

  const loading =
    listTab === "mine" ? isLoading : listTab === "applied" ? appliedLoading : browseLoading;

  const { height: windowHeight } = useWindowDimensions();
  const headerBannerHeight = Math.round(windowHeight * 0.3);

  const renderMineCard = ({ item }) => (
    <TournamentCard
      item={item}
      roleLabel={tournamentMineRoleLabel(item, userId, ownedTeamIds, memberTeamIds)}
      onPress={() => openMine(item._id)}
      isDark={isDark}
      T={T}
    />
  );

  const renderAppliedCard = ({ item }) => (
    <AppliedRequestCard request={item} onPress={() => openApplied(item)} isDark={isDark} T={T} />
  );

  const renderBrowseCard = ({ item }) => (
    <TournamentCard item={item} publicView onPress={() => openPublic(item)} isDark={isDark} T={T} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? T.bg : "#F0F4F8" }}>
      <LightOnDarkStatusBar />

      <View
        style={{
          height: headerBannerHeight + insets.top,
          backgroundColor: "#0B1324",
          paddingTop: insets.top,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <ExpoImage
            source={TOURNAMENT_HEADER_ART}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <TournamentListSegmentedTabs
        key={isDark ? "tabs-dark" : "tabs-light"}
        activeTab={listTab}
        onChange={handleListTab}
        appliedPending={appliedStats.pending}
        isDark={isDark}
        T={T}
      />

      {showSportPicker ? (
        <BrowseSportSelect
          sportsPayload={sportsPayload}
          loading={sportsLoading}
          selectedSport={browseSport}
          onSelect={(item) => setBrowseSport(item.sport)}
          onClose={() => setListTab("mine")}
          onReorder={() => showToast("Drag-to-reorder coming soon", "info")}
          isDark={isDark}
        />
      ) : (
        <>
      {listTab === "browse" && browseSport ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: isDark ? "#1A1C1E" : "#FFFFFF",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
          }}
        >
          <TouchableOpacity
            onPress={clearBrowseSport}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={24} color={isDark ? "#F5F5F7" : "#0B1324"} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "700",
              color: isDark ? "#F5F5F7" : "#0B1324",
              marginRight: 40,
            }}
          >
            {browseSportLabel(browseSport)}
          </Text>
        </View>
      ) : null}

      {listTab === "browse" ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
          style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? T.surface : "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E2E8F0",
              paddingHorizontal: 12,
              height: 48,
            }}
          >
            <Ionicons name="search" size={18} color={isDark ? T.iconMuted : "#94A3B8"} />
            <TextInput
              value={browseQuery}
              onChangeText={setBrowseQuery}
              placeholder="Search tournaments…"
              placeholderTextColor={isDark ? T.textMuted : "#94A3B8"}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              maxLength={BROWSE_SEARCH_MAX_CHARS}
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 15,
                fontWeight: "600",
                color: isDark ? T.text : "#0B1324",
                paddingVertical: 0,
              }}
            />
            {browseSearching ? (
              <ActivityIndicator
                size="small"
                color={isDark ? T.text : "#0B1324"}
                style={{ marginRight: 4 }}
              />
            ) : null}
            {browseQuery.length > 0 ? (
              <TouchableOpacity onPress={clearBrowseSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={isDark ? T.iconMuted : "#94A3B8"} />
              </TouchableOpacity>
            ) : null}
          </View>
          {searchHint ? (
            <Text
              style={{
                color: isDark ? T.textMuted : "#94A3B8",
                fontSize: 12,
                fontWeight: "600",
                marginTop: 8,
                marginLeft: 4,
              }}
            >
              {searchHint}
            </Text>
          ) : activeSearchQ ? (
            <Text
              style={{
                color: isDark ? T.textDim : "#64748B",
                fontSize: 12,
                fontWeight: "600",
                marginTop: 8,
                marginLeft: 4,
              }}
            >
              {browseSearching
                ? `Searching “${activeSearchQ}”…`
                : `${browseList.length} result${browseList.length === 1 ? "" : "s"} for “${activeSearchQ}”`}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {listTab === "applied" && !loading ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 }}
        >
          <Text style={{ color: isDark ? T.textDim : "#64748B", fontSize: 12, fontWeight: "600" }}>
            Join requests you sent from Browse — pending, accepted, or declined.
          </Text>
        </Animated.View>
      ) : null}

      {loading && !browseSearching ? (
        <TournamentCricketLoader
          message={
            listTab === "mine"
              ? "Loading your tournaments…"
              : listTab === "applied"
                ? "Loading your applications…"
                : "Loading public leagues…"
          }
          messageColor={isDark ? T.textDim : undefined}
        />
      ) : (
        <Animated.View
          key={listTab}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(140)}
          style={{ flex: 1 }}
        >
          {listTab === "applied" ? (
            <FlatList
              data={appliedList}
              keyExtractor={(item) => String(item._id)}
              renderItem={renderAppliedCard}
              extraData={isDark}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: insets.bottom + 40,
                flexGrow: 1,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? T.refresh : "#0B1324"}
                  colors={[isDark ? T.refresh : "#0B1324"]}
                />
              }
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 28 }}>
                  <ExpoImage
                    source={TOURNAMENT_EMPTY_ICONS.applied}
                    style={{ width: 96, height: 96 }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: isDark ? T.text : "#0B1324",
                      marginTop: 16,
                    }}
                  >
                    {isSignedIn ? "No applications yet" : "Sign in to see applications"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDark ? T.textDim : "#6B7280",
                      textAlign: "center",
                      marginTop: 6,
                      lineHeight: 20,
                    }}
                  >
                    {isSignedIn
                      ? "Browse public tournaments and tap Request to join. Your pending and past requests show up here."
                      : "Sign in, then request to join a league from Browse."}
                  </Text>
                  {isSignedIn ? (
                    <TouchableOpacity
                      onPress={() => handleListTab("browse")}
                      style={{
                        backgroundColor: "#0B1324",
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderRadius: 12,
                        marginTop: 20,
                        ...(isDark && { borderWidth: 1, borderColor: T.border }),
                      }}
                    >
                      <Text style={{ color: "#BAF072", fontWeight: "800" }}>Browse leagues</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
            />
          ) : (
            <FlatList
              data={listTab === "mine" ? tournaments : browseList}
              keyExtractor={(item) => String(item._id)}
              renderItem={listTab === "mine" ? renderMineCard : renderBrowseCard}
              extraData={isDark}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: insets.bottom + 40,
                flexGrow: 1,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? T.refresh : "#0B1324"}
                  colors={[isDark ? T.refresh : "#0B1324"]}
                />
              }
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 28 }}>
                  {listTab === "mine" ? (
                    <ExpoImage
                      source={TOURNAMENT_EMPTY_ICONS.mine}
                      style={{ width: 96, height: 96 }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                  ) : (
                    <Ionicons
                      name={activeSearchQ ? "search-outline" : "trophy-outline"}
                      size={56}
                      color={isDark ? T.iconMuted : "#CBD5E1"}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: isDark ? T.text : "#0B1324",
                      marginTop: 16,
                    }}
                  >
                    {listTab === "mine"
                      ? "No tournaments yet"
                      : activeSearchQ
                        ? `No matches for “${activeSearchQ}”`
                        : "No public leagues"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDark ? T.textDim : "#6B7280",
                      textAlign: "center",
                      marginTop: 6,
                      lineHeight: 20,
                    }}
                  >
                    {listTab === "mine"
                      ? "Create a league or join a team enrolled in a tournament to see it here."
                      : activeSearchQ
                        ? "Try another name, venue, season, share code, or enrolled team."
                        : "Public active tournaments will appear here for anyone to follow."}
                  </Text>
                  {listTab === "mine" ? (
                    <TouchableOpacity
                      onPress={() => router.push("/tournament/pick-sport")}
                      style={{
                        backgroundColor: "#0B1324",
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderRadius: 12,
                        marginTop: 20,
                        ...(isDark && { borderWidth: 1, borderColor: T.border }),
                      }}
                    >
                      <Text style={{ color: "#BAF072", fontWeight: "800" }}>Create Tournament</Text>
                    </TouchableOpacity>
                  ) : activeSearchQ ? (
                    <TouchableOpacity
                      onPress={clearBrowseSearch}
                      style={{
                        backgroundColor: "#0B1324",
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderRadius: 12,
                        marginTop: 20,
                        ...(isDark && { borderWidth: 1, borderColor: T.border }),
                      }}
                    >
                      <Text style={{ color: "#BAF072", fontWeight: "800" }}>Clear search</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
            />
          )}
        </Animated.View>
      )}
        </>
      )}

      <TouchableOpacity
        onPress={() => router.push("/tournament/pick-sport")}
        accessibilityRole="button"
        accessibilityLabel="Create tournament"
        style={{
          position: "absolute",
          right: 20,
          bottom: insets.bottom + 20,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: isDark ? T.surfaceAlt : "#BAF072",
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? T.border : "transparent",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          shadowColor: "#081126",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.4 : 0.28,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={30} color={isDark ? T.text : "#081126"} />
      </TouchableOpacity>
    </View>
  );
}
