import { Feather, Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";


import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useInvitations } from "@/hooks/useInvitations";
import { useTournamentInvites } from "@/hooks/useTournamentInvites";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import TournamentInviteSheet from "@/components/tournament/TournamentInviteSheet";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useRefresh } from "@/hooks/useRefresh";
import { openTeamInvitation } from "@/lib/openTeamInvitation";
import { logoRequireMap } from "@/app/team/tabs/helpers";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const INVITATIONS_EMPTY_ICON = require("../../assets/images/invitations-empty-3d.png");



function InvitationsSkeleton({ isDark, T }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bone = isDark ? "#2A2A2E" : "#E2E8F0";
  const B = ({ w, h = 12, r = 6 }) => (
    <Animated.View style={{ opacity: pulse, width: w, height: h, borderRadius: r, backgroundColor: bone }} />
  );
  return (
    <View style={{ gap: 14 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: T.surface,
            borderRadius: 16,
            padding: 18,
            borderWidth: isDark ? 1 : 0,
            borderColor: T.border,
            shadowColor: "#000",
            shadowOpacity: isDark ? 0.25 : 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Animated.View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: bone, opacity: pulse }} />
            <View style={{ flex: 1, gap: 8 }}>
              <B w={150} h={15} r={7} />
              <B w={110} h={10} r={5} />
            </View>
          </View>
          <View style={{ gap: 6, marginBottom: 14 }}>
            <B w="80%" h={9} r={4} />
            <B w="60%" h={9} r={4} />
          </View>
          <Animated.View style={{ height: 40, borderRadius: 12, backgroundColor: bone, opacity: pulse }} />
        </View>
      ))}
    </View>
  );
}


const resolveInvitationLogoSource = (teamLogo) => {
  if (!teamLogo || typeof teamLogo !== "string") return null;

  const mappedLogo = logoRequireMap[teamLogo];
  if (mappedLogo) return mappedLogo;

  if (/^https?:\/\//i.test(teamLogo)) {
    return { uri: teamLogo };
  }

  return null;
};

const formatCoachName = (coachName) => {
  if (typeof coachName !== "string") return "A Coach";
  const trimmedCoachName = coachName.trim();
  return trimmedCoachName || "A Coach";
};

const FORMAT_LABEL = {
  round_robin: "Round Robin",
  knockout: "Knockout",
  hybrid: "League + Playoffs",
};

const MobileInvitations = () => {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [activeInviteId, setActiveInviteId] = useState(null);
  const { isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const router = useRouter();
  const {
    invitations,
    isLoading,
    error,
    fetchInvitations,
    dismissInvitation,
  } = useInvitations();
  const {
    invites: tournamentInvites,
    isLoading: tournamentLoading,
    fetchInvites: fetchTournamentInvites,
  } = useTournamentInvites();
  const {
    tournaments: myTournaments,
    isLoading: myTournamentsLoading,
    fetchTournaments: fetchMyTournaments,
  } = useMyTournaments();
  const { refreshing, onRefresh } = useRefresh(async () => {
    await Promise.all([
      fetchInvitations({ force: true }),
      fetchTournamentInvites({ force: true }),
      fetchMyTournaments({ force: true }),
    ]);
  });

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) {
        fetchInvitations();
        fetchTournamentInvites();
        fetchMyTournaments();
      }
    }, [isSignedIn, fetchInvitations, fetchTournamentInvites, fetchMyTournaments])
  );

  const filteredTournamentInvites = tournamentInvites.filter((inv) => {
    const q = searchInput.toLowerCase();
    return (
      (inv.tournamentName || "").toLowerCase().includes(q) ||
      (inv.teamName || "").toLowerCase().includes(q) ||
      (inv.tournamentSport || "").toLowerCase().includes(q)
    );
  });

  const filteredMyTournaments = myTournaments.filter((t) => {
    const q = searchInput.toLowerCase();
    return (t.name || "").toLowerCase().includes(q) || (t.sport || "").toLowerCase().includes(q);
  });

  // Client-side filter uses searchInput (immediate) for zero-lag keystroke response
  const filteredInvitations = invitations.filter((inv) => {
    const q = searchInput.toLowerCase();
    return (
      (inv.teamName || "").toLowerCase().includes(q) ||
      (inv.sport || "").toLowerCase().includes(q)
    );
  });

  const handleSearchChange = (text) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(text), 300);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
  };

  const isInactive = (invitation) => {
    return (
      invitation.isRemoved ||
      invitation.isRevoked ||
      invitation.isExpired ||
      invitation.isActive === false ||
      invitation.teamDeleted ||
      (!invitation.canAccept && !invitation.isAccepted)
    );
  };

  const getOverlayMessage = (invitation) => {
    if (invitation.teamDeleted) return "Team has been deleted or not found";
    if (invitation.isRemoved) return "You have been removed from this team";
    if (invitation.isActive === false) return "You have been removed from this team";
    if (invitation.isRevoked) return "This invitation has been revoked";
    if (invitation.isExpired) return "This invitation has expired";
    if (!invitation.canAccept && !invitation.isAccepted) return "This invitation is no longer valid";
    return null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDismiss = async (invitationId) => {
    setDismissingId(invitationId);
    try {
      await dismissInvitation(invitationId);
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to dismiss invitation");
    } finally {
      setDismissingId(null);
    }
  };

  const confirmDismiss = (invitation) => {
    const isAcceptedMembership = invitation.isAccepted;
    Alert.alert(
      isAcceptedMembership ? "Remove From List" : "Delete Invitation",
      isAcceptedMembership
        ? `Remove ${invitation.teamName} from invitations? You will still stay on the team.`
        : `Are you sure you want to delete invitation from ${invitation.teamName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAcceptedMembership ? "Remove" : "Delete",
          style: "destructive",
          onPress: () => handleDismiss(invitation.invitationId),
        },
      ]
    );
  };

  const handleViewInvitation = async (invitation) => {
    if (isInactive(invitation)) return;
    if (acceptingId) return;

    setAcceptingId(invitation.invitationId);
    try {
      await openTeamInvitation(router, invitation, { backTo: "/(tabs)/invitations" });
      fetchInvitations({ force: true });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to open invitation");
    } finally {
      setAcceptingId(null);
    }
  };

  const sortedInvitations = [...filteredInvitations].sort(
    (a, b) => (isInactive(a) ? 1 : 0) - (isInactive(b) ? 1 : 0)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
      <StatusBar barStyle={T.statusBar} />
      <View style={{ paddingTop: 12, backgroundColor: T.bg, flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: T.inputBg,
              borderRadius: 16,
              paddingHorizontal: 16,
              height: 56,
              borderWidth: 1,
              borderColor: T.inputBorder,
            }}
          >
            <Feather name="search" size={20} color={T.iconMuted} />
            <TextInput
              placeholder="Search invitations & tournaments..."
              placeholderTextColor={T.textMuted}
              style={{ flex: 1, marginLeft: 12, color: T.text, fontWeight: "500" }}
              value={searchInput}
              onChangeText={handleSearchChange}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color={T.iconMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/tournament", params: { backTo: "/(tabs)/invitations" } })}
            style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "#081126", alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="All tournaments"
          >
            <Ionicons name="trophy" size={22} color="#BAF072" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              fetchInvitations({ force: true });
              fetchTournamentInvites({ force: true });
              fetchMyTournaments({ force: true });
            }}
            style={{
              backgroundColor: T.surface,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: T.border,
            }}
          >
            <Feather name="refresh-cw" size={18} color={T.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 4, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[T.refresh]} tintColor={T.refresh} />
          }
        >
          {isLoading || tournamentLoading || myTournamentsLoading ? (
            <InvitationsSkeleton isDark={isDark} T={T} />
          ) : sortedInvitations.length === 0 && filteredTournamentInvites.length === 0 && filteredMyTournaments.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <Image
                source={INVITATIONS_EMPTY_ICON}
                style={{ width: 96, height: 96, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text style={{ color: T.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>No Invitations</Text>
              <Text style={{ color: T.textDim, fontSize: 14, textAlign: "center" }}>
                You don't have any team or tournament invitations at the moment
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredMyTournaments.length > 0 && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: T.textMuted }}>
                      My tournaments
                    </Text>
                    <TouchableOpacity onPress={() => router.push({ pathname: "/tournament", params: { backTo: "/(tabs)/invitations" } })}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#60A5FA" : "#2563EB" }}>View all</Text>
                    </TouchableOpacity>
                  </View>
                  {filteredMyTournaments.map((t) => (
                    <TouchableOpacity
                      key={t._id}
                      onPress={() => router.push({ pathname: `/tournament/${t._id}`, params: { backTo: "/(tabs)/invitations" } })}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: T.surface,
                        borderRadius: 12,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: T.border,
                      }}
                    >
                      <View style={{ padding: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#081126", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="trophy" size={22} color="#BAF072" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: T.text }} numberOfLines={1}>{t.name}</Text>
                            <Text style={{ color: T.textDim, fontSize: 12, marginTop: 2 }}>
                              {FORMAT_LABEL[t.format] || t.format} · {t.teams?.length || 0} teams
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={T.iconMuted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {filteredTournamentInvites.length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: T.textMuted,
                      marginBottom: 4,
                      marginTop: filteredMyTournaments.length > 0 ? 16 : 0,
                    }}
                  >
                    Pending tournament invites
                  </Text>
                  {filteredTournamentInvites.map((inv) => (
                    <TouchableOpacity
                      key={inv._id}
                      onPress={() => setActiveInviteId(inv._id)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: T.surface,
                        borderRadius: 12,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
                      }}
                    >
                      <View style={{ padding: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                          <View
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              backgroundColor: isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="trophy" size={24} color="#D97706" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <Text style={{ fontSize: 18, fontWeight: "700", color: T.text }}>{inv.tournamentName}</Text>
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 999,
                                  backgroundColor: "rgba(245,158,11,0.2)",
                                  borderWidth: 1,
                                  borderColor: "rgba(245,158,11,0.3)",
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: "600", color: isDark ? "#FBBF24" : "#B45309" }}>
                                  Tournament
                                </Text>
                              </View>
                            </View>
                            <Text style={{ color: T.textDim, fontSize: 12, marginTop: 4 }}>
                              {FORMAT_LABEL[inv.tournamentFormat] || inv.tournamentFormat}
                              {inv.tournamentSport ? ` · ${inv.tournamentSport}` : ""}
                            </Text>
                            <Text style={{ color: T.text, fontSize: 14, marginTop: 8 }}>
                              <Text style={{ fontWeight: "600" }}>Your team: </Text>
                              {inv.teamName}
                            </Text>
                            {inv.message ? (
                              <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 8, fontStyle: "italic" }} numberOfLines={2}>
                                "{inv.message}"
                              </Text>
                            ) : null}
                            <View
                              style={{
                                marginTop: 8,
                                alignSelf: "flex-start",
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: "rgba(34,197,94,0.2)",
                                borderWidth: 1,
                                borderColor: "rgba(34,197,94,0.3)",
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: "600", color: isDark ? "#4ADE80" : "#15803D" }}>
                                Tap to view & accept
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {sortedInvitations.length > 0 ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: T.textMuted,
                        marginTop: 16,
                        marginBottom: 4,
                      }}
                    >
                      Team invites
                    </Text>
                  ) : null}
                </>
              )}
              {sortedInvitations.map((invitation) => {
                const inactive = isInactive(invitation);
                const overlayMessage = getOverlayMessage(invitation);
                const isDismissing = dismissingId === invitation.invitationId;
                const isAccepting = acceptingId === invitation.invitationId;
                const invitationTeamName = invitation.teamName || "Team Invitation";
                const invitationTeamLogo = resolveInvitationLogoSource(
                  invitation.teamLogo || invitation.teamlogo
                );
                const invitationCoachName = formatCoachName(invitation.inviterName);

                return (
                  <TouchableOpacity
                    key={invitation.invitationId}
                    onPress={() => handleViewInvitation(invitation)}
                    activeOpacity={inactive ? 1 : 0.8}
                    disabled={isAccepting}
                    style={{
                      position: "relative",
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: inactive ? "#000" : T.surface,
                      borderWidth: isDark && !inactive ? 1 : 0,
                      borderColor: T.border,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => confirmDismiss(invitation)}
                      disabled={isDismissing}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        zIndex: 50,
                        padding: 8,
                        borderRadius: 999,
                        backgroundColor: isDismissing ? "#4B5563" : "rgba(0,0,0,0.2)",
                      }}
                    >
                      {isDismissing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Feather name="trash-2" size={16} color="#F87171" />
                      )}
                    </TouchableOpacity>

                    {/* Inactive overlay */}
                    {inactive && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0,0,0,0.75)",
                          zIndex: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 12,
                          padding: 16,
                        }}
                      >
                        {invitation.teamDeleted ? (
                          <>
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "rgba(239,68,68,0.2)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 8,
                              }}
                            >
                              <Feather name="trash-2" size={20} color="#F87171" />
                            </View>
                            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12, textAlign: "center" }}>
                              {overlayMessage}
                            </Text>
                            <Text style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>{invitationTeamName}</Text>
                          </>
                        ) : (
                          <>
                            <Feather name="alert-triangle" size={22} color="#F87171" />
                            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                              {overlayMessage}
                            </Text>
                            <Text style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>{invitationTeamName}</Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Card Content */}
                    <View style={{ padding: 16, opacity: inactive ? 0.4 : 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isDark ? T.surfaceAlt : "rgba(156,163,175,0.4)",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {invitationTeamLogo ? (
                            <Image
                              source={invitationTeamLogo}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={{ color: T.text, textTransform: "uppercase", fontWeight: "700", fontSize: 18 }}>
                              {invitationTeamName.charAt(0) || "T"}
                            </Text>
                          )}
                        </View>

                        <View style={{ flex: 1, paddingRight: 24 }}>
                          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <Text style={{ fontSize: 20, fontWeight: "700", textTransform: "uppercase", color: inactive ? "#fff" : T.text }}>
                                  {invitationTeamName}
                                </Text>
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    backgroundColor:
                                      invitation.playerRole === "manager"
                                        ? "rgba(168,85,247,0.2)"
                                        : "rgba(34,197,94,0.2)",
                                    borderColor:
                                      invitation.playerRole === "manager"
                                        ? "rgba(168,85,247,0.3)"
                                        : "rgba(34,197,94,0.3)",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "600",
                                      color:
                                        invitation.playerRole === "manager"
                                          ? "#C084FC"
                                          : isDark
                                            ? "#4ADE80"
                                            : "#15803D",
                                    }}
                                  >
                                    {invitation.playerRole === "manager" ? "Manager" : "Player"}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            {invitation.sport ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="calendar" size={12} color={T.iconMuted} />
                                <Text style={{ color: inactive ? "#E5E7EB" : T.text, fontSize: 12 }}>{invitation.sport}</Text>
                              </View>
                            ) : null}
                            {invitation.season ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="users" size={12} color={T.iconMuted} />
                                <Text style={{ color: inactive ? "#E5E7EB" : T.text, fontSize: 12 }}>{invitation.season}</Text>
                              </View>
                            ) : null}
                            {invitation.location && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="map-pin" size={12} color={T.iconMuted} />
                                <Text style={{ color: inactive ? "#E5E7EB" : T.text, fontSize: 12 }}>{invitation.location}</Text>
                              </View>
                            )}
                          </View>

                          <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>
                            <Text style={{ fontWeight: "600", color: inactive ? "#E5E7EB" : T.text }}>As: </Text>
                            {invitation.playerName}
                            {invitation.playerPosition && ` · ${invitation.playerPosition}`}
                            {invitation.playerJerseyNumber && ` · #${invitation.playerJerseyNumber}`}
                          </Text>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: 0.6,
                                color: T.textMuted,
                              }}
                            >
                              Coach :
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: inactive ? "#E5E7EB" : T.text }} numberOfLines={1}>
                              {invitationCoachName}
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Feather name="mail" size={10} color={T.iconMuted} />
                              <Text style={{ fontSize: 10, color: T.textMuted }}>{invitation.email}</Text>
                            </View>
                            {invitation.expiresAt && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: new Date(invitation.expiresAt) > new Date() ? "#FBBF24" : "#F87171",
                                }}
                              >
                                Expires: {formatDate(invitation.expiresAt)}
                              </Text>
                            )}
                          </View>

                          {!inactive && (
                            <View style={{ marginTop: 8 }}>
                              {isAccepting ? (
                                <View
                                  style={{
                                    alignSelf: "flex-start",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    backgroundColor: "rgba(34,197,94,0.2)",
                                    borderColor: "rgba(34,197,94,0.3)",
                                  }}
                                >
                                  <ActivityIndicator size={10} color="#22C55E" />
                                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#22C55E" }}>Joining team…</Text>
                                </View>
                              ) : (
                                <View
                                  style={{
                                    alignSelf: "flex-start",
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    backgroundColor: invitation.isAccepted
                                      ? "rgba(59,130,246,0.2)"
                                      : "rgba(245,158,11,0.2)",
                                    borderColor: invitation.isAccepted
                                      ? "rgba(59,130,246,0.3)"
                                      : "rgba(245,158,11,0.3)",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "600",
                                      color: invitation.isAccepted ? "#60A5FA" : "#FBBF24",
                                    }}
                                  >
                                    {invitation.isAccepted ? "Accepted · Tap to view RSVP" : "Tap to accept & set availability"}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <TournamentInviteSheet
        visible={!!activeInviteId}
        inviteId={activeInviteId}
        backTo="/(tabs)/invitations"
        onClose={() => setActiveInviteId(null)}
        onAccepted={() => {
          fetchTournamentInvites({ force: true });
          fetchMyTournaments({ force: true });
        }}
      />
    </SafeAreaView>
  );
};

export default MobileInvitations;