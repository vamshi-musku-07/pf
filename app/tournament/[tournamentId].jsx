import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from "react-native";
import LightOnDarkStatusBar from "@/components/LightOnDarkStatusBar";
import TournamentCricketLoader from "@/components/tournament/TournamentCricketLoader";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackTo } from "@/lib/navigationBack";
import { showToast } from "@/context/ToastContext";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { shareTournamentLink } from "@/lib/shareLinks";
import {
  getTournamentByIdAPI,
  enrollTeamsAPI,
  inviteTeamsToTournamentAPI,
  cancelTournamentInviteAPI,
  removeTournamentTeamAPI,
  generateFixturesAPI,
  createTournamentFixtureAPI,
  deleteTournamentFixtureAPI,
  publishLeagueFixturesAPI,
  fillDivisionRoundRobinAPI,
  getKnockoutRemainingAPI,
  publishKnockoutRoundAPI,
  notifyCoachesScheduleAPI,
  createFixtureGameAPI,
  setFixtureResultAPI,
  deleteTournamentAPI,
  updateTournamentAPI,
  updateFixtureAPI,
  addTournamentAdminAPI,
  removeTournamentAdminAPI,
  createTournamentDivisionAPI,
  updateTournamentDivisionAPI,
  deleteTournamentDivisionAPI,
  assignTeamDivisionAPI,
  assignDivisionTeamsAPI,
  getTournamentLeaderboardAPI,
  approveTournamentJoinRequestAPI,
  rejectTournamentJoinRequestAPI,
  createTournamentJoinRequestAPI,
} from "@/services/TournamentApi";
import { getTeamsAPI, getOpponentsAPI } from "@/services/TeamApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { extractPlayersFromApiResponse, mergeRosterLists } from "@/lib/playerRoster";
import { getUsersByIdsAPI, getUserByEmailAPI } from "@/services/AuthApi";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import TournamentTeamSearchRow from "@/components/tournament/TournamentTeamSearchRow";
import {
  describeTeamForConfirm,
  hasDuplicateTeamNames,
} from "@/components/tournament/teamInviteSearch";
import { generateTournamentExplainerAPI } from "@/services/ChatbotApi";
import {
  TABS,
  formatLabelForSport,
  formatDateRange,
  ballsToOversLabel,
  pickDefaultDivisionId,
  standingsForDivision,
  filterLeagueFixturesByDivision,
  buildMatchLiveScopeFixtures,
  sortDivisions,
  formatDivisionDisplayName,
  divisionCopy,
} from "@/features/tournament/helpers";
import DivisionPicker from "./tabs/DivisionPicker";
import StandingsTab from "./tabs/StandingsTab";
import MatchesTab from "./tabs/MatchesTab";
import TeamsTab from "./tabs/TeamsTab";
import BracketTab from "./tabs/BracketTab";
import LeaderboardTab from "./tabs/LeaderboardTab";
import StatsTab from "./tabs/StatsTab";
import ManageTab from "./tabs/ManageTab";
import DivisionAdminSheet from "./tabs/DivisionAdminSheet";
import JoinRequestDetailSheet from "./tabs/JoinRequestDetailSheet";
import FixturePairingSheet from "./tabs/FixturePairingSheet";
import KnockoutRoundPairingSheet from "./tabs/KnockoutRoundPairingSheet";
import ScheduleNotifySheet from "./tabs/ScheduleNotifySheet";
import EditTournamentSheet from "./tabs/EditTournamentSheet";
import AdminsSheet from "./tabs/AdminsSheet";
import ScheduleFixtureSheet from "./tabs/ScheduleFixtureSheet";
import {
  buildTournamentPlayerNameMap,
  buildTournamentPlayerProfileMap,
  buildNameMapFromLeaderboard,
  buildProfileMapFromLeaderboard,
  mergePlayerNameMaps,
  mergeProfileMaps,
} from "@/features/tournament/leaderboardConfig";
import { canUseSuperOver, canUsePenalties } from "@/features/tournament/manageConfig";
import { tournamentShareCode } from "@/features/tournament/publicConfig";

export default function TournamentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { isSignedIn, isLoaded: authLoaded } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const pageBg = isDark ? T.bg : "#F0F4F8";
  const id = Array.isArray(params.tournamentId) ? params.tournamentId[0] : params.tournamentId;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const hintTeamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const openInviteOnLoad = params.invite === "1" || params.invite === "true";

  useEffect(() => {
    if (!id || !authLoaded || isSignedIn) return;
    router.replace({
      pathname: `/tournament/public/${id}`,
      params: { backTo: backTo || "/tournament" },
    });
  }, [id, authLoaded, isSignedIn, backTo, router]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("Standings");
  const [busy, setBusy] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteCity, setInviteCity] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [ownerProfiles, setOwnerProfiles] = useState({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const searchTimer = useRef(null);
  const inviteOpenedRef = useRef(false);

  const [myTeamOpen, setMyTeamOpen] = useState(false);
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinTeams, setJoinTeams] = useState([]);
  const [selectedJoinTeamIds, setSelectedJoinTeamIds] = useState([]);
  const [joinRequestDetail, setJoinRequestDetail] = useState(null);
  const [joinRequestAction, setJoinRequestAction] = useState(null); // { id, type: 'approve'|'reject' }
  const [fixturePairingOpen, setFixturePairingOpen] = useState(false);
  const [scheduleNotifyOpen, setScheduleNotifyOpen] = useState(false);
  const [knockoutPairingOpen, setKnockoutPairingOpen] = useState(false);
  const [knockoutRemaining, setKnockoutRemaining] = useState(null);

  const [resultFixture, setResultFixture] = useState(null);
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [manualHomeRuns, setManualHomeRuns] = useState("");
  const [manualAwayRuns, setManualAwayRuns] = useState("");
  const [manualHomeWickets, setManualHomeWickets] = useState("");
  const [manualAwayWickets, setManualAwayWickets] = useState("");
  const [manualHomeOvers, setManualHomeOvers] = useState("");
  const [manualAwayOvers, setManualAwayOvers] = useState("");
  const [manualHomeGoals, setManualHomeGoals] = useState("");
  const [manualAwayGoals, setManualAwayGoals] = useState("");
  const [manualHomePens, setManualHomePens] = useState("");
  const [manualAwayPens, setManualAwayPens] = useState("");
  const [penaltiesWin, setPenaltiesWin] = useState(false);

  const [explainerOpen, setExplainerOpen] = useState(false);
  const [explainerText, setExplainerText] = useState("");
  const [explainerLoading, setExplainerLoading] = useState(false);
  const [explainerTeamName, setExplainerTeamName] = useState("");

  const [divisionSheet, setDivisionSheet] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminProfiles, setAdminProfiles] = useState({});
  const [scheduleFixture, setScheduleFixture] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [superOverWin, setSuperOverWin] = useState(false);

  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerNameMap, setPlayerNameMap] = useState({});
  const [playerProfileMap, setPlayerProfileMap] = useState({});

  const tournament = data?.tournament;
  const allFixtures = data?.fixtures || [];
  const isAdmin = !!data?.isAdmin;
  const isOwner = !!data?.isOwner;
  const pendingInvites = data?.pendingInvites || [];
  const joinRequests = data?.joinRequests || [];
  const divisions = tournament?.divisions || [];
  const hasMultipleDivisions = divisions.length > 1;

  useEffect(() => {
    if (!tournament || selectedDivisionId) return;
    setSelectedDivisionId(pickDefaultDivisionId(tournament, hintTeamId));
  }, [tournament, hintTeamId, selectedDivisionId]);

  const divisionStandings = useMemo(
    () => standingsForDivision(data, selectedDivisionId),
    [data, selectedDivisionId],
  );

  const divisionLeagueFixtures = useMemo(
    () => filterLeagueFixturesByDivision(allFixtures, selectedDivisionId),
    [allFixtures, selectedDivisionId],
  );

  const matchLiveScopeFixtures = useMemo(
    () =>
      buildMatchLiveScopeFixtures(
        tournament?.format === "knockout" ? allFixtures : divisionLeagueFixtures,
        allFixtures,
        tournament?.format,
      ),
    [allFixtures, divisionLeagueFixtures, tournament?.format],
  );

  const standingsFixtures = divisionLeagueFixtures;

  const divisionTeams = useMemo(() => {
    if (!hasMultipleDivisions || !selectedDivisionId) return tournament?.teams || [];
    return (tournament?.teams || []).filter(
      (t) => String(t.divisionId || "main") === String(selectedDivisionId),
    );
  }, [tournament?.teams, hasMultipleDivisions, selectedDivisionId]);

  const teamCounts = useMemo(() => {
    const counts = {};
    for (const div of sortDivisions(divisions)) {
      counts[div.id] = (div.teamIds || []).length;
    }
    return counts;
  }, [divisions]);

  const showDivisionPicker =
    hasMultipleDivisions &&
    (tab === "Standings" ||
      tab === "Matches" ||
      tab === "Teams" ||
      tab === "Leaderboard" ||
      tab === "Stats");

  const statsTabsActive = tab === "Leaderboard" || tab === "Stats";

  const rosterTeamIds = useMemo(() => {
    const ids = new Set();
    const scopeId = hasMultipleDivisions ? selectedDivisionId : null;
    for (const team of tournament?.teams || []) {
      if (scopeId && String(team.divisionId || "main") !== String(scopeId)) continue;
      if (team.teamId) ids.add(String(team.teamId));
    }
    return [...ids];
  }, [tournament?.teams, hasMultipleDivisions, selectedDivisionId]);

  const effectivePlayerNameMap = useMemo(
    () => mergePlayerNameMaps(buildNameMapFromLeaderboard(leaderboard), playerNameMap),
    [leaderboard, playerNameMap],
  );

  const effectivePlayerProfileMap = useMemo(
    () => mergeProfileMaps(buildProfileMapFromLeaderboard(leaderboard), playerProfileMap),
    [leaderboard, playerProfileMap],
  );

  const excludedTeamIds = useCallback(() => {
    const ids = new Set();
    (tournament?.teams || []).forEach((t) => ids.add(String(t.teamId)));
    pendingInvites.forEach((inv) => ids.add(String(inv.teamId)));
    return ids;
  }, [tournament?.teams, pendingInvites]);

  const fetchDetail = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await getTournamentByIdAPI(id);
      setData(res?.data || null);
    } catch {
      showToast("Failed to load tournament", "error");
    } finally {
      setLoading(false);
    }
  }, [id, isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return undefined;
      fetchDetail();
    }, [fetchDetail, isSignedIn]),
  );

  useEffect(() => {
    if (tab !== "Matches" && tab !== "Bracket") return undefined;
    const interval = setInterval(() => {
      fetchDetail();
    }, 15000);
    return () => clearInterval(interval);
  }, [tab, fetchDetail, isSignedIn]);

  useEffect(() => {
    if (!id || !statsTabsActive) return undefined;
    let cancelled = false;
    setLeaderboardLoading(true);
    (async () => {
      try {
        const divisionQuery = hasMultipleDivisions ? selectedDivisionId : undefined;
        const res = await getTournamentLeaderboardAPI(id, divisionQuery);
        if (!cancelled) setLeaderboard(res?.data || res || null);
      } catch {
        if (!cancelled) {
          setLeaderboard(null);
          showToast("Failed to load leaderboard", "error");
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, statsTabsActive, hasMultipleDivisions, selectedDivisionId]);

  useEffect(() => {
    if (!statsTabsActive || !rosterTeamIds.length) {
      setPlayerNameMap({});
      setPlayerProfileMap({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(rosterTeamIds.map((teamId) => getPlayersByTeamAPI(teamId)));
      if (cancelled) return;
      const rosters = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => extractPlayersFromApiResponse(r.value));
      const mergedRoster = mergeRosterLists(...rosters);
      setPlayerNameMap(buildTournamentPlayerNameMap(mergedRoster));
      setPlayerProfileMap(buildTournamentPlayerProfileMap(mergedRoster));
    })();
    return () => {
      cancelled = true;
    };
  }, [statsTabsActive, rosterTeamIds.join(",")]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetail();
    if (statsTabsActive) {
      try {
        const divisionQuery = hasMultipleDivisions ? selectedDivisionId : undefined;
        const res = await getTournamentLeaderboardAPI(id, divisionQuery);
        setLeaderboard(res?.data || res || null);
      } catch {
        showToast("Failed to refresh leaderboard", "error");
      }
    }
    setRefreshing(false);
  }, [fetchDetail, statsTabsActive, hasMultipleDivisions, selectedDivisionId, id]);

  const openResultModal = (fixture) => {
    setManualHomeRuns(fixture?.result?.home?.runs != null ? String(fixture.result.home.runs) : "");
    setManualAwayRuns(fixture?.result?.away?.runs != null ? String(fixture.result.away.runs) : "");
    setManualHomeWickets(fixture?.result?.home?.wickets != null ? String(fixture.result.home.wickets) : "");
    setManualAwayWickets(fixture?.result?.away?.wickets != null ? String(fixture.result.away.wickets) : "");
    setManualHomeOvers(ballsToOversLabel(fixture?.result?.home?.balls));
    setManualAwayOvers(ballsToOversLabel(fixture?.result?.away?.balls));
    setManualHomeGoals(fixture?.result?.home?.goals != null ? String(fixture.result.home.goals) : "");
    setManualAwayGoals(fixture?.result?.away?.goals != null ? String(fixture.result.away.goals) : "");
    setManualHomePens(fixture?.result?.home?.pens != null ? String(fixture.result.home.pens) : "");
    setManualAwayPens(fixture?.result?.away?.pens != null ? String(fixture.result.away.pens) : "");
    setSuperOverWin(fixture?.result?.method === "super_over");
    setPenaltiesWin(fixture?.result?.method === "penalties" || fixture?.result?.decidedBy === "penalties");
    setResultFixture(fixture);
  };

  const closeResultModal = () => {
    if (resultSubmitting) return;
    setResultFixture(null);
  };

  const loadOwnerProfiles = useCallback(async (teams) => {
    const ids = [...new Set((teams || []).map((t) => t?.createdBy).filter(Boolean).map(String))];
    if (!ids.length) {
      setOwnerProfiles({});
      return;
    }
    try {
      const res = await getUsersByIdsAPI(ids);
      setOwnerProfiles(res?.data || res || {});
    } catch {
      setOwnerProfiles({});
    }
  }, []);

  const searchTeams = useCallback(
    async (query, city) => {
      const q = (query || "").trim();
      if (q.length < 2) {
        setSearchResults([]);
        setOwnerProfiles({});
        return;
      }
      setSearchLoading(true);
      try {
        const searchParams = {
          search: q,
          sport: tournament?.sport || "Cricket",
          page: 1,
          limit: 25,
        };
        if (city?.trim()) searchParams.city = city.trim();
        const res = await getOpponentsAPI(searchParams);
        const list = res?.data || res?.opponents || res?.teams || [];
        const blocked = excludedTeamIds();
        const filtered = (Array.isArray(list) ? list : []).filter((t) => t?._id && !blocked.has(String(t._id)));
        setSearchResults(filtered);
        await loadOwnerProfiles(filtered);
      } catch {
        setSearchResults([]);
        setOwnerProfiles({});
      } finally {
        setSearchLoading(false);
      }
    },
    [tournament?.sport, excludedTeamIds, loadOwnerProfiles],
  );

  const openInvite = () => {
    setInviteSearch("");
    setInviteCity("");
    setInviteMessage("");
    setSearchResults([]);
    setOwnerProfiles({});
    setSelectedTeamIds([]);
    setInviteOpen(true);
  };

  useEffect(() => {
    if (!inviteOpen) return undefined;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchTeams(inviteSearch, inviteCity), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [inviteSearch, inviteCity, inviteOpen, searchTeams]);

  useEffect(() => {
    if (!openInviteOnLoad || inviteOpenedRef.current || !isAdmin || !tournament) return;
    inviteOpenedRef.current = true;
    setTab("Manage");
    openInvite();
  }, [openInviteOnLoad, isAdmin, tournament]);

  const confirmInvite = () => {
    if (!selectedTeamIds.length) {
      showToast("Select at least one team", "warning");
      return;
    }
    const selected = searchResults.filter((t) => selectedTeamIds.includes(t._id));
    const summary = selected
      .map((t) => describeTeamForConfirm(t, ownerProfiles[String(t.createdBy)]))
      .join("\n\n");

    Alert.alert(
      "Send invitations?",
      `Confirm these are the correct teams (check manager & team code):\n\n${summary}`,
      [
        { text: "Review", style: "cancel" },
        {
          text: "Send invites",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await inviteTeamsToTournamentAPI(id, selectedTeamIds, inviteMessage.trim() || undefined);
              await fetchDetail();
              setInviteOpen(false);
              showToast(res?.message || "Invitations sent", "success");
            } catch (error) {
              showToast(error?.response?.data?.error || "Failed to send invitations", "error");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelInvite = (teamId, teamName) => {
    Alert.alert("Cancel invitation?", `Withdraw the invite sent to ${teamName}?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel invite",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelTournamentInviteAPI(id, teamId);
            await fetchDetail();
            showToast("Invitation cancelled", "success");
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to cancel", "error");
          }
        },
      },
    ]);
  };

  const openMyTeams = async () => {
    try {
      const res = await getTeamsAPI({ limit: 100 });
      const teams = res?.data || res?.teams || res || [];
      const blocked = excludedTeamIds();
      const available = (Array.isArray(teams) ? teams : []).filter(
        (t) => !blocked.has(String(t._id)) && (t.sport === tournament?.sport || !tournament?.sport),
      );
      setOwnedTeams(available);
      setSelectedTeamIds([]);
      setMyTeamOpen(true);
    } catch {
      showToast("Failed to load your teams", "error");
    }
  };

  const confirmEnrollMyTeam = async () => {
    if (!selectedTeamIds.length) {
      setMyTeamOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await enrollTeamsAPI(id, selectedTeamIds, selectedDivisionId || undefined);
      setData((d) => ({ ...d, tournament: res?.data }));
      setMyTeamOpen(false);
      showToast("Your team added", "success");
      await fetchDetail();
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to add team", "error");
    } finally {
      setBusy(false);
    }
  };

  const closeDivisionSheet = () => {
    if (busy) return;
    setDivisionSheet(null);
  };

  const openCreateDivision = () => setDivisionSheet({ mode: "create" });
  const openRenameDivision = (division) => setDivisionSheet({ mode: "rename", division });
  const openDeleteDivision = (division) => setDivisionSheet({ mode: "delete", division });
  const openMoveTeam = (team) => setDivisionSheet({ mode: "moveTeam", team });
  const openBulkMoveTeams = (teamIds) => {
    const ids = (teamIds || []).map(String).filter(Boolean);
    if (!ids.length) return;
    setDivisionSheet({ mode: "moveTeams", teamIds: ids });
  };

  const handleDivisionSheetConfirm = async (payload) => {
    if (!divisionSheet) return;
    const unit = divisionCopy(tournament?.sport).singular;
    setBusy(true);
    try {
      if (divisionSheet.mode === "create") {
        await createTournamentDivisionAPI(id, payload);
        showToast(`${unit} added`, "success");
      } else if (divisionSheet.mode === "rename") {
        if (!payload.name) {
          showToast(`${unit} name is required`, "warning");
          return;
        }
        await updateTournamentDivisionAPI(id, divisionSheet.division.id, payload);
        showToast(`${unit} renamed`, "success");
      } else if (divisionSheet.mode === "delete") {
        await deleteTournamentDivisionAPI(id, divisionSheet.division.id, payload.reassignTo);
        if (String(selectedDivisionId) === String(divisionSheet.division.id)) {
          setSelectedDivisionId(null);
        }
        showToast(`${unit} deleted`, "success");
      } else if (divisionSheet.mode === "moveTeam") {
        await assignTeamDivisionAPI(id, divisionSheet.team.teamId, payload.divisionId);
        showToast("Team moved", "success");
      } else if (divisionSheet.mode === "moveTeams") {
        const ids = payload.teamIds || divisionSheet.teamIds || [];
        await assignDivisionTeamsAPI(id, payload.divisionId, ids);
        showToast(`${ids.length} team${ids.length === 1 ? "" : "s"} moved`, "success");
      }
      setDivisionSheet(null);
      await fetchDetail();
    } catch (error) {
      showToast(error?.response?.data?.error || `${unit} update failed`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveTeam = (teamId) => {
    Alert.alert("Remove team", "Remove this team from the tournament?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await removeTournamentTeamAPI(id, teamId);
            setData((d) => ({ ...d, tournament: res?.data }));
            await fetchDetail();
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to remove", "error");
          }
        },
      },
    ]);
  };

  const enrolledTeamIds = useMemo(
    () => new Set((tournament?.teams || []).map((t) => String(t.teamId))),
    [tournament?.teams],
  );
  const joinableOwnedTeams = useMemo(
    () => (joinTeams || []).filter((t) => !enrolledTeamIds.has(String(t._id || t.id))),
    [joinTeams, enrolledTeamIds],
  );
  const showRequestJoin = !isAdmin && !!tournament && !tournament.fixturesGenerated;

  const toggleJoinTeam = (teamId) => {
    const tid = String(teamId);
    setSelectedJoinTeamIds((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid],
    );
  };

  const openJoinRequestSheet = async () => {
    if (!showRequestJoin || joinBusy) return;
    setJoinBusy(true);
    try {
      const res = await getTeamsAPI({ limit: 100 });
      const list = res?.data || res?.teams || res || [];
      const teams = Array.isArray(list) ? list : [];
      const available = teams.filter((t) => !enrolledTeamIds.has(String(t._id || t.id)));
      setJoinTeams(teams);
      if (!available.length) {
        showToast("Create a team you own, or this team is already enrolled", "warning");
        return;
      }
      setSelectedJoinTeamIds(
        available.length === 1 ? [String(available[0]._id || available[0].id)] : [],
      );
      setJoinOpen(true);
    } catch {
      showToast("Failed to load your teams", "error");
    } finally {
      setJoinBusy(false);
    }
  };

  const submitJoinRequest = async () => {
    if (!selectedJoinTeamIds.length || !id) return;
    setJoinBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedJoinTeamIds.map((teamId) => createTournamentJoinRequestAPI(id, teamId)),
      );
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - okCount;
      setJoinOpen(false);
      setSelectedJoinTeamIds([]);
      if (okCount && !failCount) {
        showToast(
          okCount === 1
            ? "Join request sent — wait for organizer approval"
            : `${okCount} join requests sent — wait for organizer approval`,
          "success",
        );
      } else if (okCount && failCount) {
        showToast(`${okCount} sent, ${failCount} failed`, "warning");
      } else {
        const firstErr = results.find((r) => r.status === "rejected")?.reason;
        showToast(firstErr?.response?.data?.error || "Could not send join request", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.error || "Could not send join request", "error");
    } finally {
      setJoinBusy(false);
    }
  };

  const handleApproveJoinRequest = async (req) => {
    if (!req?._id || joinRequestAction) return;
    setJoinRequestAction({ id: String(req._id), type: "approve" });
    try {
      await approveTournamentJoinRequestAPI(id, req._id);
      showToast(`${req.teamName || "Team"} enrolled`, "success");
      setJoinRequestDetail(null);
      await fetchDetail();
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to approve", "error");
    } finally {
      setJoinRequestAction(null);
    }
  };

  const handleRejectJoinRequest = (req) => {
    if (!req?._id || joinRequestAction) return;
    Alert.alert("Reject request", `Decline ${req.teamName || "this team"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setJoinRequestAction({ id: String(req._id), type: "reject" });
          try {
            await rejectTournamentJoinRequestAPI(id, req._id);
            showToast("Join request rejected", "success");
            setJoinRequestDetail(null);
            await fetchDetail();
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to reject", "error");
          } finally {
            setJoinRequestAction(null);
          }
        },
      },
    ]);
  };

  const handleGenerateFixtures = async () => {
    setBusy(true);
    try {
      await generateFixturesAPI(id);
      await fetchDetail();
      setFixturePairingOpen(false);
      setTab("Matches");
      showToast("Fixtures auto-filled and published", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to generate fixtures", "error");
    } finally {
      setBusy(false);
    }
  };

  const openFixturePairing = () => {
    if (tournament?.format === "knockout") {
      openKnockoutPairing();
      return;
    }
    setFixturePairingOpen(true);
  };

  const refreshKnockoutRemaining = async () => {
    try {
      const res = await getKnockoutRemainingAPI(id);
      setKnockoutRemaining(res?.data || res || null);
    } catch (error) {
      setKnockoutRemaining({
        open: false,
        reason: "error",
        error: error?.response?.data?.error || "Failed to load remaining teams",
        teams: [],
        teamIds: [],
      });
    }
  };

  const openKnockoutPairing = async () => {
    setKnockoutPairingOpen(true);
    await refreshKnockoutRemaining();
  };

  const handleAddLeagueMatch = async ({ homeTeamId, awayTeamId, divisionId }) => {
    setBusy(true);
    try {
      await createTournamentFixtureAPI(id, { homeTeamId, awayTeamId, divisionId, stage: "league" });
      await fetchDetail();
      showToast("Match added", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to add match", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLeagueMatch = async (fx) => {
    if (!fx?._id) return;
    setBusy(true);
    try {
      await deleteTournamentFixtureAPI(id, fx._id);
      await fetchDetail();
      showToast("Match removed", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to remove match", "error");
    } finally {
      setBusy(false);
    }
  };

  const handlePublishLeagueFixtures = async () => {
    setBusy(true);
    try {
      const res = await publishLeagueFixturesAPI(id);
      await fetchDetail();
      setFixturePairingOpen(false);
      setTab("Matches");
      showToast(res?.message || "Fixtures published", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to publish fixtures", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleNotifyCoaches = async (payload = {}) => {
    setBusy(true);
    try {
      const res = await notifyCoachesScheduleAPI(id, payload);
      setScheduleNotifyOpen(false);
      showToast(
        res?.message ||
          "Schedule is being emailed to coaches. You'll get a notification when it's done.",
        "success",
      );
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to email coaches", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleFillDivisionRoundRobin = async ({ divisionId } = {}) => {
    setBusy(true);
    try {
      const res = await fillDivisionRoundRobinAPI(id, divisionId);
      await fetchDetail();
      showToast(res?.message || "Round-robin matches added", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to fill matches", "error");
    } finally {
      setBusy(false);
    }
  };

  const handlePublishKnockoutRound = async (payload) => {
    setBusy(true);
    try {
      const res = await publishKnockoutRoundAPI(id, payload);
      await fetchDetail();
      setKnockoutPairingOpen(false);
      setTab("Bracket");
      showToast(res?.message || "Knockout round published", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to publish round", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateNextStage = async () => {
    openKnockoutPairing();
  };

  const startMatch = async (fixture) => {
    setBusy(true);
    try {
      const res = await createFixtureGameAPI(id, fixture._id);
      const gameId = res?.data?.gameId;
      await fetchDetail();
      if (gameId) {
        router.push({
          pathname: `/team/${fixture.homeTeamId}`,
          params: {
            initialTab: "STATS",
            gameId: String(gameId),
            backTo: `/tournament/${id}`,
            tournamentScorer: "1",
          },
        });
      }
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to start match", "error");
    } finally {
      setBusy(false);
    }
  };

  const watchLive = (fixture) => {
    if (!fixture.gameId) return;
    router.push({
      pathname: `/team/${fixture.homeTeamId}`,
      params: {
        initialTab: "STATS",
        gameId: String(fixture.gameId),
        spectate: "1",
        backTo: `/tournament/${id}`,
      },
    });
  };

  const openGame = async (fixture) => {
    if (!fixture.gameId) return;
    setBusy(true);
    try {
      // Ensures sport-specific game exists (repairs volleyball fixtures that only got a CricketGame).
      const res = await createFixtureGameAPI(id, fixture._id);
      const gameId = res?.data?.gameId || fixture.gameId;
      await fetchDetail();
      router.push({
        pathname: `/team/${fixture.homeTeamId}`,
        params: {
          initialTab: "STATS",
          gameId: String(gameId),
          backTo: `/tournament/${id}`,
          tournamentScorer: "1",
        },
      });
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to open match", "error");
    } finally {
      setBusy(false);
    }
  };

  const openFixtureFromStandings = (fixture) => {
    if (!fixture?.gameId) return;
    const isLive =
      fixture.gameStatus === "live" ||
      fixture.gameStatus === "halftime" ||
      fixture.status === "live";
    if (isLive && !isAdmin) watchLive(fixture);
    else openGame(fixture);
  };

  const openTeamProfile = (teamId) => {
    if (!teamId) return;
    router.push({
      pathname: `/team/${teamId}`,
      params: { backTo: `/tournament/${id}` },
    });
  };

  const submitResult = async (winnerTeamId, isNoResult) => {
    if (!resultFixture || resultSubmitting) return;
    setResultSubmitting(true);
    setBusy(true);
    try {
      const isFootball = String(tournament?.sport || "").toLowerCase() === "football";
      const useSuperOver = !isFootball && superOverWin && canUseSuperOver(resultFixture, tournament) && winnerTeamId;
      const usePens = isFootball && penaltiesWin && canUsePenalties(resultFixture, tournament) && winnerTeamId;
      const payload = {
        winnerTeamId,
        isNoResult,
        method: useSuperOver ? "super_over" : usePens ? "penalties" : isFootball ? "goals" : "manual",
      };
      const isLeague = resultFixture.stage === "league";
      if (isFootball) {
        if (manualHomeGoals !== "") payload.homeGoals = parseInt(manualHomeGoals, 10);
        if (manualAwayGoals !== "") payload.awayGoals = parseInt(manualAwayGoals, 10);
        if (usePens || manualHomePens !== "" || manualAwayPens !== "") {
          if (manualHomePens !== "") payload.homePens = parseInt(manualHomePens, 10);
          if (manualAwayPens !== "") payload.awayPens = parseInt(manualAwayPens, 10);
        }
      } else if (isLeague) {
        if (manualHomeRuns !== "") payload.homeRuns = parseInt(manualHomeRuns, 10);
        if (manualAwayRuns !== "") payload.awayRuns = parseInt(manualAwayRuns, 10);
        if (manualHomeWickets !== "") payload.homeWickets = parseInt(manualHomeWickets, 10);
        if (manualAwayWickets !== "") payload.awayWickets = parseInt(manualAwayWickets, 10);
        if (manualHomeOvers.trim() !== "") payload.homeOvers = manualHomeOvers.trim();
        if (manualAwayOvers.trim() !== "") payload.awayOvers = manualAwayOvers.trim();
      }
      await setFixtureResultAPI(id, resultFixture._id, payload);
      await fetchDetail();
      setResultFixture(null);
      showToast("Result recorded", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to record result", "error");
    } finally {
      setResultSubmitting(false);
      setBusy(false);
    }
  };

  const handleShare = async () => {
    try {
      await shareTournamentLink({
        name: tournament?.name,
        shareCode: tournamentShareCode(tournament),
        tournamentId: id,
      });
    } catch {
      // user cancelled
    }
  };

  const handleSaveEdit = async (payload) => {
    setEditSaving(true);
    try {
      await updateTournamentAPI(id, payload);
      await fetchDetail();
      setEditOpen(false);
      showToast("Tournament updated", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to update tournament", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const adminIds = useMemo(() => {
    if (!tournament) return [];
    return [String(tournament.createdBy), ...(tournament.admins || []).map(String)];
  }, [tournament?.createdBy, tournament?.admins]);

  useEffect(() => {
    if (!adminsOpen || !adminIds.length) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getUsersByIdsAPI(adminIds);
        if (!cancelled) setAdminProfiles(res?.data || res || {});
      } catch {
        if (!cancelled) setAdminProfiles({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminsOpen, adminIds.join(",")]);

  const handleAddAdminByEmail = async (email) => {
    setAdminBusy(true);
    try {
      const userRes = await getUserByEmailAPI(email);
      const user = userRes?.data || userRes;
      const userId = user?.id || user?._id;
      if (!userId) {
        showToast("No account found with that email", "warning");
        return;
      }
      if (adminIds.includes(String(userId))) {
        showToast("Already an admin", "warning");
        return;
      }
      await addTournamentAdminAPI(id, String(userId));
      await fetchDetail();
      showToast("Co-admin added", "success");
    } catch (error) {
      const status = error?.response?.status;
      showToast(
        status === 404 ? "No account found with that email" : error?.response?.data?.error || "Failed to add admin",
        "error",
      );
    } finally {
      setAdminBusy(false);
    }
  };

  const handleRemoveAdmin = (row) => {
    Alert.alert("Remove co-admin", `Remove ${row.name} as a co-admin?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setAdminBusy(true);
          try {
            await removeTournamentAdminAPI(id, row.userId);
            await fetchDetail();
            showToast("Co-admin removed", "success");
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to remove admin", "error");
          } finally {
            setAdminBusy(false);
          }
        },
      },
    ]);
  };

  const handleSaveSchedule = async (payload) => {
    if (!scheduleFixture) return;
    setScheduleSaving(true);
    try {
      await updateFixtureAPI(id, scheduleFixture._id, payload);
      await fetchDetail();
      setScheduleFixture(null);
      showToast("Match scheduled", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to schedule match", "error");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete tournament", "This permanently deletes the tournament and all fixtures. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTournamentAPI(id);
            showToast("Tournament deleted", "success");
            goBackTo(router, backTo, "/tournament");
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to delete", "error");
          }
        },
      },
    ]);
  };

  const handleExplainPosition = useCallback(async (payload, teamName) => {
    setExplainerTeamName(teamName || "");
    setExplainerOpen(true);
    setExplainerLoading(true);
    setExplainerText("");
    try {
      const res = await generateTournamentExplainerAPI(payload);
      setExplainerText(res?.data?.explanation || "");
    } catch {
      showToast("Could not generate explanation", "error");
      setExplainerOpen(false);
    } finally {
      setExplainerLoading(false);
    }
  }, []);

  const closeExplainer = useCallback(() => {
    if (explainerLoading) return;
    setExplainerOpen(false);
  }, [explainerLoading]);

  if (!authLoaded || !isSignedIn || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1324", paddingTop: insets.top }}>
        <LightOnDarkStatusBar />
        <TournamentCricketLoader />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Text style={{ color: isDark ? T.textDim : "#6B7280" }}>Tournament not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <LightOnDarkStatusBar />

      <View style={{ backgroundColor: "#0B1324", paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, "/tournament")}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {showRequestJoin ? (
              <TouchableOpacity
                onPress={openJoinRequestSheet}
                disabled={joinBusy}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#BAF072",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  opacity: joinBusy ? 0.7 : 1,
                }}
              >
                <Ionicons name="enter-outline" size={15} color="#0B1324" />
                <Text style={{ color: "#0B1324", fontWeight: "800", fontSize: 12 }}>Request to join</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/help-center",
                  params: {
                    tournamentId: id,
                    sport: tournament?.sport || "Cricket",
                    screen: "tournament",
                    backTo: backTo || `/tournament/${id}`,
                  },
                })
              }
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="help-circle-outline" size={19} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="share-social-outline" size={19} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ color: "white", fontWeight: "900", fontSize: 22, marginTop: 10 }} numberOfLines={2}>
          {tournament.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <Text style={{ color: "#BAF072", fontSize: 12, fontWeight: "700" }}>{formatLabelForSport(tournament.format, tournament.sport)}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 12 }}>
            {(() => {
              const sport = String(tournament.sport || "").toLowerCase();
              if (sport === "football") {
                return `${tournament.config?.halfMinutes || 45}' halves`;
              }
              if (sport === "volleyball") {
                const fmt = tournament.config?.matchFormat === "best_of_3" ? "Best of 3" : "Best of 5";
                const setPts = tournament.config?.setPoints || 25;
                const deciding = tournament.config?.decidingSetPoints || 15;
                return `${fmt} · ${setPts}/${deciding}`;
              }
              return `${tournament.config?.matchFormat} · ${tournament.config?.totalOvers} overs`;
            })()}
          </Text>
          {tournament.season ? <Text style={{ color: "#94A3B8", fontSize: 12 }}>{tournament.season}</Text> : null}
          {hasMultipleDivisions ? (
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              {divisions.length} {divisionCopy(tournament?.sport).pluralLower}
            </Text>
          ) : null}
        </View>
        {formatDateRange(tournament.startDate, tournament.endDate) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
            <Text style={{ color: "#CBD5E1", fontSize: 12, fontWeight: "600" }}>
              {formatDateRange(tournament.startDate, tournament.endDate)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ backgroundColor: "#0B1324", flexShrink: 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: showDivisionPicker ? 4 : 8 }}
        >
          {TABS.filter((t) => t !== "Manage" || isAdmin).map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, minWidth: 72 }}
              >
                <Text style={{ color: active ? "#BAF072" : "#94A3B8", fontWeight: active ? "800" : "600", fontSize: 12 }}>
                  {t}
                </Text>
                {active && (
                  <View style={{ height: 3, backgroundColor: "#BAF072", width: 26, borderRadius: 2, marginTop: 5 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {showDivisionPicker ? (
          <DivisionPicker
            divisions={divisions}
            selectedId={selectedDivisionId}
            onSelect={setSelectedDivisionId}
            teamCounts={teamCounts}
            sport={tournament?.sport}
          />
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 12, flexGrow: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? T.refresh : "#0B1324"}
            colors={[isDark ? T.refresh : "#0B1324"]}
          />
        }
      >
        {showRequestJoin ? (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0B1324" }}>Want to play?</Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 17 }}>
              Request to join with a team you own. The organizer will approve or decline in Manage.
            </Text>
            <TouchableOpacity
              onPress={openJoinRequestSheet}
              disabled={joinBusy}
              style={{
                marginTop: 12,
                backgroundColor: "#0B1324",
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                opacity: joinBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#BAF072", fontWeight: "800" }}>Request to join</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {tab === "Standings" && (
          <StandingsTab
            standings={divisionStandings}
            format={tournament.format}
            teams={divisionTeams}
            tournament={tournament}
            fixtures={standingsFixtures}
            divisionName={
              hasMultipleDivisions
                ? divisions.find((d) => String(d.id) === String(selectedDivisionId))?.name
                : ""
            }
            hintTeamId={hintTeamId}
            onExplain={handleExplainPosition}
            explainerLoading={explainerLoading}
            onOpenFixture={openFixtureFromStandings}
          />
        )}
        {tab === "Matches" && (
          <MatchesTab
            fixtures={tournament.format === "knockout" ? allFixtures : divisionLeagueFixtures}
            liveScopeFixtures={matchLiveScopeFixtures}
            format={tournament.format}
            isAdmin={isAdmin}
            onStart={startMatch}
            onOpen={openGame}
            onEnterResult={openResultModal}
            onWatchLive={watchLive}
            onSchedule={setScheduleFixture}
            busy={busy || resultSubmitting}
            totalOvers={tournament.config?.totalOvers}
            sport={tournament.sport}
            scheduledInnings={tournament.config?.scheduledInnings}
          />
        )}
        {tab === "Teams" && (
          <TeamsTab
            teams={divisionTeams}
            standings={divisionStandings}
            divisions={divisions}
            fixtures={standingsFixtures}
            format={tournament.format}
            sport={tournament.sport}
            hasMultipleDivisions={hasMultipleDivisions}
            onOpenTeam={openTeamProfile}
            onOpenFixture={openFixtureFromStandings}
          />
        )}
        {tab === "Leaderboard" && (
          <LeaderboardTab
            leaderboard={leaderboard}
            nameMap={effectivePlayerNameMap}
            profileMap={effectivePlayerProfileMap}
            loading={leaderboardLoading}
            teams={divisionTeams}
            sport={tournament.sport}
          />
        )}
        {tab === "Stats" && (
          <StatsTab
            leaderboard={leaderboard}
            nameMap={effectivePlayerNameMap}
            profileMap={effectivePlayerProfileMap}
            loading={leaderboardLoading}
            teams={divisionTeams}
            sport={tournament.sport}
          />
        )}
        {tab === "Bracket" && (
          <BracketTab
            fixtures={allFixtures}
            format={tournament.format}
            isAdmin={isAdmin}
            onStart={startMatch}
            onOpen={openGame}
            onEnterResult={openResultModal}
            onWatchLive={watchLive}
            onSchedule={setScheduleFixture}
            busy={busy || resultSubmitting}
            sport={tournament.sport}
            scheduledInnings={tournament.config?.scheduledInnings}
          />
        )}
        {tab === "Manage" && isAdmin && (
          <ManageTab
            tournament={tournament}
            tournamentId={id}
            fixtures={allFixtures}
            standingsByDivision={data?.standingsByDivision}
            pendingInvites={pendingInvites}
            joinRequests={joinRequests}
            busy={busy || !!joinRequestAction}
            joinRequestAction={joinRequestAction}
            isOwner={isOwner}
            onEditTournament={() => setEditOpen(true)}
            onManageAdmins={() => setAdminsOpen(true)}
            onInvite={openInvite}
            onAddMyTeam={openMyTeams}
            onCancelInvite={handleCancelInvite}
            onRemoveTeam={handleRemoveTeam}
            onMoveTeam={openMoveTeam}
            onBulkMoveTeams={openBulkMoveTeams}
            onApproveJoinRequest={handleApproveJoinRequest}
            onRejectJoinRequest={handleRejectJoinRequest}
            onViewJoinRequest={setJoinRequestDetail}
            onCreateDivision={openCreateDivision}
            onRenameDivision={openRenameDivision}
            onDeleteDivision={openDeleteDivision}
            onGenerateFixtures={handleGenerateFixtures}
            onBuildFixtures={openFixturePairing}
            onSetKnockoutRound={openKnockoutPairing}
            onGenerateNextStage={handleGenerateNextStage}
            onOpenBracket={() => setTab("Bracket")}
            onNotifyCoaches={() => setScheduleNotifyOpen(true)}
            onDelete={handleDelete}
          />
        )}
      </ScrollView>

      <EditTournamentSheet
        visible={editOpen}
        tournament={tournament}
        busy={editSaving}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
      />

      <AdminsSheet
        visible={adminsOpen}
        tournament={tournament}
        profiles={adminProfiles}
        isOwner={isOwner}
        busy={adminBusy}
        onClose={() => setAdminsOpen(false)}
        onAddByEmail={handleAddAdminByEmail}
        onRemove={handleRemoveAdmin}
      />

      <ScheduleFixtureSheet
        visible={!!scheduleFixture}
        fixture={scheduleFixture}
        busy={scheduleSaving}
        onClose={() => setScheduleFixture(null)}
        onSave={handleSaveSchedule}
      />

      <DivisionAdminSheet
        visible={!!divisionSheet}
        mode={divisionSheet?.mode}
        divisions={divisions}
        division={divisionSheet?.division}
        team={divisionSheet?.team}
        teamIds={divisionSheet?.teamIds}
        teamCountLabel={
          divisionSheet?.mode === "moveTeams"
            ? `${divisionSheet.teamIds?.length || 0} team${(divisionSheet.teamIds?.length || 0) === 1 ? "" : "s"}`
            : undefined
        }
        busy={busy}
        sport={tournament?.sport}
        onClose={closeDivisionSheet}
        onConfirm={handleDivisionSheetConfirm}
      />

      <KeyboardBottomSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        contentPadding={20}
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={() => setInviteOpen(false)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", color: "#374151" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmInvite} disabled={busy || !selectedTeamIds.length} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: "#0B1324", alignItems: "center", justifyContent: "center", minHeight: 48, opacity: busy || !selectedTeamIds.length ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color="#BAF072" /> : <Text style={{ fontWeight: "800", color: "#BAF072" }}>Send {selectedTeamIds.length || ""}</Text>}
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0B1324", marginBottom: 4 }}>Invite teams</Text>
        <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
          Search by name, filter by city, then match manager name & team code so you invite the right squad.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={inviteSearch}
            onChangeText={setInviteSearch}
            placeholder="Team name…"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, paddingVertical: 11, fontSize: 15, color: "#0B1324" }}
          />
          {searchLoading ? <ActivityIndicator size="small" color="#6B7280" /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
          <Ionicons name="location-outline" size={18} color="#9CA3AF" />
          <TextInput
            value={inviteCity}
            onChangeText={setInviteCity}
            placeholder="Filter by city / area (optional)"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, paddingVertical: 11, fontSize: 15, color: "#0B1324" }}
          />
        </View>
        <TextInput
          value={inviteMessage}
          onChangeText={setInviteMessage}
          placeholder="Optional message for team owners"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, fontSize: 14, color: "#0B1324", marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB", minHeight: 56 }}
        />
        {inviteSearch.trim().length < 2 ? (
          <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>Type at least 2 characters to search</Text>
        ) : searchResults.length === 0 && !searchLoading ? (
          <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>No teams found</Text>
        ) : (
          <>
            {hasDuplicateTeamNames(searchResults) ? (
              <View style={{ backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FDE68A" }}>
                <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700", lineHeight: 18 }}>
                  Multiple teams share this name — use city filter, manager name, and the 6-character team code to pick the right one.
                </Text>
              </View>
            ) : null}
            {searchResults.map((t) => (
              <TournamentTeamSearchRow
                key={t._id}
                team={t}
                selected={selectedTeamIds.includes(t._id)}
                ownerProfile={ownerProfiles[String(t.createdBy)]}
                onToggle={() =>
                  setSelectedTeamIds((prev) =>
                    prev.includes(t._id) ? prev.filter((x) => x !== t._id) : [...prev, t._id],
                  )
                }
              />
            ))}
          </>
        )}
      </KeyboardBottomSheet>

      <KeyboardBottomSheet
        visible={explainerOpen}
        onClose={closeExplainer}
        contentPadding={20}
        maxHeightRatio={0.62}
        sheetBackgroundColor={isDark ? T.surface : "#fff"}
        footerBorderColor={isDark ? T.border : "#F3F4F6"}
      >
        <View style={{ alignItems: "center", paddingBottom: 8 }}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? T.border : "#E2E8F0",
            }}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? "rgba(186,240,114,0.16)" : "#E8F8D8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="sparkles" size={20} color={isDark ? "#BAF072" : "#081126"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>
              Your position
            </Text>
            <Text
              style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}
              numberOfLines={1}
            >
              {explainerTeamName || "Team"} · {tournament?.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeExplainer}
            disabled={explainerLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ opacity: explainerLoading ? 0.4 : 1 }}
          >
            <Ionicons name="close" size={22} color={isDark ? T.iconMuted : "#6B7280"} />
          </TouchableOpacity>
        </View>

        {explainerLoading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color={isDark ? "#BAF072" : "#0B1324"} />
            <Text style={{ marginTop: 12, color: isDark ? T.textDim : "#6B7280", fontWeight: "600" }}>
              Reading the table…
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E2E8F0",
            }}
          >
            <Text style={{ fontSize: 15, color: isDark ? T.text : "#1E293B", lineHeight: 23 }}>
              {explainerText}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 14, lineHeight: 16 }}>
          {String(tournament?.sport || "").toLowerCase() === "football"
            ? "Based on current standings, goal difference, and remaining fixtures. Scenarios may change after each result."
            : "Based on current standings, NRR, and remaining fixtures. Scenarios may change after each result."}
        </Text>
      </KeyboardBottomSheet>

      <Modal visible={myTeamOpen} transparent animationType="slide" onRequestClose={() => setMyTeamOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "75%" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0B1324", marginBottom: 4 }}>Add your team</Text>
            <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              {hasMultipleDivisions
                ? `Instantly enroll into ${formatDivisionDisplayName(sortDivisions(divisions).find((d) => String(d.id) === String(selectedDivisionId)) || { name: `selected ${divisionCopy(tournament?.sport).singularLower}` }, tournament?.sport)}.`
                : "Instantly enroll a team you manage."}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {ownedTeams.length === 0 && (
                <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 30 }}>
                  No eligible teams found. Create a {tournament.sport} team first.
                </Text>
              )}
              {ownedTeams.map((t) => {
                const selected = selectedTeamIds.includes(t._id);
                return (
                  <TouchableOpacity
                    key={t._id}
                    onPress={() =>
                      setSelectedTeamIds((prev) => (selected ? prev.filter((x) => x !== t._id) : [...prev, t._id]))
                    }
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
                  >
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? "#22C55E" : "#CBD5E1"} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#0B1324" }}>{t.teamName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setMyTeamOpen(false)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: "#374151" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmEnrollMyTeam} disabled={busy} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: "#0B1324", alignItems: "center", justifyContent: "center", minHeight: 48, opacity: busy ? 0.7 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: "800", color: "#fff" }}>Add {selectedTeamIds.length || ""}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!resultFixture} transparent animationType="fade" onRequestClose={closeResultModal}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0B1324", marginBottom: 4 }}>Record result</Text>
            <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              {resultFixture?.label} — pick the winner without starting a live match.
            </Text>

            {String(tournament?.sport || "").toLowerCase() === "football" ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 8 }}>
                  Goals (for standings / GD)
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                  {[
                    {
                      name: resultFixture?.homeTeamName,
                      goals: manualHomeGoals,
                      setGoals: setManualHomeGoals,
                      pens: manualHomePens,
                      setPens: setManualHomePens,
                    },
                    {
                      name: resultFixture?.awayTeamName,
                      goals: manualAwayGoals,
                      setGoals: setManualAwayGoals,
                      pens: manualAwayPens,
                      setPens: setManualAwayPens,
                    },
                  ].map((side) => (
                    <View key={side.name || "side"} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 6 }} numberOfLines={1}>
                        {side.name}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginBottom: 3 }}>Goals</Text>
                      <TextInput
                        value={side.goals}
                        onChangeText={side.setGoals}
                        placeholder="e.g. 2"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        editable={!resultSubmitting}
                        style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#0B1324", marginBottom: 6 }}
                      />
                      {resultFixture?.stage !== "league" ? (
                        <>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginBottom: 3 }}>Pens</Text>
                          <TextInput
                            value={side.pens}
                            onChangeText={side.setPens}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            editable={!resultSubmitting}
                            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#0B1324" }}
                          />
                        </>
                      ) : null}
                    </View>
                  ))}
                </View>
                {canUsePenalties(resultFixture, tournament) ? (
                  <TouchableOpacity
                    onPress={() => setPenaltiesWin((prev) => !prev)}
                    disabled={resultSubmitting}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: penaltiesWin ? "#BAF072" : "#E5E7EB",
                      backgroundColor: penaltiesWin ? "#F3FBE7" : "#fff",
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name={penaltiesWin ? "checkbox" : "square-outline"}
                      size={20}
                      color={penaltiesWin ? "#4D7C0F" : "#94A3B8"}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B1324" }}>Decided on penalties</Text>
                      <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        FT was level; winner decided by penalty shootout.
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : resultFixture?.stage === "league" ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 8 }}>Optional scores (for standings / NRR)</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                  {[
                    {
                      name: resultFixture?.homeTeamName,
                      runs: manualHomeRuns,
                      setRuns: setManualHomeRuns,
                      wickets: manualHomeWickets,
                      setWickets: setManualHomeWickets,
                      overs: manualHomeOvers,
                      setOvers: setManualHomeOvers,
                    },
                    {
                      name: resultFixture?.awayTeamName,
                      runs: manualAwayRuns,
                      setRuns: setManualAwayRuns,
                      wickets: manualAwayWickets,
                      setWickets: setManualAwayWickets,
                      overs: manualAwayOvers,
                      setOvers: setManualAwayOvers,
                    },
                  ].map((side) => (
                    <View key={side.name || "side"} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 6 }} numberOfLines={1}>
                        {side.name}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginBottom: 3 }}>Runs</Text>
                          <TextInput
                            value={side.runs}
                            onChangeText={side.setRuns}
                            placeholder="e.g. 156"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            editable={!resultSubmitting}
                            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#0B1324" }}
                          />
                        </View>
                        <View style={{ width: 64 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginBottom: 3 }}>Wkts</Text>
                          <TextInput
                            value={side.wickets}
                            onChangeText={side.setWickets}
                            placeholder="e.g. 7"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            editable={!resultSubmitting}
                            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, fontSize: 14, color: "#0B1324" }}
                          />
                        </View>
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginBottom: 3 }}>Overs</Text>
                      <TextInput
                        value={side.overs}
                        onChangeText={side.setOvers}
                        placeholder="e.g. 19.4"
                        placeholderTextColor="#9CA3AF"
                        editable={!resultSubmitting}
                        style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#0B1324" }}
                      />
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>
                  Enter runs, wickets and overs for accurate NRR. If overs are omitted, full quota is assumed.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                  Knockout results update the bracket. League standings use fixtures from the league phase.
                </Text>
                {canUseSuperOver(resultFixture, tournament) ? (
                  <TouchableOpacity
                    onPress={() => setSuperOverWin((prev) => !prev)}
                    disabled={resultSubmitting}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: superOverWin ? "#BAF072" : "#E5E7EB",
                      backgroundColor: superOverWin ? "#F3FBE7" : "#fff",
                      marginBottom: 14,
                    }}
                  >
                    <Ionicons
                      name={superOverWin ? "checkbox" : "square-outline"}
                      size={20}
                      color={superOverWin ? "#4D7C0F" : "#94A3B8"}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B1324" }}>Decided by Super Over</Text>
                      <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        The match was tied and the winner was decided in a Super Over.
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </>
            )}

            {resultSubmitting ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#0B1324" />
                <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "600" }}>Saving result…</Text>
              </View>
            ) : (
              <>
                {[
                  { id: resultFixture?.homeTeamId, name: resultFixture?.homeTeamName },
                  { id: resultFixture?.awayTeamId, name: resultFixture?.awayTeamName },
                ].map((t) =>
                  t.id ? (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => submitResult(t.id, false)}
                      style={{ paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", marginBottom: 10 }}
                    >
                      <Text style={{ fontWeight: "700", color: "#0B1324" }}>{t.name} won</Text>
                    </TouchableOpacity>
                  ) : null,
                )}
                <TouchableOpacity onPress={() => submitResult(null, true)} style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>No result</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={closeResultModal} disabled={resultSubmitting} style={{ paddingVertical: 10, alignItems: "center", opacity: resultSubmitting ? 0.5 : 1 }}>
              <Text style={{ color: "#374151", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <JoinRequestDetailSheet
        visible={!!joinRequestDetail}
        request={joinRequestDetail}
        busy={!!joinRequestAction}
        actionType={
          joinRequestAction &&
          String(joinRequestAction.id) === String(joinRequestDetail?._id)
            ? joinRequestAction.type
            : null
        }
        onClose={() => !joinRequestAction && setJoinRequestDetail(null)}
        onApprove={handleApproveJoinRequest}
        onReject={handleRejectJoinRequest}
      />

      <FixturePairingSheet
        visible={fixturePairingOpen}
        tournament={tournament}
        fixtures={allFixtures}
        busy={busy}
        onClose={() => !busy && setFixturePairingOpen(false)}
        onAddMatch={handleAddLeagueMatch}
        onDeleteMatch={handleDeleteLeagueMatch}
        onPublish={handlePublishLeagueFixtures}
        onFillRoundRobin={handleFillDivisionRoundRobin}
      />

      <KnockoutRoundPairingSheet
        visible={knockoutPairingOpen}
        remaining={knockoutRemaining}
        busy={busy}
        onClose={() => !busy && setKnockoutPairingOpen(false)}
        onConfirm={handlePublishKnockoutRound}
        onRefresh={refreshKnockoutRemaining}
      />

      <ScheduleNotifySheet
        visible={scheduleNotifyOpen}
        tournament={tournament}
        busy={busy}
        onClose={() => !busy && setScheduleNotifyOpen(false)}
        onSend={handleNotifyCoaches}
      />

      <Modal visible={joinOpen} transparent animationType="fade" onRequestClose={() => !joinBusy && setJoinOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0B1324", marginBottom: 4 }}>
              Request to join
            </Text>
            <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              Select one or more teams you own. The organizer must approve each before enrollment.
            </Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {joinableOwnedTeams.map((t) => {
                const tid = String(t._id || t.id);
                const selected = selectedJoinTeamIds.includes(tid);
                return (
                  <TouchableOpacity
                    key={tid}
                    onPress={() => toggleJoinTeam(tid)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F1F5F9",
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={selected ? "#22C55E" : "#CBD5E1"}
                    />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#0B1324" }}>
                      {t.teamName || t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setJoinOpen(false)}
                disabled={joinBusy}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: "#374151" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitJoinRequest}
                disabled={joinBusy || !selectedJoinTeamIds.length}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: "#0B1324",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  opacity: joinBusy || !selectedJoinTeamIds.length ? 0.6 : 1,
                }}
              >
                {joinBusy ? (
                  <ActivityIndicator color="#BAF072" />
                ) : (
                  <Text style={{ fontWeight: "800", color: "#BAF072" }}>
                    Send {selectedJoinTeamIds.length || ""}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
