import { useState, useCallback } from "react";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getMyTournamentsAPI } from "@/services/TournamentApi";
import { getTeamsAPI } from "@/services/TeamApi";
import { getUserInvitationsAPI } from "@/services/PlayerApi";
import {
  resolveUserId,
  filterMineTournaments,
} from "@/features/tournament/mineConfig";

let cache = { userId: "", data: [], fetchedAt: 0, hasValue: false };
const TTL_MS = 20000;
let inflight = null;

export const clearMyTournamentsCache = () => {
  cache = { userId: "", data: [], fetchedAt: 0, hasValue: false };
  inflight = null;
};

export const useMyTournaments = () => {
  const { isSignedIn, backendUser } = useBackendAuth();
  const userId = resolveUserId(backendUser);
  const [tournaments, setTournaments] = useState(() =>
    cache.userId && cache.userId === userId ? cache.data : [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ownedTeamIds, setOwnedTeamIds] = useState([]);
  const [memberTeamIds, setMemberTeamIds] = useState([]);

  const fetchTournaments = useCallback(async ({ force = false } = {}) => {
    if (!isSignedIn || !userId) {
      clearMyTournamentsCache();
      setTournaments([]);
      setOwnedTeamIds([]);
      setMemberTeamIds([]);
      return [];
    }
    if (
      !force &&
      cache.hasValue &&
      cache.userId === userId &&
      Date.now() - cache.fetchedAt < TTL_MS
    ) {
      setTournaments(cache.data);
      return cache.data;
    }
    if (inflight) return inflight;

    setIsLoading(true);
    setError(null);
    inflight = (async () => {
      let owned = [];
      let member = [];
      try {
        const teamsRes = await getTeamsAPI({ limit: 100 });
        const teams = teamsRes?.data || teamsRes?.teams || teamsRes || [];
        owned = (Array.isArray(teams) ? teams : []).map((t) => t._id).filter(Boolean);
      } catch {
        // still fetch admin/created tournaments
      }
      try {
        const invRes = await getUserInvitationsAPI();
        const invitations = invRes?.data || invRes || [];
        member = (Array.isArray(invitations) ? invitations : [])
          .filter((inv) => {
            const status = String(inv.invitationStatus || inv.status || "").toLowerCase();
            return inv.isAccepted === true || status === "accepted" || !!inv.invitationAcceptedAt;
          })
          .map((inv) => inv.teamId)
          .filter(Boolean);
      } catch {
        // member teams optional
      }
      setOwnedTeamIds(owned);
      setMemberTeamIds(member);
      const res = await getMyTournamentsAPI(owned, member);
      const list = filterMineTournaments(res?.data || [], userId, owned, member);
      cache = { userId, data: list, fetchedAt: Date.now(), hasValue: true };
      setTournaments(list);
      return list;
    })()
      .catch((err) => {
        setError(err);
        throw err;
      })
      .finally(() => {
        setIsLoading(false);
        inflight = null;
      });
    return inflight;
  }, [isSignedIn, userId]);

  return { tournaments, isLoading, error, fetchTournaments, ownedTeamIds, memberTeamIds, userId };
};
