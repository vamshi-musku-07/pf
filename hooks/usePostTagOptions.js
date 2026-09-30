import { useCallback, useEffect, useState } from "react";
import { getTeamsAPI } from "@/services/TeamApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { getMyTournamentsAPI } from "@/services/TournamentApi";
import { extractPlayersFromApiResponse } from "@/lib/playerRoster";
import { useBackendAuth } from "@/context/BackendAuthContext";

/**
 * Loads teammates (for @mentions) + my teams/tournaments (for tagging).
 */
export function usePostTagOptions(enabled = true) {
  const { isSignedIn, backendUser } = useBackendAuth();
  const myId = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");
  const [people, setPeople] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !isSignedIn) {
      setPeople([]);
      setTeams([]);
      setTournaments([]);
      setReady(true);
      return;
    }
    try {
      const teamsRes = await getTeamsAPI({ page: 1, limit: 50 }).catch(() => null);
      const teamList = teamsRes?.data || teamsRes?.teams || teamsRes || [];
      const normalizedTeams = (Array.isArray(teamList) ? teamList : [])
        .map((t) => ({
          teamId: String(t._id || t.id || ""),
          teamName: t.teamName || t.name || "Team",
        }))
        .filter((t) => t.teamId);
      setTeams(normalizedTeams);

      const rosterResults = await Promise.all(
        normalizedTeams.slice(0, 20).map((t) =>
          getPlayersByTeamAPI(t.teamId).catch(() => []),
        ),
      );

      const byUser = new Map();
      rosterResults.forEach((res) => {
        extractPlayersFromApiResponse(res).forEach((p) => {
          const userId = String(p.userId || "").trim();
          if (!userId || userId === myId) return;
          const username =
            p.username ||
            [p.firstName, p.lastName].filter(Boolean).join(" ") ||
            p.name ||
            "Player";
          if (!byUser.has(userId)) {
            byUser.set(userId, {
              userId,
              username: String(username).replace(/\s+/g, "").slice(0, 40) || "player",
              displayName: String(username),
            });
          }
        });
      });
      setPeople([...byUser.values()]);

      const teamIds = normalizedTeams.map((t) => t.teamId);
      const tourRes = await getMyTournamentsAPI(teamIds, teamIds).catch(() => null);
      const tourList = tourRes?.data || tourRes?.tournaments || tourRes || [];
      setTournaments(
        (Array.isArray(tourList) ? tourList : [])
          .map((t) => ({
            tournamentId: String(t._id || t.id || ""),
            tournamentName: t.name || t.title || "Tournament",
          }))
          .filter((t) => t.tournamentId)
          .slice(0, 40),
      );
    } catch {
      setPeople([]);
      setTeams([]);
      setTournaments([]);
    } finally {
      setReady(true);
    }
  }, [enabled, isSignedIn, myId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { people, teams, tournaments, ready, refresh };
}
