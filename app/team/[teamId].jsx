import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MarqueeText from "@/components/MarqueeText";
import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import { saveTeamDetail, loadTeamDetail } from "@/lib/teamCache";
import { ActivityIndicator, Animated, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTeamByIdAPI,
  checkTeamOwnerAPI,
} from "@/services/TeamApi";
import { getPlayersByTeamAPI, checkIsManagerAPI } from "@/services/PlayerApi";
import { extractPlayersFromApiResponse, filterActiveRosterPlayers, mergeRosterLists, normalizeTeamId, isExternalLiveSpectator, EXTERNAL_SPECTATOR_TAB_IDS } from "@/lib/playerRoster";
import { getSchedulesByTeamAPI } from "@/services/ScheduleApi";
import { getGamesByTeamAPI, getGameByIdAPI } from "@/services/GameApi";
import { useRefresh } from "@/hooks/useRefresh";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getAccessToken } from "@/lib/tokenStorage";
import { PLAYER_WS_URL } from "@/config/api";
import { io } from "socket.io-client";
import GameScreen from "@/components/GameScreen";
import LiveStreamTab from "@/components/LiveStreamTab";
import SpectatorMatchHeader from "@/components/tournament/SpectatorMatchHeader";
import { CREATE_TEAM_SPORT_ICONS } from "@/constants/sports";
import { goBackTo } from "@/lib/navigationBack";

import HomeTab from "./tabs/HomeTab";
import TeamTab from "./tabs/TeamTab";
import ScheduleTab from "./tabs/ScheduleTab";
import OpponentsTab from "./tabs/OpponentsTab";
import MessagesTab from "./tabs/MessagesTab";
import PostsTab from "./tabs/PostsTab";
import AssignmentsTab from "./tabs/AssignmentsTab";
import AvailabilityTab from "./tabs/AvailabilityTab";
import StatsTab from "./tabs/StatsTab";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const sportIcons = CREATE_TEAM_SPORT_ICONS;
const defaultIcon = CREATE_TEAM_SPORT_ICONS.Football;

export default function TeamDashboard() {
  const params = useLocalSearchParams();
  const rawTeamId = params.teamId;
  const teamId = Array.isArray(rawTeamId) ? rawTeamId[0] : String(rawTeamId || "").trim();
  const initialTab = Array.isArray(params.initialTab) ? params.initialTab[0] : params.initialTab;
  const initialGameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const isSpectate =
    params.spectate === "1" ||
    params.spectate === "true" ||
    params.viewOnly === "1" ||
    params.viewOnly === "true";
  const isTournamentScorer =
    !isSpectate &&
    (params.tournamentScorer === "1" || params.tournamentScorer === "true");
  const tournamentIdParam = Array.isArray(params.tournamentId)
    ? params.tournamentId[0]
    : params.tournamentId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});
  const teamSocketRef = useRef(null);
  const assignmentBannerTimerRef = useRef(null);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const activeTabRef = useRef(initialTab || "HOME");
  const { backendUser } = useBackendAuth();

  // Tracks schedule IDs that were successfully deleted on the client.
  // Used to filter stale cache responses — a deleted ID is never shown again
  // even if the backend returns it (Redis race condition guard).
  const pendingDeletedScheduleIds = useRef(new Set());

  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [opponentPlayers, setOpponentPlayers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [games, setGames] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isTeamOwner, setIsTeamOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    isSpectate ? "STATS" : (initialTab || "HOME"),
  );
  const [postsRefreshKey, setPostsRefreshKey] = useState(0);
  // Keep a ref in sync so socket handlers always read current tab without stale closure
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  // Auto-scroll tab bar so the active tab is always visible
  const scrollToActiveTab = useCallback((tabId) => {
    const x = tabLayouts.current[tabId];
    if (x != null) {
      tabScrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }
  }, []);
  useEffect(() => {
    // Layouts may not be ready yet — wait for them, then scroll
    const t = setTimeout(() => scrollToActiveTab(activeTab), 300);
    return () => clearTimeout(t);
  }, [activeTab, scrollToActiveTab]);
  const [currentGameId, setCurrentGameId] = useState(initialGameId ? String(initialGameId) : null);
  const [spectatorGame, setSpectatorGame] = useState(null);
  const [spectatorTeamMeta, setSpectatorTeamMeta] = useState({
    home: { teamName: "", teamLogo: "" },
    away: { teamName: "", teamLogo: "" },
  });
  useEffect(() => {
    if (initialGameId) {
      setCurrentGameId(String(initialGameId));
      setActiveTab("STATS");
    }
  }, [initialGameId]);

  // Match header meta while Watching or opening a live/scoring game (tournament vs title)
  useEffect(() => {
    if (!currentGameId) {
      setSpectatorGame(null);
      setSpectatorTeamMeta({
        home: { teamName: "", teamLogo: "" },
        away: { teamName: "", teamLogo: "" },
      });
      return undefined;
    }
    let cancelled = false;
    const pickTeamFields = (res) => {
      const t = res?.data || res?.team || res || {};
      return {
        teamName: t.teamName || t.name || "",
        teamLogo: t.teamLogo || t.teamlogo || t.logo || "",
      };
    };
    let lastHomeId = "";
    let lastAwayId = "";

    const loadTeamsIfNeeded = async (homeId, awayId, base) => {
      if (homeId === lastHomeId && awayId === lastAwayId) return;
      lastHomeId = homeId;
      lastAwayId = awayId;
      const [homeRes, awayRes] = await Promise.allSettled([
        homeId ? getTeamByIdAPI(homeId) : Promise.resolve(null),
        awayId ? getTeamByIdAPI(awayId) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setSpectatorTeamMeta({
        home:
          homeRes.status === "fulfilled" && homeRes.value
            ? pickTeamFields(homeRes.value)
            : {
                teamName: base?.teamName || "",
                teamLogo: base?.teamLogo || base?.teamlogo || "",
              },
        away:
          awayRes.status === "fulfilled" && awayRes.value
            ? pickTeamFields(awayRes.value)
            : {
                teamName: base?.opponentTeamName || "",
                teamLogo: base?.opponentTeamLogo || "",
              },
      });
    };

    const load = async () => {
      try {
        const res = await getGameByIdAPI(currentGameId);
        const payload = res?.data || res;
        if (cancelled || !payload?.base) return;
        setSpectatorGame(payload);
        await loadTeamsIfNeeded(
          normalizeTeamId(payload.base.teamId),
          normalizeTeamId(payload.base.opponentTeamId),
          payload.base,
        );
      } catch {
        // keep last good snapshot
      }
    };
    load();
    const pollMs = isSpectate ? 5000 : 20000;
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isSpectate, currentGameId]);

  const isExternalViewer = useMemo(
    () =>
      isExternalLiveSpectator({
        isSpectate,
        isOwner,
        user: backendUser,
        players: rosterPlayers,
      }),
    [isSpectate, isOwner, backendUser, rosterPlayers],
  );

  useEffect(() => {
    if (!isExternalViewer || EXTERNAL_SPECTATOR_TAB_IDS.includes(activeTab)) return;
    setActiveTab("STATS");
  }, [isExternalViewer, activeTab]);
  const [assignmentBanner, setAssignmentBanner] = useState(null); // { title, id }

  const fetchAll = useCallback(async () => {
    if (!teamId) {
      setTeam(null);
      setLoading(false);
      return;
    }

    // ── Step 1: Show cached data instantly ──────────────────────────────────
    // This means the real team name appears right away — no spinner, no
    // "My Team" placeholder — even on a slow connection.
    const cached = await loadTeamDetail(teamId);
    if (cached) {
      setTeam(cached.team);
      setPlayers(cached.players || []);
      setRosterPlayers(cached.rosterPlayers || cached.players || []);
      // Apply the deleted-IDs filter even on cached schedules.
      setSchedules(
        (cached.schedules || []).filter(
          (s) => !pendingDeletedScheduleIds.current.has(String(s._id))
        )
      );
      setGames(cached.games || []);
      setIsOwner(cached.isOwner || false);
      setIsTeamOwner(cached.isTeamOwner ?? cached.isOwner ?? false);
      setLoading(false); // Show UI immediately — no spinner needed.
    }

    // ── Step 2: Fetch fresh data from API (silently if we had cache) ─────────
    try {
      const [teamRes, playersRes, schedulesRes, gamesRes] =
        await Promise.allSettled([
          getTeamByIdAPI(teamId),
          getPlayersByTeamAPI(teamId),
          getSchedulesByTeamAPI(teamId, { refresh: true }),
          getGamesByTeamAPI(teamId),
        ]);

      let resolvedTeam = null;
      if (teamRes.status === "fulfilled") {
        resolvedTeam =
          teamRes.value?.data || teamRes.value?.team || teamRes.value;
        if (resolvedTeam && (resolvedTeam._id || resolvedTeam.teamName)) {
          setTeam(resolvedTeam);
        }
      }

      // Only update state on success — a failed fetch (e.g. 429) must never
      // wipe the list that was already showing from cache.
      let newPlayers = null;
      if (playersRes.status === "fulfilled") {
        const rawPlayers = extractPlayersFromApiResponse(playersRes.value).filter(
          (p) => p && p.isActive !== false,
        );
        newPlayers = filterActiveRosterPlayers(rawPlayers);
        setRosterPlayers(rawPlayers);
        setPlayers(newPlayers);
      }

      let mySchedules = [];
      if (schedulesRes.status === "fulfilled")
        mySchedules = schedulesRes.value.data || schedulesRes.value.schedules || [];

      const newGames = gamesRes.status === "fulfilled"
        ? (gamesRes.value.data || gamesRes.value.games || [])
        : [];
      setGames(newGames);

      // If opponent is self-owned, merge opponent schedules so both teams share the same view
      const opponentEntry = resolvedTeam?.opponents?.[0];
      const oppIsSelfOwned = opponentEntry?.isSelfOwned === true;
      const oppId = opponentEntry?.opponentTeamId?._id || opponentEntry?.opponentTeamId;
      // Helper: strip any IDs the user already deleted (guards against stale Redis cache)
      const filterDeleted = (list) =>
        list.filter((s) => !pendingDeletedScheduleIds.current.has(String(s._id)));

      let newSchedules = [];
      if (oppIsSelfOwned && oppId) {
        try {
          const oppSchRes = await getSchedulesByTeamAPI(oppId, { refresh: true });
          const oppSchedules = oppSchRes.data || oppSchRes.schedules || [];
          // Merge both teams' schedules and deduplicate by _id only.
          // Mirror copies (same event, different _ids) must stay in the list so edits
          // can update every linked record — ScheduleTab dedupes for display only.
          const merged = filterDeleted([...mySchedules, ...oppSchedules]);
          newSchedules = [...new Map(merged.map((s) => [String(s._id), s])).values()];
        } catch {
          newSchedules = filterDeleted(mySchedules);
        }
      } else {
        newSchedules = filterDeleted(mySchedules);
      }
      setSchedules(newSchedules);

      let newIsOwner = false;
      let newIsTeamOwner = false;
      try {
        const [ownerRes, managerRes] = await Promise.allSettled([
          checkTeamOwnerAPI(teamId),
          checkIsManagerAPI(teamId),
        ]);
        const ownerPayload = ownerRes.status === "fulfilled" ? ownerRes.value : null;
        newIsTeamOwner =
          ownerPayload?.isTeamOwner === true ||
          (ownerPayload?.isOwner === true && ownerPayload?.isManager !== true);
        const isTeamManager = managerRes.status === "fulfilled" && managerRes.value?.isManager === true;
        newIsOwner = newIsTeamOwner || isTeamManager;
        setIsOwner(newIsOwner);
        setIsTeamOwner(newIsTeamOwner);
      } catch {
        setIsOwner(false);
        setIsTeamOwner(false);
      }

      // ── Step 3: Save fresh data to cache for next visit ─────────────────
      if (resolvedTeam) {
        saveTeamDetail(teamId, {
          team: resolvedTeam,
          // Preserve cached players when the fetch failed (rate-limit, network, etc.)
          players: newPlayers !== null ? newPlayers : (cached?.players || []),
          rosterPlayers:
            playersRes.status === "fulfilled"
              ? extractPlayersFromApiResponse(playersRes.value).filter((p) => p && p.isActive !== false)
              : cached?.rosterPlayers || cached?.players || [],
          schedules: newSchedules,
          games: newGames,
          isOwner: newIsOwner,
          isTeamOwner: newIsTeamOwner,
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // (useFocusEffect placed after onRefresh — see below)

  // ── Team-level socket: notify player when a new assignment arrives ──────────
  const dismissBanner = useCallback(() => {
    if (assignmentBannerTimerRef.current) {
      clearTimeout(assignmentBannerTimerRef.current);
      assignmentBannerTimerRef.current = null;
    }
    Animated.timing(bannerAnim, { toValue: -80, duration: 250, useNativeDriver: true }).start(
      () => setAssignmentBanner(null)
    );
  }, [bannerAnim]);

  useEffect(() => {
    if (!teamId || activeTab === "ASSIGNMENTS" || isSpectate) return;
    const myId = String(backendUser?.id || backendUser?._id || "");

    let socket;
    (async () => {
      try {
        const token = await getAccessToken();
        socket = io(PLAYER_WS_URL, {
          path: "/player-io",
          transports: ["websocket"],
          reconnectionAttempts: 3,
          timeout: 8000,
          auth: { token },
        });
        teamSocketRef.current = socket;

        socket.on("connect", () => socket.emit("join-team", teamId));

        socket.on("assignment:new", (data) => {
          if (data?.assignedToId && String(data.assignedToId) !== myId) return;
          // Show banner only if not already on Assignments tab
          if (activeTabRef.current === "ASSIGNMENTS") return;
          const title = data?.assignment || "New assignment";
          setAssignmentBanner({ title, id: data?._id });
          Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true }).start();
          if (assignmentBannerTimerRef.current) {
            clearTimeout(assignmentBannerTimerRef.current);
          }
          assignmentBannerTimerRef.current = setTimeout(() => dismissBanner(), 6000);
        });
      } catch {}
    })();

    return () => {
      if (assignmentBannerTimerRef.current) {
        clearTimeout(assignmentBannerTimerRef.current);
        assignmentBannerTimerRef.current = null;
      }
      teamSocketRef.current?.off("assignment:new");
      teamSocketRef.current?.disconnect();
      teamSocketRef.current = null;
    };
  }, [activeTab, backendUser, bannerAnim, dismissBanner, isSpectate, teamId]);

  const { refreshing, onRefresh } = useRefresh(fetchAll);

  // Re-fetch (with refreshing indicator) whenever this screen comes into
  // focus — covers navigating back from add-player, join-link, etc.
  // NOTE: onRefresh is async and returns a Promise; useFocusEffect requires the
  // callback to return nothing (or a cleanup fn), so we call it without returning.
  useFocusEffect(
    useCallback(() => {
      onRefresh(true); // silent — no water-drop sound on navigation focus
    }, [onRefresh])
  );

  const loadingQuote = useMemo(() => {
    const quotes = [
      "Game loading… champions incoming",
      "Setting up your next victory…",
      "Players warming up…",
      "Your match is about to begin…",
      "Greatness takes a second… loading",
      "Building your team spirit…",
      "Game face ON 😤",
      "Legends aren't made overnight… almost ready",
      "Scoreboards getting ready…",
      "Victory is loading…",
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

  const currentOpponent = team?.opponents?.[0] || null;
  const isSelfOwnedOpponent = currentOpponent?.isSelfOwned === true;
  const linkedOpponentTeamId =
    currentOpponent?.opponentTeamId?._id ||
    currentOpponent?.opponentTeamId ||
    null;

  const matchOpponentTeamId = useMemo(() => {
    const base = spectatorGame?.base;
    if (!base) return null;
    const homeId = normalizeTeamId(base.teamId);
    const awayId = normalizeTeamId(base.opponentTeamId);
    const pageId = normalizeTeamId(teamId);
    if (!homeId || !awayId) return null;
    if (pageId && pageId === homeId) return awayId;
    if (pageId && pageId === awayId) return homeId;
    return awayId;
  }, [
    spectatorGame?.base?.teamId,
    spectatorGame?.base?.opponentTeamId,
    teamId,
  ]);

  const useTournamentBothTeams = !!(
    matchOpponentTeamId
    && (
      isTournamentScorer
      || isSpectate
      || !!tournamentIdParam
      || !!spectatorGame?.base?.tournamentId
    )
  );

  // Tournament / watch: fixture opponent. Otherwise linked self-owned opponent.
  const opponentTeamId = normalizeTeamId(
    useTournamentBothTeams ? matchOpponentTeamId : linkedOpponentTeamId,
  ) || null;

  // Must run before any early return — Rules of Hooks.
  useEffect(() => {
    const fetchOpponentId = normalizeTeamId(opponentTeamId);
    if (!fetchOpponentId || fetchOpponentId === normalizeTeamId(teamId)) {
      if (!isSelfOwnedOpponent && !useTournamentBothTeams) setOpponentPlayers([]);
      return undefined;
    }
    let cancelled = false;
    getPlayersByTeamAPI(fetchOpponentId)
      .then((res) => {
        if (cancelled) return;
        setOpponentPlayers(filterActiveRosterPlayers(extractPlayersFromApiResponse(res)));
      })
      .catch(() => {
        if (!cancelled && !isSelfOwnedOpponent) setOpponentPlayers([]);
      });
    return () => { cancelled = true; };
  }, [
    isSelfOwnedOpponent,
    opponentTeamId,
    useTournamentBothTeams,
    teamId,
  ]);

  const rosterByTeamId = useMemo(() => {
    const map = {};
    const addRoster = (tid, list) => {
      const key = normalizeTeamId(tid);
      if (!key || !list?.length) return;
      map[key] = mergeRosterLists(map[key] || [], list);
    };
    addRoster(teamId, players);
    addRoster(opponentTeamId, opponentPlayers);
    [...(players || []), ...(opponentPlayers || [])].forEach((player) => {
      addRoster(player?.teamId, [player]);
    });
    return map;
  }, [teamId, opponentTeamId, players, opponentPlayers]);

  const spectatorHeaderMeta = useMemo(() => {
    const pageLogo = team?.teamLogo || team?.teamlogo || team?.logo || "";
    const pageName = team?.teamName || "";
    const pageId = normalizeTeamId(teamId);
    const homeId = normalizeTeamId(spectatorGame?.base?.teamId);
    const awayId = normalizeTeamId(spectatorGame?.base?.opponentTeamId);
    return {
      home: {
        teamName:
          spectatorTeamMeta.home.teamName
          || (pageId && pageId === homeId ? pageName : "")
          || spectatorGame?.base?.teamName
          || "",
        teamLogo:
          spectatorTeamMeta.home.teamLogo
          || (pageId && pageId === homeId ? pageLogo : "")
          || spectatorGame?.base?.teamLogo
          || spectatorGame?.base?.teamlogo
          || "",
      },
      away: {
        teamName:
          spectatorTeamMeta.away.teamName
          || (pageId && pageId === awayId ? pageName : "")
          || spectatorGame?.base?.opponentTeamName
          || "",
        teamLogo:
          spectatorTeamMeta.away.teamLogo
          || (pageId && pageId === awayId ? pageLogo : "")
          || spectatorGame?.base?.opponentTeamLogo
          || "",
      },
    };
  }, [
    spectatorTeamMeta,
    team,
    teamId,
    spectatorGame?.base?.teamId,
    spectatorGame?.base?.opponentTeamId,
    spectatorGame?.base?.teamName,
    spectatorGame?.base?.opponentTeamName,
    spectatorGame?.base?.teamLogo,
    spectatorGame?.base?.teamlogo,
    spectatorGame?.base?.opponentTeamLogo,
  ]);

  const isTournamentMatchHeader = useMemo(() => {
    if (isSpectate) return false;
    if (!currentGameId) return false;
    if (isTournamentScorer || tournamentIdParam) return true;
    return !!spectatorGame?.base?.tournamentId;
  }, [
    isSpectate,
    currentGameId,
    isTournamentScorer,
    tournamentIdParam,
    spectatorGame?.base?.tournamentId,
  ]);

  const tournamentMatchTitle = useMemo(() => {
    if (!isTournamentMatchHeader) return null;
    const home =
      spectatorHeaderMeta?.home?.teamName
      || spectatorGame?.base?.teamName
      || "";
    const away =
      spectatorHeaderMeta?.away?.teamName
      || spectatorGame?.base?.opponentTeamName
      || "";
    if (home && away) return `${home} vs ${away}`;
    if (home || away) return [home, away].filter(Boolean).join(" vs ");
    return null;
  }, [
    isTournamentMatchHeader,
    spectatorHeaderMeta?.home?.teamName,
    spectatorHeaderMeta?.away?.teamName,
    spectatorGame?.base?.teamName,
    spectatorGame?.base?.opponentTeamName,
  ]);

  if (loading)
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: isDark ? T.bg : "#F3F4F6" }}
      >
        <ActivityIndicator size="large" color={isDark ? T.refresh : "#081126"} />
        <Text
          style={{
            marginTop: 16,
            color: isDark ? T.text : "#081126",
            fontSize: 14,
            fontWeight: "600",
            textAlign: "center",
            paddingHorizontal: 32,
            opacity: isDark ? 0.85 : 0.75,
          }}
        >
          {loadingQuote}
        </Text>
      </View>
    );

  if (!team)
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: isDark ? T.bg : "#F3F4F6" }}
      >
        <Ionicons name="alert-circle-outline" size={60} color={isDark ? T.textMuted : "#D1D5DB"} />
        <Text
          className="text-gray-400 text-lg mt-4"
          style={isDark ? { color: T.textMuted } : undefined}
        >
          Team not found
        </Text>
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo)}
          className="mt-4 px-6 py-3 rounded-xl"
          style={{
            backgroundColor: isDark ? T.surfaceAlt : "#111827",
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? T.border : undefined,
          }}
        >
          <Text
            className="font-bold"
            style={{ color: isDark ? T.text : "#fff" }}
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );

  const tabs = isExternalViewer
    ? [
        { id: "STATS", label: "Stats", icon: "bar-chart-outline" },
        { id: "LIVE", label: "Live", icon: "videocam-outline" },
        { id: "TEAM", label: "Team", icon: "people-outline" },
        { id: "POSTS", label: "Media", icon: "images-outline" },
      ]
    : [
        { id: "HOME", label: "Home", icon: "home-outline" },
        { id: "TEAM", label: "Team", icon: "people-outline" },
        { id: "SCHEDULE", label: "Schedule", icon: "calendar-outline" },
        { id: "STATS", label: "Stats", icon: "bar-chart-outline" },
        { id: "LIVE", label: "Live", icon: "videocam-outline" },
      ];
  if (!isExternalViewer) {
    if (isOwner) tabs.push({ id: "OPPONENTS", label: "Opponents", icon: "flag-outline" });
    tabs.push(
      { id: "MESSAGES", label: "Messages", icon: "chatbubble-outline" },
      { id: "POSTS", label: "Media", icon: "images-outline" },
      { id: "ASSIGNMENTS", label: isOwner ? "Assign" : "Assignments", icon: "clipboard-outline" },
      { id: "AVAILABILITY", label: "RSVP", icon: "checkmark-done-outline" },
    );
  }

  const sportIcon = sportIcons[team.sport] || defaultIcon;

  const renderTab = () => {
    switch (activeTab) {
      case "HOME":
        return (
          <HomeTab
            team={team}
            players={players}
            schedules={schedules}
            games={games}
            isOwner={isOwner}
            onTabChange={setActiveTab}
            onSetGameId={setCurrentGameId}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        );
      case "TEAM":
        return (
          <TeamTab
            team={team}
            players={players}
            isOwner={isOwner}
            isTeamOwner={isTeamOwner}
            teamId={teamId}
            onRefresh={fetchAll}
            refreshing={refreshing}
            pullRefresh={onRefresh}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            opponentTeamId={opponentTeamId}
          />
        );
      case "SCHEDULE":
        return (
          <ScheduleTab
            schedules={schedules}
            isOwner={isOwner}
            teamId={teamId}
            onRefresh={onRefresh}
            refreshing={refreshing}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            opponentTeamId={opponentTeamId}
            onScheduleDeleted={(id) => pendingDeletedScheduleIds.current.add(String(id))}
          />
        );
      case "STATS":
        return currentGameId ? (
          <GameScreen
            gameId={currentGameId}
            teamId={teamId}
            team={team}
            isOwner={isOwner}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            rosterByTeamId={rosterByTeamId}
            viewOnly={isSpectate}
            hideEmbeddedScoreboard={isSpectate}
            forceTournamentScorer={isTournamentScorer}
            onBack={
              isSpectate
                ? () => goBackTo(router, backTo)
                : () => {
                    setCurrentGameId(null);
                    setActiveTab("HOME");
                  }
            }
          />
        ) : (
          <StatsTab
            games={games}
            team={team}
            players={players}
            isOwner={isOwner}
            onSelectGame={(gId) => setCurrentGameId(gId)}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        );
      case "OPPONENTS":
        return (
          <OpponentsTab team={team} teamId={teamId} onRefresh={fetchAll} refreshing={refreshing} pullRefresh={onRefresh} onOpponentAdded={() => setActiveTab("HOME")} />
        );
      case "MESSAGES":
        return <MessagesTab teamId={teamId} isSelfOwnedOpponent={isSelfOwnedOpponent} opponentTeamId={opponentTeamId} />;
      case "POSTS":
        return (
          <PostsTab
            teamId={teamId}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            opponentTeamId={opponentTeamId}
            mergeOpponentMedia={isSelfOwnedOpponent || useTournamentBothTeams}
            refreshKey={postsRefreshKey}
            canUpload={!isExternalViewer}
          />
        );
      case "ASSIGNMENTS":
        return (
          <AssignmentsTab
            teamId={teamId}
            teamName={team?.teamName}
            teamSport={team?.sport}
            players={players}
            schedules={schedules}
            isOwner={isOwner}
            refreshing={refreshing}
            onRefresh={onRefresh}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            opponentTeamId={opponentTeamId}
          />
        );
      case "AVAILABILITY":
        return (
          <AvailabilityTab
            teamId={teamId}
            players={players}
            isOwner={isOwner}
            schedules={schedules}
            refreshing={refreshing}
            onRefresh={onRefresh}
            isSelfOwnedOpponent={isSelfOwnedOpponent}
            opponentTeamId={opponentTeamId}
          />
        );
      case "LIVE":
        return (
          <LiveStreamTab
            team={team}
            canBroadcast={isOwner}
            currentGame={currentGameId ? { base: { _id: currentGameId } } : null}
            onStreamEnded={() => setPostsRefreshKey((k) => k + 1)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? T.bg : "#F3F4F6" }}
    >
      {/* Header */}
      {isSpectate && currentGameId ? (
        <View style={{ backgroundColor: "#0B1324" }}>
          <SpectatorMatchHeader
            game={spectatorGame}
            teamMeta={spectatorHeaderMeta}
            onBack={() => goBackTo(router, backTo)}
            topInset={insets.top}
          />
          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12, paddingTop: 4 }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id);
                    requestAnimationFrame(() => scrollToActiveTab(tab.id));
                  }}
                  onLayout={(e) => {
                    tabLayouts.current[tab.id] = e.nativeEvent.layout.x;
                    if (tab.id === activeTab) scrollToActiveTab(tab.id);
                  }}
                  className="flex-row items-center gap-1.5 px-4 py-2 rounded-sm"
                  style={{ backgroundColor: isActive ? "#9AEA62" : "rgba(255,255,255,0.08)" }}
                >
                  <Ionicons name={tab.icon} size={15} color={isActive ? "#081126" : "#9CA3AF"} />
                  <Text
                    style={{
                      color: isActive ? "#081126" : "#9CA3AF",
                      fontWeight: isActive ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
      <View style={{ paddingTop: insets.top }} className="bg-[#081126]">
        <View className="flex-row items-center px-4 py-7">
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo)}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <Image source={sportIcon} className="w-10 h-10 mr-3" resizeMode="contain" />
          <View className="flex-1">
            <Text className="text-white font-bold text-lg" numberOfLines={1}>
              {tournamentMatchTitle || team.teamName}
            </Text>
            <Text className="text-gray-400 text-xs">
              {tournamentMatchTitle
                ? `${team.sport} \u2022 Tournament`
                : `${team.sport} \u2022 ${team.teamType || "Team"}`}
            </Text>
            {!tournamentMatchTitle ? (
              <MarqueeText
                style={{ color: "#9CA3AF", fontSize: 11 }}
                containerStyle={{ flex: 1 }}
              >
                {team.location || "No location"}
              </MarqueeText>
            ) : null}
          </View>
          {isExternalViewer ? (
            <View className="bg-white/15 px-2.5 py-1 rounded-full">
              <Text className="text-white text-[10px] font-bold">SPECTATOR</Text>
            </View>
          ) : isTournamentScorer ? (
            <View className="bg-[#9AEA62] px-2.5 py-1 rounded-full">
              <Text className="text-[#081126] text-[10px] font-bold">SCORER</Text>
            </View>
          ) : isOwner ? (
            <View className="bg-[#9AEA62] px-2.5 py-1 rounded-full">
              <Text className="text-[#081126] text-[10px] font-bold">COACH</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/help-center",
                params: {
                  teamId,
                  sport: team?.sport,
                  screen: "team",
                  role: isExternalViewer ? "spectator" : isOwner ? "owner" : "player",
                  backTo: backTo || `/team/${teamId}`,
                },
              })
            }
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center ml-2"
          >
            <Ionicons name="help-circle-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  requestAnimationFrame(() => scrollToActiveTab(tab.id));
                }}
                onLayout={(e) => {
                  tabLayouts.current[tab.id] = e.nativeEvent.layout.x;
                  // If this is the active tab, scroll to it now that we have its position
                  if (tab.id === activeTab) scrollToActiveTab(tab.id);
                }}
                className="flex-row items-center gap-1.5 px-4 py-2 rounded-sm"
                style={{ backgroundColor: isActive ? "#9AEA62" : "rgba(255,255,255,0.08)" }}
              >
                <Ionicons name={tab.icon} size={15} color={isActive ? "#081126" : "#9CA3AF"} />
                <Text
                  style={{
                    color: isActive ? "#081126" : "#9CA3AF",
                    fontWeight: isActive ? "700" : "500",
                    fontSize: 13,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      )}

      {/* Content — each tab owns its own ScrollView + RefreshControl */}
      <View className="flex-1">{renderTab()}</View>

      {/* ── Assignment notification banner ── */}
      {assignmentBanner && (
        <Animated.View
          style={{
            position: "absolute",
            top: insets.top + 56,
            left: 16,
            right: 16,
            transform: [{ translateY: bannerAnim }],
            zIndex: 999,
          }}
        >
          <View
            style={{
              backgroundColor: "#081126",
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 8,
              borderWidth: 1,
              borderColor: "#B7FF57",
            }}
          >
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: "#B7FF5722",
                alignItems: "center", justifyContent: "center", marginRight: 10,
              }}
            >
              <Ionicons name="clipboard-outline" size={18} color="#B7FF57" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#B7FF57", fontWeight: "700", fontSize: 11, marginBottom: 1 }}>NEW ASSIGNMENT</Text>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                {assignmentBanner.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { dismissBanner(); setActiveTab("ASSIGNMENTS"); }}
              style={{
                backgroundColor: "#B7FF57", borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8,
              }}
            >
              <Text style={{ color: "#081126", fontWeight: "700", fontSize: 12 }}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissBanner} style={{ padding: 6, marginLeft: 4 }}>
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
