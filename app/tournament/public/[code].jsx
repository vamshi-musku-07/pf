import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
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
import {
  createTournamentJoinRequestAPI,
  getPublicTournamentAPI,
} from "@/services/TournamentApi";
import { getTeamsAPI } from "@/services/TeamApi";
import { shareTournamentLink } from "@/lib/shareLinks";
import {
  PUBLIC_TABS,
  formatLabelForSport,
  formatDateRange,
  pickDefaultDivisionId,
  standingsForDivision,
  filterLeagueFixturesByDivision,
  buildMatchLiveScopeFixtures,
  sortDivisions,
  divisionCopy,
} from "@/features/tournament/helpers";
import DivisionPicker from "../tabs/DivisionPicker";
import StandingsTab from "../tabs/StandingsTab";
import MatchesTab from "../tabs/MatchesTab";
import TeamsTab from "../tabs/TeamsTab";
import BracketTab from "../tabs/BracketTab";
import LeaderboardTab from "../tabs/LeaderboardTab";
import StatsTab from "../tabs/StatsTab";
import { tournamentShareCode } from "@/features/tournament/publicConfig";
import { buildNameMapFromLeaderboard, buildProfileMapFromLeaderboard } from "@/features/tournament/leaderboardConfig";

export default function PublicTournamentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const { isSignedIn, isLoaded: authLoaded } = useBackendAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("Standings");
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [selectedJoinTeamIds, setSelectedJoinTeamIds] = useState([]);

  const tournament = data?.tournament;
  const allFixtures = data?.fixtures || [];
  const isAdmin = !!data?.isAdmin;
  const divisions = tournament?.divisions || [];
  const hasMultipleDivisions = divisions.length > 1;
  const leaderboard = data?.leaderboard || null;
  const playerNameMap = useMemo(() => buildNameMapFromLeaderboard(leaderboard), [leaderboard]);
  const playerProfileMap = useMemo(() => buildProfileMapFromLeaderboard(leaderboard), [leaderboard]);

  useEffect(() => {
    if (!tournament || selectedDivisionId) return;
    setSelectedDivisionId(pickDefaultDivisionId(tournament, null));
  }, [tournament, selectedDivisionId]);

  const divisionStandings = useMemo(
    () => standingsForDivision(data, selectedDivisionId),
    [data, selectedDivisionId],
  );
  const divisionTeams = useMemo(() => {
    if (!hasMultipleDivisions) return tournament?.teams || [];
    return (tournament?.teams || []).filter(
      (t) => String(t.divisionId || "main") === String(selectedDivisionId),
    );
  }, [tournament?.teams, hasMultipleDivisions, selectedDivisionId]);
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
  const standingsFixtures = useMemo(
    () => filterLeagueFixturesByDivision(allFixtures, selectedDivisionId),
    [allFixtures, selectedDivisionId],
  );
  const teamCounts = useMemo(() => {
    const counts = {};
    for (const div of sortDivisions(divisions)) {
      counts[div.id] = (div.teamIds || []).length;
    }
    return counts;
  }, [divisions]);

  const showDivisionPicker =
    hasMultipleDivisions &&
    (tab === "Standings" || tab === "Matches" || tab === "Teams" || tab === "Leaderboard" || tab === "Stats");

  const fetchDetail = useCallback(async () => {
    try {
      const res = await getPublicTournamentAPI(code, hasMultipleDivisions ? selectedDivisionId : undefined);
      setData(res?.data || res || null);
    } catch {
      showToast("Tournament not found or is private", "error");
    } finally {
      setLoading(false);
    }
  }, [code, hasMultipleDivisions, selectedDivisionId]);

  useFocusEffect(
    useCallback(() => {
      setLoading((prev) => (data ? prev : true));
      fetchDetail();
    }, [fetchDetail]),
  );

  useEffect(() => {
    if (tab !== "Matches" && tab !== "Bracket") return undefined;
    const interval = setInterval(() => {
      fetchDetail();
    }, 15000);
    return () => clearInterval(interval);
  }, [tab, fetchDetail]);

  useEffect(() => {
    if (!selectedDivisionId || !code) return;
    fetchDetail();
  }, [selectedDivisionId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetail();
    setRefreshing(false);
  }, [fetchDetail]);

  const watchLive = (fixture) => {
    if (!fixture?.gameId || !fixture?.homeTeamId) return;
    router.push({
      pathname: `/team/${fixture.homeTeamId}`,
      params: {
        initialTab: "STATS",
        gameId: String(fixture.gameId),
        spectate: "1",
        backTo: `/tournament/public/${code}`,
      },
    });
  };

  const openGame = (fixture) => {
    if (!fixture?.gameId || !fixture?.homeTeamId) return;
    router.push({
      pathname: `/team/${fixture.homeTeamId}`,
      params: {
        initialTab: "STATS",
        gameId: String(fixture.gameId),
        tournamentScorer: "1",
        backTo: `/tournament/public/${code}`,
      },
    });
  };

  const openTeamProfile = (teamId) => {
    if (!teamId) return;
    router.push({
      pathname: `/team/${teamId}`,
      params: { backTo: `/tournament/public/${code}` },
    });
  };

  const handleShare = async () => {
    try {
      await shareTournamentLink({
        name: tournament?.name,
        shareCode: tournamentShareCode(tournament),
        tournamentId: tournament?._id,
      });
    } catch {
      // user cancelled
    }
  };

  const enrolledTeamIds = useMemo(
    () => new Set((tournament?.teams || []).map((t) => String(t.teamId))),
    [tournament?.teams],
  );

  const joinableOwnedTeams = useMemo(
    () => (ownedTeams || []).filter((t) => !enrolledTeamIds.has(String(t._id || t.id))),
    [ownedTeams, enrolledTeamIds],
  );

  const canRequestJoin =
    isSignedIn &&
    !isAdmin &&
    tournament &&
    !tournament.fixturesGenerated &&
    joinableOwnedTeams.length > 0;

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    getTeamsAPI({ limit: 100 })
      .then((res) => {
        const list = res?.data || res?.teams || res || [];
        setOwnedTeams(Array.isArray(list) ? list : []);
      })
      .catch(() => setOwnedTeams([]));
  }, [authLoaded, isSignedIn]);

  // Admins (and owners) open the full manage experience; others stay on public to request join.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !tournament?._id || !isAdmin) return;
    router.replace({
      pathname: `/tournament/${tournament._id}`,
      params: { backTo: backTo || "/tournament" },
    });
  }, [authLoaded, isSignedIn, tournament?._id, isAdmin, backTo, router]);

  const toggleJoinTeam = (teamId) => {
    const id = String(teamId);
    setSelectedJoinTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openJoinSheet = () => {
    if (!isSignedIn) {
      router.push({
        pathname: "/(auth)/sign-in",
        params: { redirect: `/tournament/public/${code}` },
      });
      return;
    }
    if (tournament?.fixturesGenerated) {
      showToast("Enrollment is closed — fixtures already generated", "warning");
      return;
    }
    if (!joinableOwnedTeams.length) {
      showToast("Create a team you own, or this team is already enrolled", "warning");
      return;
    }
    setSelectedJoinTeamIds(
      joinableOwnedTeams.length === 1
        ? [String(joinableOwnedTeams[0]._id || joinableOwnedTeams[0].id)]
        : [],
    );
    setJoinOpen(true);
  };

  const submitJoinRequest = async () => {
    if (!selectedJoinTeamIds.length || !tournament?._id) return;
    setJoinBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedJoinTeamIds.map((teamId) =>
          createTournamentJoinRequestAPI(tournament._id, teamId),
        ),
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

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
        <TournamentCricketLoader message="Loading tournament…" />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F0F4F8", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="trophy-outline" size={56} color="#CBD5E1" />
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0B1324", marginTop: 14 }}>Tournament unavailable</Text>
        <TouchableOpacity onPress={() => goBackTo(router, backTo, "/tournament")} style={{ marginTop: 20 }}>
          <Text style={{ color: "#2563EB", fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSignedIn && isAdmin && tournament?._id) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
        <TournamentCricketLoader message="Opening tournament…" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
      <StatusBar style="light" />
      <LightOnDarkStatusBar />

      <View style={{ backgroundColor: "#0B1324", paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, "/tournament")}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {!tournament.fixturesGenerated ? (
              <TouchableOpacity
                onPress={openJoinSheet}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#BAF072",
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 999,
                }}
              >
                <Ionicons name="enter-outline" size={16} color="#0B1324" />
                <Text style={{ color: "#0B1324", fontWeight: "800", fontSize: 12 }}>
                  {canRequestJoin ? "Request to join" : isSignedIn ? "Request to join" : "Sign in to join"}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleShare}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="share-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <View style={{ backgroundColor: "rgba(186,240,114,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
            <Text style={{ color: "#BAF072", fontSize: 11, fontWeight: "800" }}>PUBLIC</Text>
          </View>
        </View>

        <Text style={{ color: "white", fontWeight: "900", fontSize: 22, marginTop: 8 }} numberOfLines={2}>
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
          {hasMultipleDivisions ? (
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              {divisions.length} {divisionCopy(tournament?.sport).pluralLower}
            </Text>
          ) : null}
        </View>
        {formatDateRange(tournament.startDate, tournament.endDate) ? (
          <Text style={{ color: "#CBD5E1", fontSize: 12, fontWeight: "600", marginTop: 8 }}>
            {formatDateRange(tournament.startDate, tournament.endDate)}
          </Text>
        ) : null}
        {tournament.description ? (
          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 8, lineHeight: 17 }} numberOfLines={3}>
            {tournament.description}
          </Text>
        ) : null}
      </View>

      <View style={{ backgroundColor: "#0B1324", flexShrink: 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: showDivisionPicker ? 4 : 8 }}
        >
          {PUBLIC_TABS.map((t) => {
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!tournament.fixturesGenerated ? (
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
              onPress={openJoinSheet}
              style={{
                marginTop: 12,
                backgroundColor: "#0B1324",
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#BAF072", fontWeight: "800" }}>
                {isSignedIn ? "Request to join" : "Sign in to request join"}
              </Text>
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
          />
        )}
        {tab === "Matches" && (
          <MatchesTab
            fixtures={tournament.format === "knockout" ? allFixtures : divisionLeagueFixtures}
            liveScopeFixtures={matchLiveScopeFixtures}
            format={tournament.format}
            isAdmin={isAdmin}
            onOpen={openGame}
            onWatchLive={watchLive}
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
          />
        )}
        {tab === "Leaderboard" && (
          <LeaderboardTab
            leaderboard={leaderboard}
            nameMap={playerNameMap}
            profileMap={playerProfileMap}
            loading={!leaderboard}
            teams={divisionTeams}
            sport={tournament.sport}
          />
        )}
        {tab === "Stats" && (
          <StatsTab
            leaderboard={leaderboard}
            nameMap={playerNameMap}
            profileMap={playerProfileMap}
            loading={!leaderboard}
            teams={divisionTeams}
            sport={tournament.sport}
          />
        )}
        {tab === "Bracket" && (
          <BracketTab
            fixtures={allFixtures}
            format={tournament.format}
            isAdmin={isAdmin}
            onOpen={openGame}
            onWatchLive={watchLive}
            sport={tournament.sport}
            scheduledInnings={tournament.config?.scheduledInnings}
          />
        )}
      </ScrollView>

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
