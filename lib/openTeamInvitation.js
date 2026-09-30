import { Alert } from "react-native";
import { acceptInvitationAPI } from "@/services/PlayerApi";
import { getTournamentsForTeamAPI } from "@/services/TournamentApi";

const str = (value) => String(value ?? "").trim();

export const invitationParamsFromRecord = (inv = {}) => ({
  invitationId: str(inv.invitationId || inv._id),
  invitationToken: str(inv.invitationToken || inv.token),
  token: str(inv.invitationToken || inv.token),
  email: str(inv.email || inv.parentEmail),
  teamId: str(inv.teamId),
  teamName: str(inv.teamName),
  sport: str(inv.sport),
  season: str(inv.season),
  location: str(inv.location),
  playerRole: str(inv.playerRole || inv.role),
  playerName: str(inv.playerName),
  isAccepted: inv.isAccepted ? "true" : "false",
  teamDeleted: inv.teamDeleted ? "true" : "false",
});

const findActiveTournamentEntry = (entries = []) =>
  (entries || []).find(
    (e) => e?.tournament?._id && e.tournament.status !== "completed" && e.tournament.status !== "cancelled",
  );

export async function navigateToTeamOrTournament(router, teamId, backTo = "/(tabs)/teams") {
  const id = str(teamId);
  if (!id) return false;
  try {
    const res = await getTournamentsForTeamAPI(id);
    const active = findActiveTournamentEntry(res?.data || []);
    if (active?.tournament?._id) {
      router.replace({
        pathname: `/tournament/${active.tournament._id}`,
        params: { backTo },
      });
      return true;
    }
  } catch {
    // fall through
  }
  router.replace({
    pathname: `/team/${id}`,
    params: { initialTab: "HOME", backTo },
  });
  return false;
}

/**
 * Open a team from a pending or accepted invitation (notifications, deep links).
 * If the team is in an active tournament, opens the tournament page instead of
 * the regular team home (which expects a manually added opponent).
 */
export async function openTeamInvitation(router, params = {}, options = {}) {
  const backTo = options.backTo || "/notifications";
  const teamId = str(params.teamId);
  const token = str(params.invitationToken || params.token);
  const email = str(params.email);
  const isAccepted = params.isAccepted === true || params.isAccepted === "true";
  const teamDeleted = params.teamDeleted === true || params.teamDeleted === "true";

  if (teamDeleted) {
    Alert.alert(
      "Team unavailable",
      "This team has been deleted or is no longer available.",
    );
    router.push("/(tabs)/invitations");
    return;
  }

  const goToTeam = async (resolvedTeamId) => {
    const id = str(resolvedTeamId);
    if (!id) {
      Alert.alert("Invitation", "Could not find a team for this invitation.");
      router.push("/(tabs)/invitations");
      return;
    }
    await navigateToTeamOrTournament(router, id, backTo);
  };

  if (isAccepted && teamId) {
    await goToTeam(teamId);
    return;
  }

  if (token && email) {
    try {
      const result = await acceptInvitationAPI(token, email);
      await goToTeam(result?.data?.teamId || teamId);
      return;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Could not accept this invitation.";
      Alert.alert("Invitation", msg);
    }
  }

  if (teamId || token) {
    router.push({
      pathname: "/invitation-rsvp",
      params: { ...params, backTo },
    });
    return;
  }

  router.push("/(tabs)/invitations");
}
